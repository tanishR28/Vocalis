"""Fetch and validate Parkinson LSTM history rows from Supabase."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

ML_DIR = Path(__file__).resolve().parents[2] / "ML"
if str(ML_DIR) not in sys.path:
    sys.path.insert(0, str(ML_DIR))

from ml_config import load_lstm_feature_columns, lstm_sequence_length  # type: ignore

IMPORT_SOURCE = "imported-medical-record"
RECORDING_SOURCE = "audio-analysis"

_INACTIVE_IMPORT_STATUS = {"active": False, "filename": None, "row_count": 0}


def is_complete_lstm_row(row: Optional[Dict[str, Any]]) -> bool:
    if not row or not isinstance(row, dict):
        return False
    for col in load_lstm_feature_columns():
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


def _fetch_supabase_lstm_rows(
    supabase,
    user_id: Optional[str] = None,
    limit: int = 100,
    *,
    include_imported: bool = False,
) -> List[Dict[str, Any]]:
    complete_rows: List[Dict[str, Any]] = []

    if supabase is None or not user_id:
        return []

    try:
        recording_query = (
            supabase.table("recordings")
            .select("id,recorded_at")
            .order("recorded_at", desc=False)
            .limit(limit)
        )
        recording_query = recording_query.eq("user_id", user_id)

        recordings = recording_query.execute().data or []
        if not recordings:
            return []

        ids = [r["id"] for r in recordings if r.get("id")]
        if not ids:
            return []

        biomarker_response = (
            supabase.table("biomarkers")
            .select("recording_id,raw_features,analyzed_at")
            .in_("recording_id", ids)
            .execute()
        )
        bio_map = {b["recording_id"]: b for b in (biomarker_response.data or [])}

        for rec in recordings:
            bio = bio_map.get(rec["id"], {})
            raw = bio.get("raw_features") or {}
            item_source = raw.get("source") or RECORDING_SOURCE
            if not include_imported and item_source == IMPORT_SOURCE:
                continue
            lstm_row = raw.get("lstm_row")
            if is_complete_lstm_row(lstm_row):
                complete_rows.append(dict(lstm_row))
    except Exception:
        return []

    return complete_rows[-limit:]


def _fetch_imported_biomarkers(
    supabase,
    user_id: Optional[str] = None,
) -> List[Dict[str, Any]]:
    if supabase is None or not user_id:
        return []

    try:
        biomarker_response = (
            supabase.table("biomarkers")
            .select("raw_features,analyzed_at")
            .eq("user_id", user_id)
            .order("analyzed_at", desc=True)
            .execute()
        )
        imported: List[Dict[str, Any]] = []
        for biomarker in biomarker_response.data or []:
            raw = biomarker.get("raw_features") or {}
            if raw.get("source") == IMPORT_SOURCE:
                imported.append(biomarker)
        return imported
    except Exception:
        return []


def get_import_status(supabase, user_id: Optional[str] = None) -> Dict[str, Any]:
    """Derive import status from Supabase biomarkers (no local state file)."""
    imported = _fetch_imported_biomarkers(supabase, user_id)
    if not imported:
        return dict(_INACTIVE_IMPORT_STATUS)

    filename = None
    for biomarker in imported:
        raw = biomarker.get("raw_features") or {}
        if raw.get("filename"):
            filename = raw.get("filename")
            break

    return {
        "active": True,
        "filename": filename,
        "row_count": len(imported),
    }


def is_import_active(supabase, user_id: Optional[str] = None) -> bool:
    return bool(get_import_status(supabase, user_id).get("active"))


def fetch_all_complete_lstm_rows(
    supabase,
    user_id: Optional[str] = None,
    limit: int = 100,
    *,
    include_imported: Optional[bool] = None,
) -> List[Dict[str, Any]]:
    """Return chronological lstm rows for forecasting (recordings + optional active import)."""
    if include_imported is None:
        include_imported = is_import_active(supabase, user_id)

    return _fetch_supabase_lstm_rows(
        supabase,
        user_id=user_id,
        limit=limit,
        include_imported=include_imported,
    )


def fetch_parkinsons_lstm_history(
    supabase,
    user_id: Optional[str] = None,
    limit: Optional[int] = None,
) -> Tuple[List[Dict[str, Any]], int]:
    """
    Return (chronological lstm_rows for last N sessions, total complete session count).
    """
    seq_len = lstm_sequence_length()
    fetch_limit = limit or max(seq_len * 3, 50)
    complete_rows = fetch_all_complete_lstm_rows(supabase, user_id=user_id, limit=fetch_limit)
    total = len(complete_rows)
    if total < seq_len:
        return [], total
    return complete_rows[-seq_len:], total


def delete_imported_supabase_records(
    supabase,
    user_id: Optional[str] = None,
    filename: Optional[str] = None,
) -> int:
    """Delete imported medical-record rows from Supabase; keep real audio analyses."""
    if supabase is None:
        return 0

    try:
        recording_query = supabase.table("recordings").select("id,notes").order("recorded_at", desc=False)
        if user_id:
            recording_query = recording_query.eq("user_id", user_id)
        recordings = recording_query.execute().data or []
        if not recordings:
            return 0

        ids = [r["id"] for r in recordings if r.get("id")]
        biomarker_response = (
            supabase.table("biomarkers")
            .select("id,recording_id,raw_features")
            .in_("recording_id", ids)
            .execute()
        )
        biomarkers = biomarker_response.data or []

        recording_ids_to_delete: List[str] = []

        for biomarker in biomarkers:
            raw = biomarker.get("raw_features") or {}
            if raw.get("source") != IMPORT_SOURCE:
                continue
            if filename and raw.get("filename") and raw.get("filename") != filename:
                continue
            recording_id = biomarker.get("recording_id")
            if recording_id:
                recording_ids_to_delete.append(recording_id)

        recording_ids_to_delete = list(dict.fromkeys(recording_ids_to_delete))
        if not recording_ids_to_delete:
            return 0

        supabase.table("biomarkers").delete().in_("recording_id", recording_ids_to_delete).execute()
        supabase.table("recordings").delete().in_("id", recording_ids_to_delete).execute()
        return len(recording_ids_to_delete)
    except Exception:
        return 0


def remove_imported_medical_history(
    supabase,
    user_id: Optional[str] = None,
    filename: Optional[str] = None,
) -> Dict[str, int]:
    """Clear imported rows from Supabase; recordings-only history remains."""
    db_removed = delete_imported_supabase_records(supabase, user_id=user_id, filename=filename)
    return {"db_records_removed": db_removed}


def compute_forecast_trend(delta: float) -> str:
    if delta > 1:
        return "Worsening"
    if delta < -1:
        return "Improving"
    return "Stable"
