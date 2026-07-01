"""ML configuration — model paths and disease mappings."""

from pathlib import Path

ML_ROOT = Path(__file__).resolve().parent
MODELS_DIR = ML_ROOT / "models"
DATA_DIR = ML_ROOT / "datasets"

CONDITION_API_TO_KEY = {
    "Parkinson's": "parkinsons",
    "Parkinson\u2019s": "parkinsons",
    "Depression": "depression",
    "Asthma": "asthma",
}

CONDITION_KEY_TO_API = {
    "parkinsons": "Parkinson\u2019s",
    "depression": "Depression",
    "asthma": "Asthma",
}

SIGNAL_FEATURE_NAMES = [f"mfcc_{i}" for i in range(1, 14)] + [
    "pitch_mean", "pitch_std", "jitter", "shimmer", "hnr",
    "speech_rate", "pause_count", "avg_pause_len",
]

TARGET_NAMES = [
    "severity", "speech_score", "breathlessness_score", "tremor_score",
]

OXFORD_FEATURE_COLUMNS = [
    "age", "sex", "test_time",
    "Jitter(%)", "Jitter(Abs)", "Jitter:RAP", "Jitter:PPQ5", "Jitter:DDP",
    "Shimmer", "Shimmer(dB)", "Shimmer:APQ3", "Shimmer:APQ5", "Shimmer:APQ11", "Shimmer:DDA",
    "NHR", "HNR", "RPDE", "DFA", "PPE",
]

LSTM_MIN_DAYS = 7
BASELINE_DAYS = 3


def model_paths(condition_key: str) -> dict:
    paths = {
        "xgb": MODELS_DIR / f"{condition_key}_xgb.pkl",
        "scaler": MODELS_DIR / f"{condition_key}_scaler.joblib",
        "features": MODELS_DIR / f"{condition_key}_features.joblib",
        "lstm": MODELS_DIR / "parkinsons_lstm.keras",
    }
    if condition_key == "parkinsons":
        paths.update({
            "updrs_xgb": MODELS_DIR / "parkinsons_xgb.joblib",
            "updrs_features": MODELS_DIR / "parkinsons_updrs_features.joblib",
            "updrs_scale": MODELS_DIR / "parkinsons_updrs_scale.json",
        })
    return paths


def dataset_path(condition_key: str) -> Path:
    mapping = {
        "parkinsons": DATA_DIR / "parkinsons" / "parkinsons_updated.csv",
        "depression": DATA_DIR / "depression" / "depression.csv",
        "asthma": DATA_DIR / "asthma" / "asthma.csv",
    }
    return mapping.get(condition_key)
