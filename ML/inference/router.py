"""Disease router — single entry point for voice prediction."""

from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ml_config import CONDITION_API_TO_KEY
from inference.predictor import XGBoostPredictor


def _normalize_condition(condition: str) -> str:
    key = condition.lower().strip()
    mapping = {
        "parkinson's": "Parkinson’s",
        "parkinson’s": "Parkinson’s",
        "parkinsons": "Parkinson’s",
        "depression": "Depression",
        "asthma": "Asthma",
    }
    if condition == "Parkinson's":
        return "Parkinson’s"
    return mapping.get(key, condition)


def predict_voice(condition: str, audio_path: str, history=None) -> dict:
    """Predict voice biomarkers for one of the 3 supported conditions (XGBoost)."""
    target = _normalize_condition(condition)
    if target not in ("Parkinson’s", "Depression", "Asthma"):
        raise ValueError(f"Unsupported condition: {condition}")

    condition_key = CONDITION_API_TO_KEY.get(target, target.lower())
    predictor = XGBoostPredictor(condition_key)
    return predictor.predict(target, audio_path)
