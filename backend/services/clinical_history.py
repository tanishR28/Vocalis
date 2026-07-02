"""Clinical insight helpers for voice biomarker payloads (insights / reference — not LSTM/XGBoost inputs)."""

from __future__ import annotations

from typing import Any, Dict, Optional

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
