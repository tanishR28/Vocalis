"""Monitoring engine — trends and alerts."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional

import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ml_config import BASELINE_DAYS
from monitoring.trend import (
    compute_baseline,
    vs_yesterday,
    weekly_change_pct,
    trend_label,
    risk_level,
)


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
        "forecast": None,
    }
