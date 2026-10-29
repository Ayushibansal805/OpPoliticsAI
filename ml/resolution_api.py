"""FastAPI service adapter for OpsPilot AI Machine Learning Models.

Serves:
1. Model A: Resolution-Time Regression (point estimates in hours)
2. Model B: Ticket Delay-Risk Classification (probability, risk band, binary decision, and feature explanations)
3. Model C: Workload Forecasting (multi-day arrival estimates, 90% prediction intervals, surge flags)

Loads persisted artifacts once at startup and performs low-latency inference.
Never mutates or retrains artifacts during inference requests.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import numpy as np
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field

from .delay_risk_predictor import DelayRiskPredictor
from .forecasting_predictor import WorkloadForecastingPredictor
from .resolution_predictor import (
    DEFAULT_ARTIFACT_PATH,
    V3_METADATA_PATH,
    build_resolution_features,
    load_resolution_pipeline,
)

MODULE_DIR = Path(__file__).resolve().parent
ARTIFACT_DIR = Path(os.getenv("ML_ARTIFACT_DIR", str(MODULE_DIR / "artifacts" / "resolution")))
MODEL_PATH = Path(os.getenv("ML_MODEL_PATH", str(DEFAULT_ARTIFACT_PATH)))
METADATA_PATH = Path(os.getenv("ML_METADATA_PATH", str(V3_METADATA_PATH)))
METRICS_PATH = ARTIFACT_DIR / "metrics.json"
EVALUATION_PATH = MODULE_DIR / "experiments" / "resolution_v3_evaluation.json"
CANDIDATE_METRICS_PATH = ARTIFACT_DIR / "candidates" / "candidate_metrics.json"


class ResolutionPredictionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    issue_created: str = Field(min_length=1, max_length=100)
    issue_priority: str = Field(min_length=1, max_length=100)
    issue_type: str = Field(min_length=1, max_length=100)
    issue_proj: str = Field(min_length=1, max_length=200)


class DelayRiskRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str | None = None
    issue_created: str = Field(min_length=1, max_length=100)
    issue_priority: str = Field(min_length=1, max_length=100)
    issue_type: str = Field(min_length=1, max_length=100)
    issue_proj: str = Field(min_length=1, max_length=200)
    issue_reporter: str | None = None
    threshold: float | None = Field(default=None, ge=0.0, le=1.0)


class ResolutionModelRuntime:
    def __init__(self) -> None:
        self.pipeline: Any | None = None
        self.metadata: dict[str, Any] = {}
        self.metrics: dict[str, Any] = {}
        self.evaluation_report: dict[str, Any] = {}
        self.candidate_metrics: dict[str, Any] = {}
        self.load_error: str | None = None
        self._load()

    def _load(self) -> None:
        try:
            if not MODEL_PATH.exists():
                raise FileNotFoundError(f"Resolution model artifact not found at {MODEL_PATH}")
            self.pipeline = load_resolution_pipeline(MODEL_PATH)
            self.metadata = json.loads(METADATA_PATH.read_text(encoding="utf-8")) if METADATA_PATH.exists() else {}
            self.metrics = json.loads(METRICS_PATH.read_text(encoding="utf-8")) if METRICS_PATH.exists() else {}
            self.evaluation_report = json.loads(EVALUATION_PATH.read_text(encoding="utf-8")) if EVALUATION_PATH.exists() else {}
            if CANDIDATE_METRICS_PATH.exists():
                self.candidate_metrics = json.loads(CANDIDATE_METRICS_PATH.read_text(encoding="utf-8"))
        except Exception as exc:
            self.pipeline = None
            self.load_error = str(exc)

    @property
    def available(self) -> bool:
        return self.pipeline is not None

    def categories(self) -> dict[str, list[str]]:
        if self.pipeline is None:
            return {"issue_priority": [], "issue_type": [], "issue_proj": []}
        try:
            encoder = self.pipeline.named_steps["preprocessor"].named_transformers_["categorical"].named_steps["one_hot"]
            return {
                "issue_priority": [str(value) for value in encoder.categories_[0]],
                "issue_type": [str(value) for value in encoder.categories_[1]],
                "issue_proj": [str(value) for value in encoder.categories_[2]],
            }
        except (AttributeError, KeyError, IndexError) as exc:
            raise RuntimeError("The resolution artifact does not expose its categorical schema") from exc

    def ensure_available(self) -> None:
        if not self.available:
            raise HTTPException(status_code=503, detail="The resolution model artifact is unavailable.")

    def validate_categories(self, request: ResolutionPredictionRequest) -> None:
        categories = self.categories()
        values = request.model_dump()
        invalid = [field for field in ("issue_priority", "issue_type", "issue_proj") if values[field] not in categories[field]]
        if invalid:
            raise HTTPException(status_code=422, detail=f"Unsupported model input value for: {', '.join(invalid)}")

    def metadata_response(self) -> dict[str, Any]:
        self.ensure_available()
        raw_inputs = self.metadata.get("raw_input_columns", ["issue_created", "issue_priority", "issue_type", "issue_proj"])
        engineered = self.metadata.get("engineered_features", [])
        categories = self.categories()
        model_name = self.metadata.get("selected_model", "HistGradientBoostingRegressor")
        version = self.metadata.get("generated_at_utc")
        eval_metrics = self.metadata.get("held_out_test_metrics", self.metrics.get("final_test", {}))
        eval_metrics = {**eval_metrics, "n_test": eval_metrics.get("n_test", eval_metrics.get("n"))}
        comparison = self.evaluation_report.get("comparison_test_metrics", {})
        median_baseline = comparison.get("training_median", self.metrics.get("test_median_baseline", {}))
        priority_baseline = comparison.get("training_median_by_issue_priority", {})
        split_dates = self.metadata.get("split_dates")
        if isinstance(split_dates, dict):
            split_counts = {"train": self.metadata.get("train_partition_rows"),
                            "validation": self.metadata.get("validation_rows"),
                            "test": self.metadata.get("test_rows")}
            splits = [{"split": name, "rows": split_counts[name],
                       "first_created": value.get("start"), "last_created": value.get("end")}
                      for name, value in split_dates.items()]
        else:
            splits = self.metrics.get("splits")
        validation_metrics = self.metadata.get("validation_metrics")
        validation = ({"model": self.metadata.get("selected_model"),
                       "validation_mae_hours": validation_metrics.get("mae_hours"),
                       "validation_rmse_hours": validation_metrics.get("rmse_hours"),
                       "validation_r2": validation_metrics.get("r2")}
                      if validation_metrics else self.metrics.get("validation_model_selection", {}).get("best_validation_row"))
        target = self.metrics.get("target", {
            "definition": self.metadata.get("target_definition"), "unit": self.metadata.get("target_unit", "hours"),
            "prediction_type": "point_estimate",
            "included_rows": self.metadata.get("train_rows", 0) + self.metadata.get("test_rows", 0)})

        return {
            "status": "available",
            "model_id": "resolution-time",
            "display_name": "Resolution-Time Prediction",
            "model_name": model_name,
            "artifact_generated_at": version,
            "raw_input_columns": raw_inputs,
            "engineered_features": engineered or self.metadata.get("features", []),
            "prediction_type": "point_estimate",
            "target_unit": "hours",
            "fields": {
                "issue_priority": {"label": "Priority", "required": True, "options": categories["issue_priority"]},
                "issue_type": {"label": "Issue type", "required": True, "options": categories["issue_type"]},
                "issue_proj": {"label": "Project", "required": True, "options": categories["issue_proj"]},
            },
            "evaluation": {
                "target": target,
                "splits": splits,
                "validation": validation,
                "final_test": eval_metrics,
                "test_median_baseline": median_baseline,
                "test_priority_median_baseline": priority_baseline,
                "test_baseline_improvement_hours": median_baseline.get("mae_hours", 0) - eval_metrics.get("mae_hours", 0),
            },
        }

    def predict(self, request: ResolutionPredictionRequest) -> dict[str, Any]:
        self.ensure_available()
        self.validate_categories(request)
        try:
            features = build_resolution_features(request.model_dump())
            prediction = float(self.pipeline.predict(features)[0])
            if not np.isfinite(prediction):
                raise ValueError("The resolution model returned a non-finite prediction")
            result = {"duration": max(prediction, 0.0), "unit": "hours", "prediction_type": "point_estimate"}
        except (ValueError, TypeError) as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        if not isinstance(result, dict) or not isinstance(result.get("duration"), (int, float)):
            raise HTTPException(status_code=503, detail="The resolution model returned an invalid result.")
        version = self.metadata.get("generated_at_utc")
        return {
            "model_id": "resolution-time",
            "duration": float(result["duration"]),
            "unit": "hours",
            "prediction_type": "point_estimate",
            "model_version": version,
            "artifact_generated_at": version,
        }


# Initialize runtimes once at module load
resolution_runtime = ResolutionModelRuntime()
delay_risk_predictor = DelayRiskPredictor()
forecasting_predictor = WorkloadForecastingPredictor()

# For backward compatibility with existing test scripts:
runtime = resolution_runtime
PredictionRequest = ResolutionPredictionRequest

app = FastAPI(title="OpsPilot AI Multi-Model Intelligence Service", version="0.2.0")


@app.get("/health")
def health() -> dict[str, Any]:
    if not resolution_runtime.available and not delay_risk_predictor.available and not forecasting_predictor.available:
        raise HTTPException(status_code=503, detail="All ML models are currently unavailable.")

    return {
        "status": "available",
        "service": "OpsPilot AI Multi-Model Service",
        "models": {
            "resolution-time": "available" if resolution_runtime.available else "unavailable",
            "delay-risk": "available" if delay_risk_predictor.available else "unavailable",
            "workload-forecasting": "available" if forecasting_predictor.available else "unavailable",
        },
    }


@app.get("/models")
def list_models() -> dict[str, Any]:
    return {
        "models": [
            {
                "id": "resolution-time",
                "name": "Resolution-Time Prediction",
                "status": "available" if resolution_runtime.available else "unavailable",
                "type": "regression",
                "unit": "hours",
            },
            {
                "id": "delay-risk",
                "name": "Ticket Delay-Risk Prediction",
                "status": "available" if delay_risk_predictor.available else "unavailable",
                "type": "classification",
                "target": "delayed > 720 hours (30 days)",
            },
            {
                "id": "workload-forecasting",
                "name": "Workload / Operations Forecasting",
                "status": "available" if forecasting_predictor.available else "unavailable",
                "type": "time_series_forecast",
                "unit": "tickets/day",
            },
        ]
    }


# --- Model A: Resolution-Time Endpoints (backward compatible) ---
@app.get("/metadata")
def metadata() -> dict[str, Any]:
    return resolution_runtime.metadata_response()


@app.post("/predict/resolution-time")
def predict_resolution(request: ResolutionPredictionRequest) -> dict[str, Any]:
    return resolution_runtime.predict(request)


# --- Model B: Delay-Risk Endpoints ---
@app.get("/metadata/delay-risk")
def delay_risk_metadata() -> dict[str, Any]:
    if not delay_risk_predictor.available:
        raise HTTPException(status_code=503, detail="Delay risk model is unavailable.")
    meta = delay_risk_predictor.metadata
    bundle = delay_risk_predictor.bundle or {}
    return {
        "status": "available",
        "model_id": "delay-risk",
        "display_name": "Ticket Delay-Risk Classification",
        "model_version": bundle.get("model_version", "delay-risk-v3"),
        "target_definition": meta.get("target", "delayed = 1 if resolution time > 720 hours"),
        "delay_threshold_hours": bundle.get("threshold_hours", 720.0),
        "default_decision_threshold": bundle.get("threshold", 0.1842),
        "risk_bands": {
            "low": "< 0.40 probability",
            "medium": "0.40 - 0.70 probability",
            "high": ">= 0.70 probability",
        },
        "operating_thresholds": {
            "high_recall": {"threshold": 0.1842, "recall": 0.789, "precision": 0.279, "f1": 0.412},
            "balanced_f1": {"threshold": 0.3130, "recall": 0.789, "precision": 0.345, "f1": 0.482},
        },
        "metrics_held_out_test": meta.get("metrics", {}).get("test", {}),
    }


@app.post("/predict/delay-risk")
def predict_delay_risk(request: DelayRiskRequest) -> dict[str, Any]:
    if not delay_risk_predictor.available:
        raise HTTPException(status_code=503, detail="Delay risk model is unavailable.")
    try:
        results = delay_risk_predictor.predict(
            request.model_dump(),
            threshold=request.threshold,
            top_k=5,
        )
        return {"success": True, "data": results[0]}
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Inference error: {exc}") from exc


# --- Model C: Workload Forecasting Endpoints ---
@app.get("/metadata/workload-forecasting")
def workload_metadata() -> dict[str, Any]:
    if not forecasting_predictor.available:
        raise HTTPException(status_code=503, detail="Workload forecasting model is unavailable.")
    return {
        "status": "available",
        "model_id": "workload-forecasting",
        "display_name": "Workload / Operations Forecasting",
        **forecasting_predictor.metadata,
    }


@app.get("/forecast/workload")
def forecast_workload(
    horizon: int = Query(default=7, ge=1, le=60, description="Forecast horizon in days (e.g. 7, 14, 30)")
) -> dict[str, Any]:
    if not forecasting_predictor.available:
        raise HTTPException(status_code=503, detail="Workload forecasting model is unavailable.")
    try:
        result = forecasting_predictor.predict_forecast(horizon=horizon)
        return {"success": True, "data": result}
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Forecasting error: {exc}") from exc
