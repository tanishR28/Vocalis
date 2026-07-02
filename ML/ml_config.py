"""ML configuration — model paths and disease mappings."""

import json
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

# Default LSTM feature order (authoritative copy in parkinsons_lstm_features.joblib)
LSTM_FEATURE_COLUMNS_DEFAULT = [
    "age", "sex",
    "Jitter(%)", "Jitter(Abs)", "Jitter:RAP", "Jitter:PPQ5", "Jitter:DDP",
    "Shimmer", "Shimmer(dB)", "Shimmer:APQ3", "Shimmer:APQ5", "Shimmer:APQ11", "Shimmer:DDA",
    "NHR", "HNR", "RPDE", "DFA", "PPE",
    "motor_UPDRS",
]

BASELINE_DAYS = 3

_LSTM_CONFIG_CACHE = None
_LSTM_FEATURE_COLUMNS_CACHE = None


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
            "lstm_scaler": MODELS_DIR / "parkinsons_lstm_scaler.joblib",
            "lstm_features": MODELS_DIR / "parkinsons_lstm_features.joblib",
            "lstm_config": MODELS_DIR / "parkinsons_lstm_config.json",
            "lstm_metrics": MODELS_DIR / "parkinsons_lstm_metrics.json",
        })
    return paths


def load_lstm_feature_columns() -> list[str]:
    """Column order for LSTM input rows (from joblib, with fallback)."""
    global _LSTM_FEATURE_COLUMNS_CACHE
    if _LSTM_FEATURE_COLUMNS_CACHE is not None:
        return list(_LSTM_FEATURE_COLUMNS_CACHE)

    features_path = model_paths("parkinsons")["lstm_features"]
    if features_path.exists():
        try:
            import joblib
            _LSTM_FEATURE_COLUMNS_CACHE = list(joblib.load(features_path))
            return list(_LSTM_FEATURE_COLUMNS_CACHE)
        except Exception:
            pass

    _LSTM_FEATURE_COLUMNS_CACHE = list(LSTM_FEATURE_COLUMNS_DEFAULT)
    return list(_LSTM_FEATURE_COLUMNS_CACHE)


def load_lstm_config() -> dict:
    """Load LSTM dimensions from parkinsons_lstm_config.json (with fallbacks)."""
    global _LSTM_CONFIG_CACHE
    if _LSTM_CONFIG_CACHE is not None:
        return dict(_LSTM_CONFIG_CACHE)

    feature_columns = load_lstm_feature_columns()
    defaults = {
        "sequence_length": 10,
        "feature_count": len(feature_columns),
        "target": "motor_UPDRS",
    }

    config_path = model_paths("parkinsons")["lstm_config"]
    if config_path.exists():
        try:
            with open(config_path, encoding="utf-8") as f:
                loaded = json.load(f)
            defaults.update({k: loaded[k] for k in ("sequence_length", "feature_count", "target") if k in loaded})
        except Exception:
            pass

    if "feature_count" not in defaults or defaults["feature_count"] != len(feature_columns):
        defaults["feature_count"] = len(feature_columns)

    _LSTM_CONFIG_CACHE = defaults
    return dict(_LSTM_CONFIG_CACHE)


def lstm_sequence_length() -> int:
    return int(load_lstm_config()["sequence_length"])


# Backward-compatible alias used by monitoring code
LSTM_MIN_DAYS = lstm_sequence_length()


def dataset_path(condition_key: str) -> Path:
    mapping = {
        "parkinsons": DATA_DIR / "parkinsons" / "parkinsons_updated.csv",
        "depression": DATA_DIR / "depression" / "depression.csv",
        "asthma": DATA_DIR / "asthma" / "asthma.csv",
    }
    return mapping.get(condition_key)
