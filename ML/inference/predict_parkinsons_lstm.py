"""Parkinson's LSTM motor_UPDRS forecaster — singleton, loads model once."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ml_config import load_lstm_config, load_lstm_feature_columns, model_paths


def _inverse_motor_updrs(scaled_value: float, scaler, feature_columns: List[str]) -> float:
    idx = feature_columns.index("motor_UPDRS")
    data_min = float(scaler.data_min_[idx])
    data_max = float(scaler.data_max_[idx])
    return float(scaled_value * (data_max - data_min) + data_min)


def _validate_lstm_row(row: Dict[str, Any], feature_columns: List[str]) -> bool:
    for col in feature_columns:
        if col not in row or row[col] is None:
            return False
        try:
            if col in ("age", "sex"):
                int(row[col])
            else:
                float(row[col])
        except (TypeError, ValueError):
            return False
    return True


class ParkinsonLSTMForecaster:
    def __init__(self):
        paths = model_paths("parkinsons")
        self.model_path = paths["lstm"]
        self.scaler_path = paths["lstm_scaler"]
        self.features_path = paths["lstm_features"]
        self.config = load_lstm_config()
        self.feature_columns = load_lstm_feature_columns()
        self.sequence_length = int(self.config["sequence_length"])
        self.model = None
        self.scaler = None

        if self.model_path.exists():
            try:
                import tensorflow as tf  # noqa: F401
                from tensorflow.keras.models import load_model
                self.model = load_model(self.model_path)
            except Exception:
                self.model = None

        if self.scaler_path.exists():
            try:
                import joblib
                self.scaler = joblib.load(self.scaler_path)
            except Exception:
                self.scaler = None

        if self.features_path.exists():
            try:
                import joblib
                self.feature_columns = list(joblib.load(self.features_path))
            except Exception:
                pass

    @property
    def ready(self) -> bool:
        return self.model is not None and self.scaler is not None

    def forecast_parkinsons(self, history: List[Dict[str, Any]]) -> Dict[str, float]:
        """Predict future motor_UPDRS from chronological lstm_row history."""
        if not self.ready:
            raise FileNotFoundError(
                f"LSTM artifacts missing. Expected model at {self.model_path} "
                f"and scaler at {self.scaler_path}."
            )

        if len(history) != self.sequence_length:
            raise ValueError(
                f"LSTM requires exactly {self.sequence_length} history rows; got {len(history)}."
            )

        rows = []
        for entry in history:
            if not _validate_lstm_row(entry, self.feature_columns):
                raise ValueError("History row is missing required LSTM feature fields.")
            rows.append({col: float(entry[col]) if col not in ("age", "sex") else int(entry[col])
                           for col in self.feature_columns})

        df = pd.DataFrame(rows, columns=self.feature_columns)
        scaled = self.scaler.transform(df)
        X = scaled.reshape(1, self.sequence_length, len(self.feature_columns)).astype(np.float32)

        pred_scaled = float(self.model.predict(X, verbose=0)[0][0])
        predicted = _inverse_motor_updrs(pred_scaled, self.scaler, self.feature_columns)

        return {"predicted_motor_updrs": predicted}


_forecaster: Optional[ParkinsonLSTMForecaster] = None


def get_forecaster() -> ParkinsonLSTMForecaster:
    global _forecaster
    if _forecaster is None:
        _forecaster = ParkinsonLSTMForecaster()
    return _forecaster


def forecast_parkinsons(history: List[Dict[str, Any]]) -> Dict[str, float]:
    return get_forecaster().forecast_parkinsons(history)
