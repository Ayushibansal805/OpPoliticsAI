import argparse
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from ml.forecasting.features import build_features


ROOT = Path(__file__).resolve().parents[2]
MODEL_PATH = ROOT / "ml" / "artifacts" / "forecasting" / "workload_xgboost.joblib"
OUTPUT_PATH = ROOT / "ml" / "artifacts" / "forecasting" / "workload_forecast_comparison.csv"


def read_history(path, bundle):
    if path is None:
        return bundle["daily_history"].astype(float)

    # CSV format: date,ticket_count
    frame = pd.read_csv(path)

    required = {"date", "ticket_count"}
    missing = required - set(frame.columns)
    if missing:
        raise ValueError(f"Input CSV is missing columns: {sorted(missing)}")

    frame["date"] = (
        pd.to_datetime(frame["date"], utc=True)
        .dt.tz_localize(None)
        .dt.normalize()
    )
    frame["ticket_count"] = pd.to_numeric(frame["ticket_count"], errors="raise")

    history = frame.groupby("date")["ticket_count"].sum().sort_index()
    history = history.asfreq("D", fill_value=0).astype(float)

    if history.empty:
        raise ValueError("Input history CSV has no rows.")

    return history


def forecast(bundle, history, horizon):
    if horizon not in bundle["horizons"]:
        raise ValueError("Supported forecast horizons are 7 or 14 days.")

    history = history.sort_index().astype(float)

    if history.isna().any():
        raise ValueError("History contains missing ticket counts.")

    future_dates = pd.date_range(
        start=history.index[-1] + pd.Timedelta(days=1),
        periods=horizon,
        freq="D",
    )

    extended = history.reindex(history.index.append(future_dates))

    features = build_features(
        extended,
        horizon=horizon,
        holiday_share=bundle["holiday_share"],
    ).loc[future_dates]

    predictions = []

    for candidate in bundle["horizons"][horizon]:
        X = features.reindex(columns=candidate["feature_columns"])
        values = candidate["model"].predict(X)

        if candidate["log_target"]:
            values = np.expm1(values)

        predictions.append(values)

    average_prediction = np.mean(predictions, axis=0)

    return pd.DataFrame({
        "date": future_dates,
        "forecast": np.clip(average_prediction, 0, None).round(1),
    })


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--horizon", type=int, choices=[7, 14], default=7)
    parser.add_argument(
        "--history",
        help="Optional CSV with columns date,ticket_count. Defaults to history saved in the model.",
    )
    parser.add_argument(
        "--actual",
        help="Optional CSV with actual future counts: date,ticket_count.",
    )
    args = parser.parse_args()

    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Model file not found: {MODEL_PATH}")

    bundle = joblib.load(MODEL_PATH)
    history = read_history(args.history, bundle)
    result = forecast(bundle, history, args.horizon)

    print("Model:", bundle["model_name"])
    print("Artifact training data through:", bundle["trained_through"])
    print("Forecast input history through:", history.index[-1].date())
    print(result.to_string(index=False))

    if args.actual:
        actual = pd.read_csv(args.actual)
        actual["date"] = (
            pd.to_datetime(actual["date"], utc=True)
            .dt.tz_localize(None)
            .dt.normalize()
        )

        comparison = result.merge(
            actual[["date", "ticket_count"]],
            on="date",
            how="left",
        ).rename(columns={"ticket_count": "actual"})

        if comparison["actual"].isna().any():
            raise ValueError(
                "Actual CSV must include ticket_count for every forecast date."
            )

        comparison["error"] = comparison["forecast"] - comparison["actual"]
        comparison["absolute_error"] = comparison["error"].abs()

        print("\nForecast vs actual:")
        print(comparison.to_string(index=False))
        print(
            f"\nMAE: {comparison['absolute_error'].mean():.2f} tickets/day"
        )

        result = comparison

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    result.to_csv(OUTPUT_PATH, index=False)
    print(f"\nSaved output to: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()