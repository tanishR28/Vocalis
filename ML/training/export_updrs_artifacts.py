"""Export UPDRS model companion artifacts (feature column order + severity scale)."""

import json
import joblib
from pathlib import Path

import pandas as pd

ML_ROOT = Path(__file__).resolve().parents[1]
MODELS_DIR = ML_ROOT / "models"
CSV_PATH = ML_ROOT / "datasets" / "parkinsons_real" / "parkinsons_telemonitoring_updrs.csv"

FEATURE_COLUMNS = [
    "age", "sex", "test_time",
    "Jitter(%)", "Jitter(Abs)", "Jitter:RAP", "Jitter:PPQ5", "Jitter:DDP",
    "Shimmer", "Shimmer(dB)", "Shimmer:APQ3", "Shimmer:APQ5", "Shimmer:APQ11", "Shimmer:DDA",
    "NHR", "HNR", "RPDE", "DFA", "PPE",
]


def main():
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(FEATURE_COLUMNS, MODELS_DIR / "parkinsons_updrs_features.joblib")
    print(f"Saved feature columns -> {MODELS_DIR / 'parkinsons_updrs_features.joblib'}")

    if CSV_PATH.exists():
        df = pd.read_csv(CSV_PATH)
        scale = {
            "motor_updrs_min": float(df["motor_UPDRS"].min()),
            "motor_updrs_max": float(df["motor_UPDRS"].max()),
        }
    else:
        scale = {"motor_updrs_min": 8.0, "motor_updrs_max": 40.0}

    scale_path = MODELS_DIR / "parkinsons_updrs_scale.json"
    with open(scale_path, "w", encoding="utf-8") as f:
        json.dump(scale, f, indent=2)
    print(f"Saved UPDRS scale -> {scale_path}: {scale}")


if __name__ == "__main__":
    main()
