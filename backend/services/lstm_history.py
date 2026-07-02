"""Fetch and validate Parkinson LSTM history rows from Supabase or local fallback."""

from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

ML_DIR = Path(__file__).resolve().parents[2] / "ML"
if str(ML_DIR) not in sys.path:
    sys.path.insert(0, str(ML_DIR))

from ml_config import load_lstm_feature_columns, lstm_sequence_length  # type: ignore

LOCAL_LSTM_PATH = Path(__file__).resolve().parents[1] / ".data" / "lstm_history.json"


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


def _load_local_store() -> Dict[str, List[Dict[str, Any]]]:
    if not LOCAL_LSTM_PATH.exists():
        return {}
    try:
        with open(LOCAL_LSTM_PATH, encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _save_local_store(data: Dict[str, List[Dict[str, Any]]]) -> None:
    LOCAL_LSTM_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(LOCAL_LSTM_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def save_local_lstm_history(
    rows: List[Dict[str, Any]],
    user_id: Optional[str] = None,
    *,
    replace: bool = False,
) -> int:
    """Persist lstm_row dicts locally when Supabase is unavailable."""
    valid = [dict(row) for row in rows if is_complete_lstm_row(row)]
    if not valid:
        return 0

    store = _load_local_store()
    key = _local_key(user_id)
    if replace:
        store[key] = valid
    else:
        store[key] = (store.get(key) or []) + valid

    _save_local_store(store)
    return len(valid)


def append_local_lstm_row(row: Dict[str, Any], user_id: Optional[str] = None) -> bool:
    if not is_complete_lstm_row(row):
        return False
    store = _load_local_store()
    key = _local_key(user_id)
    store[key] = (store.get(key) or []) + [dict(row)]
    _save_local_store(store)
    return True


def fetch_local_lstm_rows(user_id: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
    store = _load_local_store()
    rows = store.get(_local_key(user_id), [])
    if not isinstance(rows, list):
        return []
    valid = [dict(row) for row in rows if is_complete_lstm_row(row)]
    return valid[-limit:]


def fetch_all_complete_lstm_rows(
    supabase,
    user_id: Optional[str] = None,
    limit: int = 100,
) -> List[Dict[str, Any]]:
    """Return all complete lstm_rows in chronological order."""
    complete_rows: List[Dict[str, Any]] = []

    if supabase is not None:
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
            if recordings:
                ids = [r["id"] for r in recordings if r.get("id")]
                if ids:
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
                        lstm_row = raw.get("lstm_row")
                        if is_complete_lstm_row(lstm_row):
                            complete_rows.append(dict(lstm_row))
        except Exception:
            complete_rows = []

    if complete_rows:
        return complete_rows[-limit:]

    return fetch_local_lstm_rows(user_id=user_id, limit=limit)


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


def compute_forecast_trend(delta: float) -> str:
    if delta > 1:
        return "Worsening"
    if delta < -1:
        return "Improving"
    return "Stable"
