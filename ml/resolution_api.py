"""FastAPI adapter for the existing resolution-time regression artifact.

This service only loads the persisted pipeline and performs inference. It never
trains or mutates the artifact at startup.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from .resolution_predictor import DEFAULT_ARTIFACT_PATH, load_resolution_pipeline, predict_resolution_time


MODULE_DIR = Path(__file__).resolve().parent
ARTIFACT_DIR = Path(os.getenv("ML_ARTIFACT_DIR", str(MODULE_DIR / "artifacts" / "resolution")))
MODEL_PATH = Path(os.getenv("ML_MODEL_PATH", str(ARTIFACT_DIR / "resolution_model.joblib")))
METADATA_PATH = ARTIFACT_DIR / "metadata.json"
METRICS_PATH = ARTIFACT_DIR / "metrics.json"


class PredictionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    issue_created: str = Field(min_length=1, max_length=100)
    issue_priority: str = Field(min_length=1, max_length=100)
    issue_type: str = Field(min_length=1, max_length=100)
    issue_proj: str = Field(min_length=1, max_length=200)


class ModelRuntime:
    def __init__(self) -> None:
        self.pipeline: Any | None = None
        self.metadata: dict[str, Any] = {}
        self.metrics: dict[str, Any] = {}
        self.load_error: str | None = None
        self._load()

    def _load(self) -> None:
        try:
            if not MODEL_PATH.exists():
                raise FileNotFoundError(f"Resolution model artifact not found at {MODEL_PATH}")
            self.pipeline = load_resolution_pipeline(MODEL_PATH)
            self.metadata = json.loads(METADATA_PATH.read_text(encoding="utf-8")) if METADATA_PATH.exists() else {}
            self.metrics = json.loads(METRICS_PATH.read_text(encoding="utf-8")) if METRICS_PATH.exists() else {}
        except Exception as exc:  # health endpoint exposes a safe status, not the filesystem detail
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

    def validate_categories(self, request: PredictionRequest) -> None:
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
        return {
            "status": "available",
            "model_id": "resolution-time",
            "display_name": "Resolution-Time Prediction",
            "model_name": self.metadata.get("selected_model"),
            "artifact_generated_at": self.metadata.get("generated_at_utc"),
            "raw_input_columns": raw_inputs,
            "engineered_features": engineered,
            "prediction_type": self.metadata.get("prediction_type", "point_estimate"),
            "target_unit": self.metadata.get("target_unit", "hours"),
            "fields": {
                "issue_priority": {"label": "Priority", "required": True, "options": categories["issue_priority"]},
                "issue_type": {"label": "Issue type", "required": True, "options": categories["issue_type"]},
                "issue_proj": {"label": "Project", "required": True, "options": categories["issue_proj"]},
            },
            "evaluation": {
                "target": self.metrics.get("target"),
                "splits": self.metrics.get("splits"),
                "validation": self.metrics.get("validation_model_selection", {}).get("best_validation_row"),
                "final_test": self.metrics.get("final_test"),
                "test_median_baseline": self.metrics.get("test_median_baseline"),
                "test_baseline_improvement_hours": self.metrics.get("test_baseline_improvement_hours"),
            },
        }

    def predict(self, request: PredictionRequest) -> dict[str, Any]:
        self.ensure_available()
        self.validate_categories(request)
        try:
            result = predict_resolution_time(request.model_dump(), artifact_path=MODEL_PATH)
        except (ValueError, TypeError) as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        if not isinstance(result, dict) or not isinstance(result.get("duration"), (int, float)):
            raise HTTPException(status_code=503, detail="The resolution model returned an invalid result.")
        return {
            "model_id": "resolution-time",
            "duration": float(result["duration"]),
            "unit": "hours",
            "prediction_type": "point_estimate",
            "model_version": self.metadata.get("generated_at_utc"),
            "artifact_generated_at": self.metadata.get("generated_at_utc"),
        }


runtime = ModelRuntime()
app = FastAPI(title="OpsPilot AI Resolution Model Service", version="0.1.0")


@app.get("/health")
def health() -> dict[str, Any]:
    if not runtime.available:
        raise HTTPException(status_code=503, detail="The resolution model is unavailable.")
    return {"status": "available", "service": "resolution-time", "model_id": "resolution-time"}


@app.get("/metadata")
def metadata() -> dict[str, Any]:
    return runtime.metadata_response()


@app.post("/predict/resolution-time")
def predict(request: PredictionRequest) -> dict[str, Any]:
    return runtime.predict(request)
