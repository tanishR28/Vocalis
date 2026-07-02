"""Parkinson's motor_UPDRS predictor (Oxford telemonitoring XGBoost)."""

from __future__ import annotations

import json
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from typing import Any, Dict, Optional

import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ml_config import model_paths, OXFORD_FEATURE_COLUMNS, load_lstm_feature_columns
from preprocessing.features import (
    extract_signal_features,
    get_disease_biomarkers,
    severity_to_stage,
    build_signal_map,
)
from preprocessing.oxford_voice import build_updrs_feature_row, OXFORD_VOICE_COLUMNS


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


def _updrs_to_severity(motor_updrs: float, scale: Dict[str, float]) -> float:
    lo = float(scale.get("motor_updrs_min", 8.0))
    hi = float(scale.get("motor_updrs_max", 40.0))
    if hi <= lo:
        hi = lo + 1.0
    return float(np.clip((motor_updrs - lo) / (hi - lo) * 100, 0, 100))


def _derive_sub_scores(voice: Dict[str, float], severity: float) -> Dict[str, float]:
    jitter = float(voice.get("Jitter(%)", 0))
    shimmer = float(voice.get("Shimmer", 0))
    hnr = float(voice.get("HNR", 20))
    tremor = float(np.clip((jitter * 10 + shimmer * 50), 0, 100))
    breath = float(np.clip(100 - hnr * 2.5, 0, 100))
    speech = float(np.clip(100 - severity * 0.85, 0, 100))
    return {
        "speech_score": speech,
        "breathlessness_score": breath,
        "tremor_score": tremor,
    }


def build_lstm_row(updrs_row: Dict[str, Any], motor_updrs: float) -> Dict[str, Any]:
    """Build a 19-field LSTM history row from UPDRS inference output."""
    lstm_columns = load_lstm_feature_columns()
    row: Dict[str, Any] = {}
    for col in lstm_columns:
        if col == "motor_UPDRS":
            row[col] = float(motor_updrs)
        elif col in updrs_row and updrs_row[col] is not None:
            row[col] = int(updrs_row[col]) if col in ("age", "sex") else float(updrs_row[col])
    return row


class UPDRSPredictor:
    def __init__(self):
        paths = model_paths("parkinsons")
        self.model_path = paths["updrs_xgb"]
        self.features_path = paths["updrs_features"]
        self.scale_path = paths["updrs_scale"]
        self.model = None
        self.feature_columns = list(OXFORD_FEATURE_COLUMNS)
        self.scale = {"motor_updrs_min": 8.0, "motor_updrs_max": 40.0}

        if self.model_path.exists():
            self.model = joblib.load(self.model_path)
        if self.features_path.exists():
            self.feature_columns = list(joblib.load(self.features_path))
        if self.scale_path.exists():
            with open(self.scale_path, encoding="utf-8") as f:
                self.scale = json.load(f)

    @property
    def ready(self) -> bool:
        return self.model is not None

    def predict_from_row(
        self,
        feature_row: Dict[str, Any],
        patient_meta: Optional[Dict[str, Any]] = None,
    ) -> dict:
        """Run UPDRS model on a pre-built Oxford feature row (no audio)."""
        if not self.ready:
            raise FileNotFoundError(
                f"UPDRS model missing: {self.model_path}. "
                "Train with notebooks/parkinsons_xgboost.ipynb and export artifacts."
            )

        meta = patient_meta or {}
        row: Dict[str, Any] = {}
        for col in self.feature_columns:
            if col in feature_row and feature_row[col] is not None:
                row[col] = feature_row[col]
            elif col == "age":
                row[col] = meta.get("age")
            elif col == "sex":
                row[col] = meta.get("sex")
            elif col == "test_time":
                row[col] = float(meta.get("test_time_days", 0.0))
            else:
                row[col] = 0.0

        if row.get("age") is None or row.get("sex") is None:
            raise ValueError(
                "Parkinson's UPDRS model requires age and sex in features or patient profile."
            )

        row["age"] = int(row["age"])
        row["sex"] = int(row["sex"])
        row["test_time"] = float(row.get("test_time", 0.0))

        X = pd.DataFrame([row], columns=self.feature_columns)
        motor_updrs = float(self.model.predict(X)[0])

        voice_feats = {k: float(row[k]) for k in OXFORD_VOICE_COLUMNS if k in row}
        severity = _updrs_to_severity(motor_updrs, self.scale)
        sub = _derive_sub_scores(voice_feats, severity)
        confidence = float(np.clip(0.95 - abs(motor_updrs - 25) / 100, 0.7, 0.95))

        bios = {
            "tremor": float(np.clip(voice_feats.get("Jitter(%)", 0) / 5, 0, 1)),
            "speech_rate": 0.5,
            "pause_patterns": 0.3,
            "pitch_variation": 0.4,
            "SIGNATURE_DETECTED": bool(voice_feats.get("Jitter(%)", 0) > 0.01),
        }
        signal_map = {
            "jitter": float(voice_feats.get("Jitter(%)", 0)),
            "shimmer": float(voice_feats.get("Shimmer", 0)),
            "hnr": float(voice_feats.get("HNR", 20)),
            "pitch_std": 0.4,
            "speech_rate": 0.5,
            "pause_count": 3,
            "avg_pause_len": 0.3,
        }
        lstm_row = build_lstm_row(row, motor_updrs)

        return {
            "severity": severity,
            "stage": severity_to_stage(severity),
            "confidence": confidence,
            "speech_score": sub["speech_score"],
            "breathlessness_score": sub["breathlessness_score"],
            "tremor_score": sub["tremor_score"],
            "health_score": int(np.clip(100 - severity, 0, 100)),
            "disease_score": severity / 100,
            "motor_updrs": motor_updrs,
            "prediction": _prediction_label(severity),
            "risk_level": _risk_level(severity),
            "biomarkers": bios,
            "duration": 0.0,
            "signature_detected": bool(bios.get("SIGNATURE_DETECTED", False)),
            "signals": signal_map,
            "oxford_features": voice_feats,
            "lstm_row": lstm_row,
            "model_source": "updrs_xgboost_manual",
        }

    def predict(self, audio_path: str, patient_meta: Optional[Dict[str, Any]] = None) -> dict:
        if not self.ready:
            raise FileNotFoundError(
                f"UPDRS model missing: {self.model_path}. "
                "Train with notebooks/parkinsons_xgboost.ipynb and export artifacts."
            )

        meta = patient_meta or {}
        age = meta.get("age")
        sex = meta.get("sex")
        if age is None or sex is None:
            raise ValueError(
                "Parkinson's UPDRS model requires age and sex in patient profile. "
                "Update Settings before recording."
            )

        test_time = float(meta.get("test_time_days", 0.0))
        row = build_updrs_feature_row(
            audio_path,
            age=int(age),
            sex=int(sex),
            test_time_days=test_time,
            feature_columns=self.feature_columns,
        )
        X = pd.DataFrame([row], columns=self.feature_columns)
        motor_updrs = float(self.model.predict(X)[0])

        voice_feats = {k: row[k] for k in OXFORD_VOICE_COLUMNS if k in row}
        severity = _updrs_to_severity(motor_updrs, self.scale)
        sub = _derive_sub_scores(voice_feats, severity)
        confidence = float(np.clip(0.95 - abs(motor_updrs - 25) / 100, 0.7, 0.95))

        try:
            librosa_data = extract_signal_features(audio_path)
            bios = get_disease_biomarkers(librosa_data["meta"], "Parkinson’s", librosa_data["signatures"])
            signal_map = build_signal_map(librosa_data["raw"])
            duration = librosa_data["duration"]
        except Exception:
            bios = {
                "tremor": float(np.clip(voice_feats.get("Jitter(%)", 0) / 5, 0, 1)),
                "speech_rate": 0.5,
                "SIGNATURE_DETECTED": False,
            }
            signal_map = {}
            duration = 0.0

        lstm_row = build_lstm_row(row, motor_updrs)

        return {
            "severity": severity,
            "stage": severity_to_stage(severity),
            "confidence": confidence,
            "speech_score": sub["speech_score"],
            "breathlessness_score": sub["breathlessness_score"],
            "tremor_score": sub["tremor_score"],
            "health_score": int(np.clip(100 - severity, 0, 100)),
            "disease_score": severity / 100,
            "motor_updrs": motor_updrs,
            "prediction": _prediction_label(severity),
            "risk_level": _risk_level(severity),
            "biomarkers": bios,
            "duration": duration,
            "signature_detected": bool(bios.get("SIGNATURE_DETECTED", False)),
            "signals": signal_map,
            "oxford_features": voice_feats,
            "lstm_row": lstm_row,
            "model_source": "updrs_xgboost",
        }
