"""Fetch and validate Parkinson LSTM history rows from Supabase or local fallback."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

ML_DIR = Path(__file__).resolve().parents[2] / "ML"
if str(ML_DIR) not in sys.path:
    sys.path.insert(0, str(ML_DIR))

from ml_config import load_lstm_feature_columns, lstm_sequence_length  # type: ignore

LOCAL_LSTM_PATH = Path(__file__).resolve().parents[1] / ".data" / "lstm_history.json"
IMPORT_STATE_PATH = Path(__file__).resolve().parents[1] / ".data" / "import_state.json"

IMPORT_SOURCE = "imported-medical-record"
RECORDING_SOURCE = "audio-analysis"


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


def _local_key(user_id: Optional[str]) -> str:
    return user_id or "default"


def _empty_bucket() -> Dict[str, List[Dict[str, Any]]]:
    return {"recorded": [], "imported": []}


def _normalize_bucket(raw: Any) -> Dict[str, List[Dict[str, Any]]]:
    """Support legacy flat list (treated as imported) and structured buckets."""
    if isinstance(raw, dict) and ("recorded" in raw or "imported" in raw):
        recorded = [dict(row) for row in (raw.get("recorded") or []) if is_complete_lstm_row(row)]
        imported = [dict(row) for row in (raw.get("imported") or []) if is_complete_lstm_row(row)]
        return {"recorded": recorded, "imported": imported}
    if isinstance(raw, list):
        legacy = [dict(row) for row in raw if is_complete_lstm_row(row)]
        return {"recorded": [], "imported": legacy}
    return _empty_bucket()


def _load_local_store() -> Dict[str, Dict[str, List[Dict[str, Any]]]]:
    if not LOCAL_LSTM_PATH.exists():
        return {}
    try:
        with open(LOCAL_LSTM_PATH, encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict):
            return {}
        return {_local_key(k): _normalize_bucket(v) for k, v in data.items()}
    except Exception:
        return {}


def _save_local_store(data: Dict[str, Dict[str, List[Dict[str, Any]]]]) -> None:
    LOCAL_LSTM_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(LOCAL_LSTM_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def _load_import_state() -> Dict[str, Dict[str, Any]]:
    if not IMPORT_STATE_PATH.exists():
        return {}
    try:
        with open(IMPORT_STATE_PATH, encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _save_import_state(data: Dict[str, Dict[str, Any]]) -> None:
    IMPORT_STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(IMPORT_STATE_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def set_active_import(filename: Optional[str], row_count: int, user_id: Optional[str] = None) -> None:
    state = _load_import_state()
    key = _local_key(user_id)
    state[key] = {
        "filename": filename,
        "row_count": int(row_count),
        "active": True,
    }
    _save_import_state(state)


def clear_active_import(user_id: Optional[str] = None) -> None:
    state = _load_import_state()
    key = _local_key(user_id)
    if key in state:
        del state[key]
        _save_import_state(state)


def is_import_active(user_id: Optional[str] = None) -> bool:
    state = _load_import_state().get(_local_key(user_id), {})
    return bool(state.get("active"))


def save_local_lstm_history(
    rows: List[Dict[str, Any]],
    user_id: Optional[str] = None,
    *,
    replace: bool = False,
    source: str = "imported",
) -> int:
    """Persist imported lstm_row dicts locally (separate from user recordings)."""
    valid = [dict(row) for row in rows if is_complete_lstm_row(row)]
    if not valid:
        return 0

    store = _load_local_store()
    key = _local_key(user_id)
    bucket = store.get(key) or _empty_bucket()

    if source == "imported":
        bucket["imported"] = valid if replace else (bucket.get("imported") or []) + valid
    else:
        bucket["recorded"] = (bucket.get("recorded") or []) + valid

    store[key] = bucket
    _save_local_store(store)
    return len(valid)


def append_local_lstm_row(row: Dict[str, Any], user_id: Optional[str] = None) -> bool:
    if not is_complete_lstm_row(row):
        return False
    store = _load_local_store()
    key = _local_key(user_id)
    bucket = store.get(key) or _empty_bucket()
    bucket["recorded"] = (bucket.get("recorded") or []) + [dict(row)]
    store[key] = bucket
    _save_local_store(store)
    return True


def clear_imported_lstm_history(user_id: Optional[str] = None) -> int:
    """Remove imported rows from local LSTM store; keep user recordings."""
    store = _load_local_store()
    key = _local_key(user_id)
    bucket = store.get(key) or _empty_bucket()
    removed = len(bucket.get("imported") or [])
    bucket["imported"] = []
    store[key] = bucket
    _save_local_store(store)
    clear_active_import(user_id)
    return removed


def fetch_local_lstm_rows(
    user_id: Optional[str] = None,
    limit: int = 100,
    *,
    include_imported: bool = False,
) -> List[Dict[str, Any]]:
    store = _load_local_store()
    bucket = store.get(_local_key(user_id)) or _empty_bucket()
    imported = list(bucket.get("imported") or [])
    recorded = list(bucket.get("recorded") or [])
    if include_imported:
        rows = imported + recorded
    else:
        rows = recorded
    valid = [dict(row) for row in rows if is_complete_lstm_row(row)]
    return valid[-limit:]


def _fetch_supabase_lstm_rows(
    supabase,
    user_id: Optional[str] = None,
    limit: int = 100,
    *,
    include_imported: bool = False,
) -> List[Dict[str, Any]]:
    complete_rows: List[Dict[str, Any]] = []

    try:
        recording_query = (
            supabase.table("recordings")
            .select("id,recorded_at")
            .order("recorded_at", desc=False)
            .limit(limit)
        )
        if user_id:
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


def fetch_all_complete_lstm_rows(
    supabase,
    user_id: Optional[str] = None,
    limit: int = 100,
    *,
    include_imported: Optional[bool] = None,
) -> List[Dict[str, Any]]:
    """Return chronological lstm rows for forecasting (recordings + optional active import)."""
    if include_imported is None:
        include_imported = is_import_active(user_id)

    if supabase is not None:
        supabase_rows = _fetch_supabase_lstm_rows(
            supabase,
            user_id=user_id,
            limit=limit,
            include_imported=include_imported,
        )
        if supabase_rows:
            return supabase_rows

    return fetch_local_lstm_rows(
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
        biomarker_ids_to_delete: List[str] = []

        for biomarker in biomarkers:
            raw = biomarker.get("raw_features") or {}
            if raw.get("source") != IMPORT_SOURCE:
                continue
            if filename and raw.get("filename") and raw.get("filename") != filename:
                continue
            recording_id = biomarker.get("recording_id")
            if recording_id:
                recording_ids_to_delete.append(recording_id)
            if biomarker.get("id"):
                biomarker_ids_to_delete.append(biomarker["id"])

        recording_ids_to_delete = list(dict.fromkeys(recording_ids_to_delete))
        if not recording_ids_to_delete:
            return 0

        if biomarker_ids_to_delete:
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
    """Clear imported LSTM rows and DB records; recordings-only history remains."""
    local_removed = clear_imported_lstm_history(user_id)
    db_removed = delete_imported_supabase_records(supabase, user_id=user_id, filename=filename)
    return {"local_import_rows_removed": local_removed, "db_records_removed": db_removed}


def compute_forecast_trend(delta: float) -> str:
    if delta > 1:
        return "Worsening"
    if delta < -1:
        return "Improving"
    return "Stable"
