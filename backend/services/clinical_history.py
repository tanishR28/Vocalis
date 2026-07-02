"""Local persistence for clinical voice biomarkers (insights / reference — not LSTM/XGBoost inputs)."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from json_safe import json_safe

RECORDING_SOURCE = "audio-analysis"
IMPORT_SOURCE = "imported-medical-record"

CLINICAL_SESSIONS_PATH = Path(__file__).resolve().parents[1] / ".data" / "clinical_sessions.json"

CLINICAL_INSIGHT_DEFINITIONS = (
    {
        "id": "voice_tremor",
        "name": "Voice Tremors",
        "description": "Detection of micro-oscillations in frequency/amplitude.",
    },
    {
        "id": "breathlessness",
        "name": "Breathlessness",
        "description": "Analysis of intake gasps and phrase length.",
    },
    {
        "id": "pitch_variation",
        "name": "Pitch Variation",
        "description": "Monitoring monotonic speech or erratic fluctuations.",
    },
    {
        "id": "speech_rate",
        "name": "Speech Rate",
        "description": "Tracking cognitive load and neurological responses.",
    },
    {
        "id": "pause_patterns",
        "name": "Pause Patterns",
        "description": "Identifying abnormal gaps in verbal articulation.",
    },
)


def _local_key(user_id: Optional[str]) -> str:
    return user_id or "default"


def _load_store() -> Dict[str, List[Dict[str, Any]]]:
    if not CLINICAL_SESSIONS_PATH.exists():
        return {}
    try:
        with open(CLINICAL_SESSIONS_PATH, encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict):
            return {}
        return {str(k): list(v) if isinstance(v, list) else [] for k, v in data.items()}
    except Exception:
        return {}


def _save_store(data: Dict[str, List[Dict[str, Any]]]) -> None:
    CLINICAL_SESSIONS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(CLINICAL_SESSIONS_PATH, "w", encoding="utf-8") as f:
        json.dump(json_safe(data), f, indent=2)


def build_clinical_insights(
    biomarkers: Dict[str, Any],
    signals: Dict[str, Any],
    scores: Dict[str, Any],
    report: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Structured clinical reference metrics — stored for insights, not fed to LSTM/XGBoost."""
    report = report or {}
    tremor_raw = float(biomarkers.get("tremor") if biomarkers.get("tremor") is not None else scores.get("tremor_score", 0))
    breath_raw = float(
        biomarkers.get("breathlessness")
        if biomarkers.get("breathlessness") is not None
        else scores.get("breathlessness_score", 0)
    )
    pitch_var_raw = float(
        biomarkers.get("pitch_variation")
        if biomarkers.get("pitch_variation") is not None
        else scores.get("pitch_variation", 0)
    )
    speech_raw = float(
        biomarkers.get("speech_rate")
        if biomarkers.get("speech_rate") is not None
        else scores.get("speech_rate", 0)
    )
    pause_raw = float(
        biomarkers.get("pause_patterns")
        if biomarkers.get("pause_patterns") is not None
        else scores.get("pause_score", 0)
    )

    return {
        "voice_tremor": {
            "score": float(report.get("tremor_score", tremor_raw * 100 if tremor_raw <= 1 else tremor_raw)),
            "raw_value": tremor_raw,
            "signature_detected": bool(biomarkers.get("SIGNATURE_DETECTED", report.get("signature_detected"))),
            "jitter": float(scores.get("jitter", signals.get("jitter", 0)) or 0),
            "shimmer": float(scores.get("shimmer", signals.get("shimmer", 0)) or 0),
        },
        "breathlessness": {
            "score": float(report.get("breathlessness_score", breath_raw * 100 if breath_raw <= 1 else breath_raw)),
            "raw_value": breath_raw,
            "hnr": float(scores.get("hnr", signals.get("hnr", 0)) or 0),
        },
        "pitch_variation": {
            "score": float(scores.get("pitch_variation", 0) or 0),
            "raw_value": pitch_var_raw,
            "pitch_mean_hz": float(scores.get("pitch_mean", signals.get("pitch_mean", 0)) or 0),
        },
        "speech_rate": {
            "score": float(report.get("speech_score", speech_raw * 100 if speech_raw <= 1 else speech_raw)),
            "raw_value": speech_raw,
            "model_subscore": float(report.get("speech_score", 0) or 0),
        },
        "pause_patterns": {
            "score": float(pause_raw * 100 if pause_raw <= 1 else pause_raw),
            "raw_value": pause_raw,
            "pause_count": int(scores.get("pause_count", signals.get("pause_count", 0)) or 0),
            "pause_duration_avg": float(
                scores.get("pause_duration_avg", signals.get("avg_pause_len", 0)) or 0
            ),
        },
        "insight_source": report.get("model_source", "acoustic_analysis"),
        "used_by_ml_models": False,
    }


def save_clinical_session(
    *,
    user_id: Optional[str],
    recording_id: str,
    disease: str,
    duration: float,
    analyzed_at_iso: str,
    health_score: float,
    health_category: str,
    report: Dict[str, Any],
    signals: Dict[str, Any],
    scores: Dict[str, Any],
    clinical_insights: Dict[str, Any],
) -> None:
    """Persist a voice recording's clinical biomarkers locally (always, even if Supabase is offline)."""
    biomarkers = report.get("biomarkers") or {}
    session = {
        "id": recording_id,
        "recording_id": recording_id,
        "title": f"Voice assessment — {disease}",
        "timestamp": analyzed_at_iso,
        "health_score": {"score": float(health_score), "category": health_category},
        "recording": {
            "id": recording_id,
            "duration": float(duration),
            "status": "analyzed",
            "recorded_at": analyzed_at_iso,
        },
        "biomarkers": {
            "tremor_score": float(scores.get("tremor_score", 0)),
            "breathlessness_score": float(scores.get("breathlessness_score", 0)),
            "pitch_mean": float(scores.get("pitch_mean", 0)),
            "pitch_variation": float(scores.get("pitch_variation", 0)),
            "speech_rate": float(scores.get("speech_rate", 0)),
            "pause_count": int(scores.get("pause_count", 0)),
            "pause_duration_avg": float(scores.get("pause_duration_avg", 0)),
            "hnr": float(scores.get("hnr", 0)),
            "jitter": float(scores.get("jitter", 0)),
            "shimmer": float(scores.get("shimmer", 0)),
            "health_score": float(health_score),
            "health_category": health_category,
            "confidence": float(report.get("confidence", 0)),
            "raw_features": {
                "source": RECORDING_SOURCE,
                "signals": signals,
                "biomarkers": biomarkers,
                "clinical_insights": clinical_insights,
                "prediction": report.get("prediction"),
                "severity": report.get("severity"),
                "stage": report.get("stage"),
                "motor_updrs": report.get("motor_updrs"),
                "lstm_row": report.get("lstm_row"),
                "model_source": report.get("model_source"),
            },
            "analyzed_at": analyzed_at_iso,
        },
        "source": RECORDING_SOURCE,
        "saved_at": datetime.utcnow().isoformat(),
    }

    store = _load_store()
    key = _local_key(user_id)
    sessions = store.get(key) or []
    sessions = [s for s in sessions if s.get("recording_id") != recording_id]
    sessions.append(session)
    sessions.sort(key=lambda row: row.get("timestamp") or "", reverse=True)
    store[key] = sessions[:200]
    _save_store(store)


def fetch_clinical_history_items(
    user_id: Optional[str] = None,
    limit: int = 60,
) -> List[Dict[str, Any]]:
    store = _load_store()
    sessions = list(store.get(_local_key(user_id)) or [])
    sessions.sort(key=lambda row: row.get("timestamp") or "", reverse=True)
    return sessions[: max(1, min(limit, 100))]


def merge_local_history_items(
    lstm_items: List[Dict[str, Any]],
    clinical_items: List[Dict[str, Any]],
    *,
    source: str = "all",
    limit: int = 60,
) -> List[Dict[str, Any]]:
    """Combine imported LSTM timeline + recorded clinical sessions without duplicates."""
    if source == "imported":
        merged = [item for item in lstm_items if item.get("source") == IMPORT_SOURCE]
    elif source == "audio":
        merged = list(clinical_items)
        if not merged:
            merged = [item for item in lstm_items if item.get("source") == RECORDING_SOURCE]
    else:
        imported = [item for item in lstm_items if item.get("source") == IMPORT_SOURCE]
        recorded_ids = {item.get("recording_id") or item.get("id") for item in clinical_items}
        lstm_recorded_fallback = [
            item
            for item in lstm_items
            if item.get("source") == RECORDING_SOURCE and (item.get("id") not in recorded_ids)
        ]
        merged = imported + clinical_items + lstm_recorded_fallback

    merged.sort(key=lambda row: row.get("timestamp") or "", reverse=True)
    return merged[: max(1, min(limit, 100))]
