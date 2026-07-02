"""XGBoost multi-output predictor for Parkinson's, Depression, and Asthma."""

import joblib
import numpy as np
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ml_config import model_paths, SIGNAL_FEATURE_NAMES
from preprocessing.features import (
    extract_signal_features,
    get_disease_biomarkers,
    severity_to_stage,
    build_signal_map,
)


def _prediction_label(severity: float) -> str:
    if severity > 70:
        return "YES"
    if severity > 45:
        return "MONITOR"
    return "NO"


def _risk_level(severity: float) -> str:
    if severity > 70:
        return "HIGH"
    if severity > 40:
        return "MODERATE"
    return "NORMAL"


class XGBoostPredictor:
    def __init__(self, condition_key: str):
        paths = model_paths(condition_key)
        self.condition_key = condition_key
        self.model_path = paths["xgb"]
        self.scaler_path = paths["scaler"]
        self.feats_path = paths["features"]
        self.model = None
        self.scaler = None
        self.feature_names = None
        if self.model_path.exists() and self.scaler_path.exists() and self.feats_path.exists():
            self.model = joblib.load(self.model_path)
            self.scaler = joblib.load(self.scaler_path)
            self.feature_names = joblib.load(self.feats_path)

    @property
    def ready(self) -> bool:
        return self.model is not None

    def predict_from_features(self, feature_values: dict, condition_api: str) -> dict:
        """Run XGBoost on a pre-built feature vector (no audio)."""
        if not self.ready:
            raise FileNotFoundError(
                f"XGBoost model missing for {self.condition_key}. "
                f"Expected: {self.model_path}. "
                f"Run: python training/train_{self.condition_key}.py"
            )

        vec = [float(feature_values.get(name, 0.0)) for name in self.feature_names]
        X = self.scaler.transform(np.array(vec).reshape(1, -1))
        preds = self.model.predict(X)[0]

        signal_map = {name: float(feature_values.get(name, 0.0)) for name in self.feature_names}
        meta = {
            "jitter": float(signal_map.get("jitter", 0.0)),
            "shimmer": float(signal_map.get("shimmer", 0.0)),
            "hnr_db": float(signal_map.get("hnr", 15.0)),
            "pitch_var": float(signal_map.get("pitch_std", 0.0)),
            "speech_rate": float(signal_map.get("speech_rate", 0.4)),
            "pause_ratio": float(signal_map.get("pause_count", 0)) / 20.0,
        }
        signatures = {"micro_tremor": False, "wheeze": False, "cough": False}
        bios = get_disease_biomarkers(meta, condition_api, signatures)

        severity = float(np.clip(preds[0], 0, 100))
        speech_score = float(np.clip(preds[1], 0, 100))
        breathlessness_score = float(np.clip(preds[2], 0, 100))
        tremor_score = float(np.clip(preds[3], 0, 100))

        result = {
            "severity": severity,
            "stage": severity_to_stage(severity),
            "confidence": 0.88,
            "speech_score": speech_score,
            "breathlessness_score": breathlessness_score,
            "tremor_score": tremor_score,
            "health_score": int(np.clip(100 - severity, 0, 100)),
            "disease_score": severity / 100,
            "prediction": _prediction_label(severity),
            "risk_level": _risk_level(severity),
            "biomarkers": bios,
            "duration": 0.0,
            "signature_detected": bool(bios.get("SIGNATURE_DETECTED", False)),
            "signals": signal_map,
            "model_source": "xgboost_manual",
        }

        if condition_api == "Asthma":
            cough = bool(feature_values.get("cough_detected", False))
            wheeze = bool(feature_values.get("wheeze_detected", False))
            result["cough_detected"] = cough
            result["wheeze_detected"] = wheeze
            if cough or wheeze:
                result["signature_detected"] = True

        return result

    def predict(self, condition_api: str, audio_path: str) -> dict:
        if not self.ready:
            raise FileNotFoundError(
                f"XGBoost model missing for {self.condition_key}. "
                f"Expected: {self.model_path}. "
                f"Run: python training/train_{self.condition_key}.py"
            )

        data = extract_signal_features(audio_path)
        signal_map = build_signal_map(data["raw"])
        vec = [float(signal_map.get(name, 0.0)) for name in self.feature_names]
        X = self.scaler.transform(np.array(vec).reshape(1, -1))
        preds = self.model.predict(X)[0]

        bios = get_disease_biomarkers(data["meta"], condition_api, data["signatures"])

        severity = float(np.clip(preds[0], 0, 100))
        speech_score = float(np.clip(preds[1], 0, 100))
        breathlessness_score = float(np.clip(preds[2], 0, 100))
        tremor_score = float(np.clip(preds[3], 0, 100))

        result = {
            "severity": severity,
            "stage": severity_to_stage(severity),
            "confidence": 0.88,
            "speech_score": speech_score,
            "breathlessness_score": breathlessness_score,
            "tremor_score": tremor_score,
            "health_score": int(np.clip(100 - severity, 0, 100)),
            "disease_score": severity / 100,
            "prediction": _prediction_label(severity),
            "risk_level": _risk_level(severity),
            "biomarkers": bios,
            "duration": data["duration"],
            "signature_detected": bool(bios.get("SIGNATURE_DETECTED", False)),
            "signals": signal_map,
            "model_source": "xgboost",
        }

        if condition_api == "Asthma":
            cough = bool(bios.get("cough_detected", False))
            wheeze = bool(data["signatures"].get("wheeze", False))
            result["cough_detected"] = cough
            result["wheeze_detected"] = wheeze
            if cough or wheeze:
                result["signature_detected"] = True

        return result
