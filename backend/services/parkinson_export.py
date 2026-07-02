"""Export Parkinson history as Oxford telemonitoring CSV / Vocalis PDF."""

from __future__ import annotations

import csv
import io
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from services.lstm_history import (
    IMPORT_SOURCE,
    RECORDING_SOURCE,
    is_complete_lstm_row,
)

EXPORT_ROW_LIMIT = 30

EXPORT_CSV_COLUMNS = [
    "day",
    "subject#",
    "age",
    "sex",
    "test_time",
    "motor_UPDRS",
    "total_UPDRS",
    "Jitter(%)",
    "Jitter(Abs)",
    "Jitter:RAP",
    "Jitter:PPQ5",
    "Jitter:DDP",
    "Shimmer",
    "Shimmer(dB)",
    "Shimmer:APQ3",
    "Shimmer:APQ5",
    "Shimmer:APQ11",
    "Shimmer:DDA",
    "NHR",
    "HNR",
    "RPDE",
    "DFA",
    "PPE",
]

OXFORD_COLS = [
    "Jitter(%)",
    "Jitter(Abs)",
    "Jitter:RAP",
    "Jitter:PPQ5",
    "Jitter:DDP",
    "Shimmer",
    "Shimmer(dB)",
    "Shimmer:APQ3",
    "Shimmer:APQ5",
    "Shimmer:APQ11",
    "Shimmer:DDA",
    "NHR",
    "HNR",
    "RPDE",
    "DFA",
    "PPE",
]


def _estimate_total_updrs(motor: float, stored: Optional[float] = None) -> float:
    if stored is not None:
        try:
            return float(stored)
        except (TypeError, ValueError):
            pass
    return round(motor * 1.33, 4)


def _lstm_to_export_row(
    lstm_row: Dict[str, Any],
    day: int,
    *,
    age: int,
    sex: int,
    subject_id: int = 1,
    extras: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    extras = extras or {}
    motor = float(lstm_row["motor_UPDRS"])
    row: Dict[str, Any] = {
        "day": day,
        "subject#": int(extras.get("subject#", subject_id)),
        "age": int(age),
        "sex": int(sex),
        "test_time": float(extras.get("test_time", 4.36 + day * 0.0007)),
        "motor_UPDRS": motor,
        "total_UPDRS": _estimate_total_updrs(motor, extras.get("total_UPDRS")),
    }
    for col in OXFORD_COLS:
        row[col] = float(lstm_row[col])
    return row


def _fetch_supabase_export_entries(
    supabase,
    user_id: Optional[str] = None,
    limit: int = EXPORT_ROW_LIMIT,
) -> List[Dict[str, Any]]:
    entries: List[Dict[str, Any]] = []
    try:
        recording_query = (
            supabase.table("recordings")
            .select("id,recorded_at")
            .order("recorded_at", desc=False)
            .limit(max(limit * 3, 100))
        )
        if user_id:
            recording_query = recording_query.eq("user_id", user_id)
        recordings = recording_query.execute().data or []
        if not recordings:
            return []

        ids = [r["id"] for r in recordings if r.get("id")]
        biomarker_response = (
            supabase.table("biomarkers")
            .select("recording_id,raw_features")
            .in_("recording_id", ids)
            .execute()
        )
        bio_map = {b["recording_id"]: b for b in (biomarker_response.data or [])}

        for rec in recordings:
            bio = bio_map.get(rec["id"], {})
            raw = bio.get("raw_features") or {}
            lstm_row = raw.get("lstm_row")
            if not is_complete_lstm_row(lstm_row):
                continue
            extras = {
                "total_UPDRS": raw.get("total_UPDRS"),
                "test_time": raw.get("test_time"),
                "subject#": raw.get("subject#"),
                "day": raw.get("day"),
                "source": raw.get("source") or RECORDING_SOURCE,
            }
            entries.append({"lstm_row": dict(lstm_row), "extras": extras})
    except Exception:
        return []

    return entries[-limit:]


def fetch_export_history_entries(
    supabase,
    user_id: Optional[str] = None,
    limit: int = EXPORT_ROW_LIMIT,
) -> List[Dict[str, Any]]:
    """
    Last N chronological rows for export: older imported history + newer recordings.
  Example: 30-day import + 6 recordings → last 30 export rows = 24 import + 6 recorded.
    """
    if supabase is not None:
        return _fetch_supabase_export_entries(supabase, user_id=user_id, limit=limit)

    return []


def build_export_rows(
    entries: List[Dict[str, Any]],
    *,
    age: int,
    sex: int,
    subject_id: int = 1,
) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for index, entry in enumerate(entries):
        lstm_row = entry.get("lstm_row") or {}
        if not is_complete_lstm_row(lstm_row):
            continue
        day = index + 1
        extras = dict(entry.get("extras") or {})
        if extras.get("day") is not None:
            try:
                day = int(extras["day"])
            except (TypeError, ValueError):
                day = index + 1
        rows.append(
            _lstm_to_export_row(
                lstm_row,
                day,
                age=age,
                sex=sex,
                subject_id=subject_id,
                extras=extras,
            )
        )

    # Renumber to consecutive 1..N for import compatibility
    out: List[Dict[str, Any]] = []
    for idx, row in enumerate(rows):
        renumbered = dict(row)
        renumbered["day"] = idx + 1
        renumbered["age"] = int(age)
        renumbered["sex"] = int(sex)
        renumbered["subject#"] = int(subject_id)
        out.append(renumbered)
    return out


def render_export_csv(rows: List[Dict[str, Any]]) -> str:
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=EXPORT_CSV_COLUMNS, lineterminator="\n")
    writer.writeheader()
    for row in rows:
        writer.writerow({col: row.get(col, "") for col in EXPORT_CSV_COLUMNS})
    return buffer.getvalue()


def render_export_pdf(
    rows: List[Dict[str, Any]],
    *,
    subject_id: int,
    age: int,
    sex: int,
) -> bytes:
    from reportlab.lib.colors import darkblue
    from reportlab.lib.enums import TA_CENTER
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib.units import inch
    from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer

    buffer = io.BytesIO()
    styles = getSampleStyleSheet()
    title_style = styles["Heading1"]
    title_style.alignment = TA_CENTER
    title_style.textColor = darkblue
    heading = styles["Heading2"]
    normal = styles["BodyText"]

    doc = SimpleDocTemplate(
        buffer,
        rightMargin=25,
        leftMargin=25,
        topMargin=30,
        bottomMargin=30,
    )
    story: List[Any] = []
    gender = "Female" if int(sex) == 0 else "Male"

    story.append(Paragraph("Vocalis Parkinson's Disease Monitoring Report", title_style))
    story.append(Spacer(1, 20))
    story.append(Paragraph("<b>Patient Information</b>", heading))
    story.append(Paragraph(f"<b>Patient ID :</b> P{int(subject_id):03d}", normal))
    story.append(Paragraph(f"<b>Age :</b> {int(age)}", normal))
    story.append(Paragraph(f"<b>Gender :</b> {gender}", normal))
    story.append(Paragraph("<b>Disease :</b> Parkinson's Disease", normal))
    story.append(Paragraph(f"<b>Historical Records :</b> {len(rows)}", normal))
    story.append(PageBreak())

    records_per_page = 5
    pdf_fields = [
        ("Test Time", "test_time"),
        ("Motor UPDRS", "motor_UPDRS"),
        ("Total UPDRS", "total_UPDRS"),
        ("Jitter (%)", "Jitter(%)"),
        ("Jitter Abs", "Jitter(Abs)"),
        ("Jitter RAP", "Jitter:RAP"),
        ("Jitter PPQ5", "Jitter:PPQ5"),
        ("Jitter DDP", "Jitter:DDP"),
        ("Shimmer", "Shimmer"),
        ("Shimmer (dB)", "Shimmer(dB)"),
        ("Shimmer APQ3", "Shimmer:APQ3"),
        ("Shimmer APQ5", "Shimmer:APQ5"),
        ("Shimmer APQ11", "Shimmer:APQ11"),
        ("Shimmer DDA", "Shimmer:DDA"),
        ("NHR", "NHR"),
        ("HNR", "HNR"),
        ("RPDE", "RPDE"),
        ("DFA", "DFA"),
        ("PPE", "PPE"),
    ]

    for idx, row in enumerate(rows, start=1):
        if (idx - 1) % records_per_page == 0:
            end = min(idx + records_per_page - 1, len(rows))
            story.append(Paragraph(f"<b>Historical Records ({idx}-{end})</b>", heading))
            story.append(Spacer(1, 12))

        story.append(Paragraph(f"<b>Day {idx}</b>", heading))
        for label, key in pdf_fields:
            value = row.get(key, "")
            try:
                text = f"{round(float(value), 6)}"
            except (TypeError, ValueError):
                text = str(value)
            story.append(Paragraph(f"<b>{label}</b> : {text}", normal))
        story.append(Spacer(1, 15))
        if idx % records_per_page == 0 and idx != len(rows):
            story.append(PageBreak())

    doc.build(story)
    return buffer.getvalue()


def build_parkinson_history_export(
    supabase,
    *,
    age: int,
    sex: int,
    subject_id: int = 1,
    user_id: Optional[str] = None,
    limit: int = EXPORT_ROW_LIMIT,
) -> Tuple[List[Dict[str, Any]], str]:
    entries = fetch_export_history_entries(supabase, user_id=user_id, limit=limit)
    rows = build_export_rows(entries, age=age, sex=sex, subject_id=subject_id)
    timestamp = datetime.utcnow().strftime("%Y%m%d")
    filename = f"patient_{subject_id}_30_day_history_{timestamp}"
    return rows, filename
