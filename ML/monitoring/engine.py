"""Monitoring engine — trends, alerts, Parkinson LSTM forecast."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np

import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ml_config import LSTM_MIN_DAYS, BASELINE_DAYS, model_paths
from monitoring.trend import (
    compute_baseline,
    vs_yesterday,
    weekly_change_pct,
    trend_label,
    risk_level,
)


def _lstm_forecast(history: List[Dict[str, Any]]) -> Optional[Dict[str, float]]:
    lstm_path = model_paths("parkinsons")["lstm"]
    if not lstm_path.exists() or len(history) < LSTM_MIN_DAYS:
        return None
    try:
        import tensorflow as tf
    except ImportError:
        return None

    try:
        model = tf.keras.models.load_model(lstm_path)
        seq_rows = history[:LSTM_MIN_DAYS][::-1]
        features = []
        for row in seq_rows:
            bio = row.get("biomarkers") or row.get("raw_features", {}).get("biomarkers") or {}
            sig = row.get("signals") or row.get("raw_features", {}).get("signals") or {}
            severity = float(row.get("severity") or (100 - float(row.get("health_score", 50))))
            speech = float(row.get("speech_score") or (100 - severity))
            tremor = float(row.get("tremor_score") or bio.get("tremor", 0) * 100)
            features.append([
                float(sig.get("pitch_mean", row.get("pitch_mean", 150))),
                float(sig.get("jitter", row.get("jitter", 0.01))),
                float(sig.get("shimmer", row.get("shimmer", 0.1))),
                float(bio.get("speech_rate", sig.get("speech_rate", row.get("speech_rate", 0.5)))),
                severity,
                speech,
                tremor,
                tremor * 0.5,
            ])

        X = np.array([features], dtype=np.float32)
        preds = model.predict(X, verbose=0)[0]
        return {
            "severity_7d": float(np.clip(preds[0], 0, 100)),
            "severity_30d": float(np.clip(preds[1], 0, 100)),
            "deterioration_risk": float(np.clip(preds[2], 0, 1)),
            "stability_score": float(np.clip(preds[3], 0, 1)),
        }
    except Exception:
        return None


def build_alerts(
    trend: str,
    risk: str,
    health_score: float,
    severity: float,
    vs_base: Optional[float],
) -> List[Dict[str, Any]]:
    alerts = []
    if risk == "elevated":
        alerts.append({
            "alert_type": "threshold",
            "severity": "high" if health_score < 40 else "medium",
            "message": "Voice health score is below clinical comfort range.",
            "biomarker": "health_score",
        })
    if trend == "declining" and vs_base is not None and vs_base < -5:
        alerts.append({
            "alert_type": "trend_decline",
            "severity": "medium",
            "message": f"Health score dropped {abs(vs_base):.0f} points vs baseline.",
            "biomarker": "health_score",
        })
    if severity > 70:
        alerts.append({
            "alert_type": "anomaly",
            "severity": "critical",
            "message": "Severity crossed high-risk threshold.",
            "biomarker": "severity",
        })
    return alerts


def analyze_trends(
    today: Dict[str, Any],
    history: List[Dict[str, Any]],
    condition_key: str = "parkinsons",
) -> Dict[str, Any]:
    """Compute monitoring outputs for today's analysis vs prior history."""
    health_score = float(today.get("health_score", 0))
    severity = float(today.get("severity", 100 - health_score))

    baseline = compute_baseline(history, BASELINE_DAYS)
    vy = vs_yesterday(health_score, history)
    weekly = weekly_change_pct(health_score, history)
    vs_base = (health_score - baseline) if baseline is not None else None
    trend = trend_label(weekly, vs_base)
    risk = risk_level(trend, health_score, severity)
    alerts = build_alerts(trend, risk, health_score, severity, vs_base)

    forecast = None
    if condition_key == "parkinsons":
        forecast = _lstm_forecast(history)

    return {
        "baseline": baseline,
        "vs_yesterday": vy,
        "vs_baseline": vs_base,
        "weekly_change_pct": weekly,
        "trend": trend,
        "risk": risk,
        "alert": bool(alerts),
        "alerts": alerts,
        "baseline_ready": baseline is not None,
        "weekly_ready": weekly is not None,
        "forecast": forecast,
    }
