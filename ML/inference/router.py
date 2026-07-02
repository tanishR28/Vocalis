"""Disease router — single entry point for voice prediction."""

from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ml_config import CONDITION_API_TO_KEY, model_paths
from inference.predictor import XGBoostPredictor
from inference.predictor_updrs import UPDRSPredictor


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


def predict_voice_manual(
    condition: str,
    features: dict,
    patient_meta=None,
) -> dict:
    """Predict from manual feature values (dev/testing — no audio)."""
    target = _normalize_condition(condition)
    if target not in ("Parkinson’s", "Depression", "Asthma"):
        raise ValueError(f"Unsupported condition: {condition}")

    condition_key = CONDITION_API_TO_KEY.get(target, target.lower())

    if condition_key == "parkinsons":
        updrs_paths = model_paths("parkinsons")
        if updrs_paths["updrs_xgb"].exists():
            return UPDRSPredictor().predict_from_row(features, patient_meta)

    predictor = XGBoostPredictor(condition_key)
    return predictor.predict_from_features(features, target)


def predict_voice(condition: str, audio_path: str, patient_meta=None, history=None) -> dict:
    """Predict voice biomarkers for one of the 3 supported conditions."""
    target = _normalize_condition(condition)
    if target not in ("Parkinson’s", "Depression", "Asthma"):
        raise ValueError(f"Unsupported condition: {condition}")

    condition_key = CONDITION_API_TO_KEY.get(target, target.lower())

    if condition_key == "parkinsons":
        updrs_paths = model_paths("parkinsons")
        if updrs_paths["updrs_xgb"].exists():
            return UPDRSPredictor().predict(audio_path, patient_meta)

    predictor = XGBoostPredictor(condition_key)
    return predictor.predict(target, audio_path)
