"""Trend calculations — baseline, daily delta, weekly change."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional


def _parse_ts(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00").replace("+00:00", ""))
    except ValueError:
        return None


def _score_from_row(row: Dict[str, Any]) -> float:
    if row.get("health_score") is not None:
        return float(row["health_score"])
    severity = row.get("severity")
    if severity is not None:
        return float(100 - float(severity))
    return 0.0


def compute_baseline(history: List[Dict[str, Any]], days: int = 3) -> Optional[float]:
    if len(history) < days:
        return None
    first = history[:days]
    scores = [_score_from_row(h) for h in first]
    return sum(scores) / len(scores) if scores else None


def vs_yesterday(today_score: float, history: List[Dict[str, Any]]) -> Optional[float]:
    if len(history) < 1:
        return None
    yesterday = _score_from_row(history[0])
    return today_score - yesterday


def weekly_change_pct(today_score: float, history: List[Dict[str, Any]]) -> Optional[float]:
    if len(history) < 7:
        return None
    week_ago = _score_from_row(history[6])
    if week_ago == 0:
        return None
    return ((today_score - week_ago) / week_ago) * 100


def trend_label(weekly_pct: Optional[float], vs_base: Optional[float]) -> str:
    if weekly_pct is not None:
        if weekly_pct > 3:
            return "improving"
        if weekly_pct < -3:
            return "declining"
    if vs_base is not None:
        if vs_base > 2:
            return "improving"
        if vs_base < -2:
            return "declining"
    return "stable"


def risk_level(trend: str, health_score: float, severity: float) -> str:
    if trend == "declining" and (health_score < 50 or severity > 55):
        return "elevated"
    if health_score < 40 or severity > 65:
        return "elevated"
    if trend == "improving":
        return "low"
    return "moderate"
