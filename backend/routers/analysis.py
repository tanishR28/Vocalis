"""
Analysis Router
API endpoints for voice biomarker analysis.
"""

import os
import re
import sys
import json
import csv
import uuid
import shutil
import tempfile
import traceback
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from dotenv import load_dotenv
from fastapi import APIRouter, File, Form, Header, Query, UploadFile
from fastapi.responses import JSONResponse, Response
from supabase import Client, create_client

from config import ML_DIR
from services.lstm_history import (
    is_complete_lstm_row,
    remove_imported_medical_history,
    get_import_status,
)
from services.clinical_history import build_clinical_insights
from services.parkinson_export import (
    build_parkinson_history_export,
    render_export_csv,
    render_export_pdf,
)
from auth import resolve_user_id
from json_safe import json_safe
from models.schemas import AnalysisResponse, ManualAnalysisRequest

router = APIRouter(prefix="/api", tags=["analysis"])

ml_model_dir = str(ML_DIR)
if ml_model_dir not in sys.path:
    sys.path.insert(0, ml_model_dir)

try:
    from inference.router import predict_voice, predict_voice_manual  # type: ignore
except ImportError as import_error:
    print(f"[ERROR] Failed to import ML router from {ml_model_dir}: {import_error}")
    predict_voice = None
    predict_voice_manual = None

from services.trend_engine import compute_trends
from models.schemas import TrendInfo


supabase: Optional[Client] = None
SUPABASE_NOT_CONFIGURED_ERROR = (
    "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env"
)
SUPABASE_INIT_ERROR: Optional[str] = None

# Ensure backend/.env is loaded even if this module is imported directly.
_backend_env = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(dotenv_path=_backend_env)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    except Exception as supabase_init_error:
        SUPABASE_INIT_ERROR = str(supabase_init_error)
        print(f"[ERROR] Failed to initialize Supabase client: {supabase_init_error}")


def _supabase_unavailable_error() -> str:
    if SUPABASE_INIT_ERROR:
        return (
            "Supabase initialization failed. "
            "Check SUPABASE_SERVICE_ROLE_KEY value/type in backend/.env. "
            f"Details: {SUPABASE_INIT_ERROR}"
        )
    return SUPABASE_NOT_CONFIGURED_ERROR


DOCUMENT_CONDITION_KEYWORDS = {
    "Asthma": ["asthma", "wheezing", "bronchodilator", "shortness of breath", "inhaler"],
    "Parkinson's": ["parkinson", "bradykinesia", "tremor", "rigidity", "dopamin", "micrographia"],
    "Depression": ["depression", "depressed", "low mood", "anhedonia", "antidepressant", "sadness"],
}


def _is_parkinson_csv_upload(filename: Optional[str], content_type: Optional[str]) -> bool:
    lower_name = (filename or "").lower()
    if lower_name.endswith(".csv"):
        return True
    return content_type in ("text/csv", "application/csv", "application/vnd.ms-excel")


def _coerce_csv_value(key: str, value: str) -> Any:
    text = str(value).strip()
    if text == "":
        return None
    try:
        if key in ("age", "sex", "day") or key == "subject#":
            return int(float(text))
        return float(text)
    except (TypeError, ValueError):
        return text


def _parse_parkinson_history_csv(
    file_path: str,
    default_age: Optional[int] = None,
    default_sex: Optional[int] = None,
) -> Dict[str, Any]:
    """Parse Oxford telemonitoring CSV exports (e.g. patient_N_30_day_history.csv)."""
    rows_out: list[dict[str, Any]] = []
    subject_id: Optional[int] = None
    patient_age = default_age
    patient_sex = default_sex

    with open(file_path, newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames:
            raise ValueError("CSV has no header row.")

        fields = {name.strip() for name in reader.fieldnames if name}
        if "motor_UPDRS" not in fields:
            raise ValueError(
                "CSV must include motor_UPDRS and Oxford voice columns "
                "(see create_patient_report_csv.py output format)."
            )

        for index, raw_row in enumerate(reader):
            parsed: dict[str, Any] = {}
            for key, value in raw_row.items():
                if not key:
                    continue
                col = key.strip()
                coerced = _coerce_csv_value(col, value or "")
                if coerced is not None:
                    parsed[col] = coerced

            if subject_id is None and parsed.get("subject#") is not None:
                try:
                    subject_id = int(parsed["subject#"])
                except (TypeError, ValueError):
                    pass

            lstm_row = _normalize_lstm_import_row(parsed, patient_age, patient_sex)
            if not lstm_row:
                continue

            day_val = parsed.get("day", index + 1)
            try:
                day_num = int(day_val)
            except (TypeError, ValueError):
                day_num = index + 1

            motor = float(lstm_row["motor_UPDRS"])
            rows_out.append(
                {
                    "day": day_num,
                    "breath_score": 0.0,
                    "pause_score": 0.0,
                    "speech_rate": 0.0,
                    "health_score": max(0, min(100, int(100 - motor * 2.5))),
                    "lstm_row": lstm_row,
                    "total_UPDRS": parsed.get("total_UPDRS"),
                    "test_time": parsed.get("test_time"),
                    "subject#": parsed.get("subject#"),
                }
            )

    rows_out.sort(key=lambda item: item["day"])

    patient_name = f"P{subject_id:03d}" if subject_id is not None else None
    return {
        "patient_name": patient_name,
        "disease": "Parkinson's Disease",
        "final_health_score": None,
        "final_health_status": None,
        "rows": rows_out,
    }


def _extract_text_from_document(file_path: str, filename: str, content_type: Optional[str]) -> Tuple[str, str]:
    lower_name = filename.lower()
    is_pdf = lower_name.endswith(".pdf") or content_type == "application/pdf"

    if is_pdf:
        try:
            from pypdf import PdfReader  # type: ignore

            reader = PdfReader(file_path)
            pages = []
            for page in reader.pages:
                extracted = page.extract_text() or ""
                if extracted.strip():
                    pages.append(extracted)
            return "\n".join(pages).strip(), "pdf"
        except Exception as pdf_error:
            raise RuntimeError(f"Failed to read PDF text: {pdf_error}") from pdf_error

    try:
        import easyocr  # type: ignore

        reader = easyocr.Reader(["en"], gpu=False, verbose=False)
        lines = reader.readtext(file_path, detail=0, paragraph=True)
        text = "\n".join(line.strip() for line in lines if str(line).strip()).strip()
        return text, "image"
    except Exception as ocr_error:
        raise RuntimeError(f"Failed to read image text: {ocr_error}") from ocr_error


def _detect_conditions_from_text(text: str) -> list[dict[str, Any]]:
    lowered = text.lower()
    detections: list[dict[str, Any]] = []

    for condition, keywords in DOCUMENT_CONDITION_KEYWORDS.items():
        matched_keywords = [keyword for keyword in keywords if keyword in lowered]
        if matched_keywords:
            detections.append(
                {
                    "condition": condition,
                    "matched_keywords": matched_keywords,
                    "confidence": min(0.95, 0.35 + 0.15 * len(matched_keywords)),
                }
            )

    detections.sort(key=lambda item: item["confidence"], reverse=True)
    return detections


def _summarize_medical_text(text: str, detections: list[dict[str, Any]]) -> str:
    if not text.strip():
        return "No readable text was found in the uploaded page."

    first_lines = [line.strip() for line in text.splitlines() if line.strip()][:3]
    summary_parts = []
    if detections:
        top_conditions = ", ".join(item["condition"] for item in detections[:3])
        summary_parts.append(f"Possible conditions mentioned: {top_conditions}.")
    else:
        summary_parts.append("No clear condition keyword was detected automatically.")

    if first_lines:
        summary_parts.append(f"Text sample: {first_lines[0][:180]}")

    return " ".join(summary_parts)


def _health_category_from_score(score: float) -> str:
    if score >= 80:
        return "Stable"
    if score >= 60:
        return "Normal"
    if score >= 40:
        return "Moderate"
    return "Warning"


VOCALIS_PDF_FIELD_MAP = {
    "motor updrs": "motor_UPDRS",
    "jitter (%)": "Jitter(%)",
    "jitter abs": "Jitter(Abs)",
    "jitter rap": "Jitter:RAP",
    "jitter ppq5": "Jitter:PPQ5",
    "jitter ddp": "Jitter:DDP",
    "shimmer": "Shimmer",
    "shimmer (db)": "Shimmer(dB)",
    "shimmer apq3": "Shimmer:APQ3",
    "shimmer apq5": "Shimmer:APQ5",
    "shimmer apq11": "Shimmer:APQ11",
    "shimmer dda": "Shimmer:DDA",
    "nhr": "NHR",
    "hnr": "HNR",
    "rpde": "RPDE",
    "dfa": "DFA",
    "ppe": "PPE",
}


def _parse_vocalis_report_header(text: str) -> Tuple[Optional[int], Optional[int], Optional[str]]:
    age_match = re.search(r"Age\s*:\s*([\d.]+)", text, flags=re.IGNORECASE)
    gender_match = re.search(r"Gender\s*:\s*(Male|Female)", text, flags=re.IGNORECASE)
    patient_id_match = re.search(r"Patient\s+ID\s*:\s*(\S+)", text, flags=re.IGNORECASE)

    age = None
    if age_match:
        try:
            age = int(float(age_match.group(1)))
        except (TypeError, ValueError):
            age = None

    sex = None
    if gender_match:
        sex = 1 if gender_match.group(1).lower() == "male" else 0

    patient_name = patient_id_match.group(1).strip() if patient_id_match else None
    return age, sex, patient_name


def _extract_report_demographics(
    file_path: str,
    filename: str,
    content_type: Optional[str],
) -> Tuple[Optional[int], Optional[int]]:
    """Read age/sex embedded in an import file (CSV header row or Vocalis PDF)."""
    lower_name = (filename or "").lower()
    if lower_name.endswith(".csv") or content_type in ("text/csv", "application/csv", "application/vnd.ms-excel"):
        with open(file_path, newline="", encoding="utf-8-sig") as handle:
            reader = csv.DictReader(handle)
            for raw_row in reader:
                parsed: dict[str, Any] = {}
                for key, value in (raw_row or {}).items():
                    if not key:
                        continue
                    col = key.strip()
                    coerced = _coerce_csv_value(col, value or "")
                    if coerced is not None:
                        parsed[col] = coerced
                age = parsed.get("age")
                sex = parsed.get("sex")
                try:
                    age_val = int(age) if age is not None else None
                except (TypeError, ValueError):
                    age_val = None
                try:
                    sex_val = int(sex) if sex is not None else None
                except (TypeError, ValueError):
                    sex_val = None
                if age_val is not None or sex_val is not None:
                    return age_val, sex_val
        return None, None

    extracted_text, _ = _extract_text_from_document(file_path, filename, content_type)
    if extracted_text:
        header_age, header_sex, _ = _parse_vocalis_report_header(extracted_text)
        return header_age, header_sex
    return None, None


def _parse_vocalis_day_block(day_text: str) -> dict[str, Any]:
    raw: dict[str, Any] = {}
    for line in day_text.splitlines():
        line = line.strip()
        if not line or line.lower().startswith("day "):
            continue
        if ":" not in line:
            continue
        label, value = line.split(":", 1)
        key = re.sub(r"\s+", " ", label.strip().lower())
        mapped = VOCALIS_PDF_FIELD_MAP.get(key)
        if not mapped:
            continue
        value = value.strip()
        try:
            raw[mapped] = float(value)
        except ValueError:
            continue
    return raw


def _parse_vocalis_parkinson_report(
    text: str,
    default_age: Optional[int] = None,
    default_sex: Optional[int] = None,
) -> list[dict[str, Any]]:
    """
    Parse Vocalis Parkinson PDF reports (Day N + labeled biomarker fields).
    Also accepts legacy VoiceAI-branded exports for backward compatibility.
    Returns import rows with lstm_row when all 19 LSTM features are present.
    """
    is_vocalis_report = "Vocalis Parkinson" in text or "Vocalis Parkinson's" in text
    is_legacy_report = "VoiceAI Parkinson" in text
    if not is_vocalis_report and not is_legacy_report and "Motor UPDRS" not in text:
        return []

    header_age, header_sex, patient_name = _parse_vocalis_report_header(text)
    age = default_age if default_age is not None else header_age
    sex = default_sex if default_sex is not None else header_sex

    day_pattern = re.compile(
        r"Day\s+(\d+)\s*\n(.*?)(?=\nDay\s+\d+\s*\n|\nHistorical Records|\Z)",
        flags=re.IGNORECASE | re.DOTALL,
    )

    rows: list[dict[str, Any]] = []
    for match in day_pattern.finditer(text):
        day_num = int(match.group(1))
        block = match.group(2)
        raw = _parse_vocalis_day_block(block)
        if age is not None:
            raw["age"] = age
        if sex is not None:
            raw["sex"] = sex

        lstm_row = _normalize_lstm_import_row(raw, age, sex)
        if not lstm_row:
            continue

        motor = float(lstm_row["motor_UPDRS"])
        rows.append(
            {
                "day": day_num,
                "breath_score": 0.0,
                "pause_score": 0.0,
                "speech_rate": 0.0,
                "health_score": max(0, min(100, int(100 - motor * 2.5))),
                "lstm_row": lstm_row,
                "patient_name": patient_name,
            }
        )

    rows.sort(key=lambda item: item["day"])
    return rows


def _parse_lstm_json_rows(text: str) -> list[dict[str, Any]]:
    """Extract JSON array/object blocks containing motor_UPDRS for LSTM history."""
    rows: list[dict[str, Any]] = []
    for match in re.finditer(r"\[[\s\S]*?\]", text):
        snippet = match.group(0)
        if "motor_UPDRS" not in snippet and "motor_updrs" not in snippet:
            continue
        try:
            data = json.loads(snippet)
        except json.JSONDecodeError:
            continue
        if isinstance(data, list):
            for item in data:
                if isinstance(item, dict):
                    rows.append(item)
        elif isinstance(data, dict):
            rows.append(data)
    return rows


def _normalize_lstm_import_row(raw: dict[str, Any], default_age: Optional[int], default_sex: Optional[int]) -> Optional[dict[str, Any]]:
    """Normalize imported dict keys to LSTM column names."""
    if ml_model_dir not in sys.path:
        sys.path.insert(0, ml_model_dir)
    try:
        from ml_config import load_lstm_feature_columns  # type: ignore
        columns = load_lstm_feature_columns()
    except Exception:
        return None

    normalized: dict[str, Any] = {}
    key_aliases = {
        "motor_updrs": "motor_UPDRS",
        "Motor_UPDRS": "motor_UPDRS",
        "jitter(%)": "Jitter(%)",
    }
    for key, value in raw.items():
        mapped = key_aliases.get(key, key)
        normalized[mapped] = value

    if default_age is not None:
        normalized["age"] = default_age
    elif "age" not in normalized:
        pass
    if default_sex is not None:
        normalized["sex"] = default_sex
    elif "sex" not in normalized:
        pass

    if not is_complete_lstm_row(normalized):
        return None

    result: dict[str, Any] = {}
    for col in columns:
        result[col] = int(normalized[col]) if col in ("age", "sex") else float(normalized[col])
    return result


def _parse_document_report_rows(text: str, default_age: Optional[int] = None, default_sex: Optional[int] = None) -> Dict[str, Any]:
    source_text = str(text or "")
    patient_name_match = re.search(r"name\s*:\s*([^\n]+)", source_text, flags=re.IGNORECASE)
    disease_match = re.search(r"disease\s*:\s*([^\n]+)", source_text, flags=re.IGNORECASE)
    final_match = re.search(
        r"final\s+health\s+score\s*:\s*([0-9]+(?:\.[0-9]+)?)(?:\s*\(([^)]+)\))?",
        source_text,
        flags=re.IGNORECASE,
    )

    normalized = re.sub(r"\s+", " ", source_text).strip()
    row_regex = re.compile(
        r"day\s*(\d+)\s+([0-9]+(?:\.[0-9]+)?)\s+([0-9]+(?:\.[0-9]+)?)\s+([0-9]+(?:\.[0-9]+)?)\s+([0-9]+(?:\.[0-9]+)?)",
        flags=re.IGNORECASE,
    )

    rows = []
    for match in row_regex.finditer(normalized):
        rows.append(
            {
                "day": int(match.group(1)),
                "breath_score": float(match.group(2)),
                "pause_score": float(match.group(3)),
                "speech_rate": float(match.group(4)),
                "health_score": float(match.group(5)),
            }
        )

    rows.sort(key=lambda item: item["day"])

    patient_name = patient_name_match.group(1).strip() if patient_name_match else None
    vocalis_rows = _parse_vocalis_parkinson_report(source_text, default_age=default_age, default_sex=default_sex)
    if vocalis_rows:
        rows = vocalis_rows
        patient_name = vocalis_rows[0].get("patient_name") or patient_name
    else:
        lstm_json = _parse_lstm_json_rows(source_text)
        if lstm_json:
            lstm_rows = []
            for entry in lstm_json:
                normalized = _normalize_lstm_import_row(entry, default_age, default_sex)
                if normalized:
                    lstm_rows.append(normalized)
            if lstm_rows:
                if not rows:
                    rows = [
                        {
                            "day": index + 1,
                            "breath_score": 0.0,
                            "pause_score": 0.0,
                            "speech_rate": 0.0,
                            "health_score": max(0, min(100, int(100 - float(lstm.get("motor_UPDRS", 25)) * 2.5))),
                            "lstm_row": lstm,
                        }
                        for index, lstm in enumerate(lstm_rows)
                    ]
                else:
                    for index, row in enumerate(rows):
                        if index < len(lstm_rows):
                            row["lstm_row"] = lstm_rows[index]

    return {
        "patient_name": patient_name,
        "disease": disease_match.group(1).strip() if disease_match else None,
        "final_health_score": float(final_match.group(1)) if final_match else None,
        "final_health_status": final_match.group(2).strip() if final_match and final_match.group(2) else None,
        "rows": rows,
    }


def _persist_document_rows_to_supabase(
    report: Dict[str, Any],
    detections: list[dict[str, Any]],
    source_type: str,
    filename: str,
    user_id: Optional[str] = None,
) -> Tuple[bool, int, Optional[str]]:
    rows = report.get("rows", []) or []
    if not rows:
        return True, 0, None

    if supabase is None:
        return False, 0, _supabase_unavailable_error()

    condition = report.get("disease") or (detections[0].get("condition") if detections else "Imported Record")
    patient_name = report.get("patient_name") or "Unknown"

    recordings_payload = []
    biomarkers_payload = []
    total_rows = len(rows)

    for index, row in enumerate(rows):
        recording_id = str(uuid.uuid4())
        # Keep chronology so dashboard/history charts reflect the uploaded timeline.
        recorded_at = (datetime.utcnow() - timedelta(days=(total_rows - index - 1))).isoformat()
        health_score = float(row.get("health_score") or 0.0)
        category = _health_category_from_score(health_score)

        recordings_payload.append(
            {
                "id": recording_id,
                "user_id": user_id,
                "duration": 0.0,
                "status": "analyzed",
                "notes": f"Imported {condition} Day {row.get('day')} ({patient_name})",
                "recorded_at": recorded_at,
            }
        )

        raw_features: Dict[str, Any] = {
            "source": "imported-medical-record",
            "source_type": source_type,
            "filename": filename,
            "day": row.get("day"),
        }
        if row.get("total_UPDRS") is not None:
            raw_features["total_UPDRS"] = row.get("total_UPDRS")
        if row.get("test_time") is not None:
            raw_features["test_time"] = row.get("test_time")
        if row.get("subject#") is not None:
            raw_features["subject#"] = row.get("subject#")
        lstm_row = row.get("lstm_row")
        if is_complete_lstm_row(lstm_row):
            raw_features["lstm_row"] = json_safe(lstm_row)
            raw_features["motor_updrs"] = float(lstm_row["motor_UPDRS"])

        biomarkers_payload.append(
            {
                "recording_id": recording_id,
                "user_id": user_id,
                "tremor_score": 0.0,
                "breathlessness_score": float(row.get("breath_score") or 0.0),
                "pitch_mean": 0.0,
                "pitch_variation": 0.0,
                "speech_rate": float(row.get("speech_rate") or 0.0),
                "pause_count": int(round(float(row.get("pause_score") or 0.0) * 10)),
                "pause_duration_avg": float(row.get("pause_score") or 0.0),
                "hnr": float(lstm_row.get("HNR", 0.0)) if lstm_row else 0.0,
                "jitter": float(lstm_row.get("Jitter(%)", 0.0)) if lstm_row else 0.0,
                "shimmer": float(lstm_row.get("Shimmer", 0.0)) if lstm_row else 0.0,
                "health_score": health_score,
                "health_category": category,
                "confidence": float(detections[0].get("confidence") if detections else 0.6),
                "is_anomaly": bool(health_score < 45),
                "raw_features": raw_features,
                "analyzed_at": recorded_at,
            }
        )

    try:
        supabase.table("recordings").insert(recordings_payload).execute()
        supabase.table("biomarkers").insert(biomarkers_payload).execute()
        return True, len(rows), None
    except Exception as db_error:
        return False, 0, str(db_error)


def _save_upload_to_tempfile(upload: UploadFile) -> str:
    suffix = Path(upload.filename or "upload").suffix or ".bin"
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        shutil.copyfileobj(upload.file, temp_file)
        temp_file.flush()
        return temp_file.name
    finally:
        temp_file.close()


def _fetch_history_for_trends(user_id: Optional[str], limit: int = 30) -> list[dict[str, Any]]:
    if supabase is None:
        return []
    try:
        recording_query = (
            supabase.table("recordings")
            .select("id,recorded_at")
            .order("recorded_at", desc=True)
            .limit(limit)
        )
        if user_id:
            recording_query = recording_query.eq("user_id", user_id)
        recordings = recording_query.execute().data or []
        if not recordings:
            return []

        ids = [r["id"] for r in recordings if r.get("id")]
        biomarker_response = (
            supabase.table("biomarkers")
            .select("recording_id,health_score,severity,tremor_score,speech_rate,jitter,shimmer,pitch_mean,raw_features,analyzed_at")
            .in_("recording_id", ids)
            .execute()
        )
        bio_map = {b["recording_id"]: b for b in (biomarker_response.data or [])}
        rows = []
        for rec in recordings:
            bio = bio_map.get(rec["id"], {})
            raw = bio.get("raw_features") or {}
            rows.append({
                "health_score": bio.get("health_score"),
                "severity": raw.get("severity") or bio.get("severity"),
                "tremor_score": bio.get("tremor_score"),
                "speech_score": raw.get("speech_score"),
                "speech_rate": bio.get("speech_rate"),
                "jitter": bio.get("jitter"),
                "shimmer": bio.get("shimmer"),
                "pitch_mean": bio.get("pitch_mean"),
                "biomarkers": raw.get("biomarkers"),
                "signals": raw.get("signals"),
                "analyzed_at": bio.get("analyzed_at") or rec.get("recorded_at"),
            })
        return rows
    except Exception:
        return []


def _persist_alerts(user_id: Optional[str], recording_id: str, alerts: list[dict[str, Any]]) -> None:
    if supabase is None or not alerts:
        return
    payload = []
    for alert in alerts:
        payload.append({
            "user_id": user_id,
            "recording_id": recording_id,
            "alert_type": alert.get("alert_type", "threshold"),
            "severity": alert.get("severity", "medium"),
            "message": alert.get("message", "Voice biomarker alert"),
            "biomarker": alert.get("biomarker"),
        })
    try:
        supabase.table("alerts").insert(payload).execute()
    except Exception:
        pass


def _biomarker_values(biomarkers: Dict[str, Any], signals: Dict[str, Any]) -> Dict[str, float]:
    pause = biomarkers.get("pause_patterns")
    if pause is None:
        pause = biomarkers.get("pause_irregularity")
    if pause is None:
        pause = biomarkers.get("cognitive_pause")
    if pause is None:
        pause = biomarkers.get("pitch_monotony")
    if pause is None:
        pause = signals.get("pause_count", 0.0)

    tremor = biomarkers.get("tremor")
    if tremor is None:
        tremor = signals.get("jitter", 0.0)

    breath = biomarkers.get("breathlessness")
    if breath is None:
        breath = biomarkers.get("vocal_energy", 0.0)

    return {
        "tremor_score": float(tremor),
        "breathlessness_score": float(breath),
        "pitch_mean": float(signals.get("pitch_mean", 0.0)),
        "pitch_variation": float(signals.get("pitch_std", 0.0)),
        "speech_rate": float(biomarkers.get("speech_rate", signals.get("speech_rate", 0.0))),
        "pause_score": float(pause),
        "pause_count": int(signals.get("pause_count", 0) or 0),
        "pause_duration_avg": float(signals.get("avg_pause_len", 0.0)),
        "hnr": float(signals.get("hnr", 0.0)),
        "jitter": float(signals.get("jitter", 0.0)),
        "shimmer": float(signals.get("shimmer", 0.0)),
    }


def _persist_analysis_to_supabase(
    recording_id: str,
    user_id: Optional[str],
    disease: str,
    duration: float,
    analyzed_at_iso: str,
    report: Dict[str, Any],
    signals: Dict[str, Any],
    health_score: int,
) -> Tuple[bool, Optional[str]]:
    if supabase is None:
        return False, _supabase_unavailable_error()

    biomarkers = report.get("biomarkers", {}) or {}
    scores = _biomarker_values(biomarkers, signals)
    clinical_insights = build_clinical_insights(biomarkers, signals, scores, report)

    try:
        recording_payload = {
            "id": recording_id,
            "user_id": user_id,
            "duration": duration,
            "status": "analyzed",
            "notes": f"Auto analysis for {disease}",
            "recorded_at": analyzed_at_iso,
        }
        supabase.table("recordings").insert(recording_payload).execute()

        biomarker_payload = {
            "recording_id": recording_id,
            "user_id": user_id,
            "tremor_score": scores["tremor_score"],
            "breathlessness_score": scores["breathlessness_score"],
            "pitch_mean": scores["pitch_mean"],
            "pitch_variation": scores["pitch_variation"],
            "speech_rate": scores["speech_rate"],
            "pause_count": scores["pause_count"],
            "pause_duration_avg": scores["pause_duration_avg"],
            "hnr": scores["hnr"],
            "jitter": scores["jitter"],
            "shimmer": scores["shimmer"],
            "health_score": float(health_score),
            "health_category": report.get("risk_level", "Unknown"),
            "confidence": float(report.get("confidence", 0.0)),
            "is_anomaly": bool(float(report.get("disease_score", 0.0)) > 0.7),
            "raw_features": {
                "signals": json_safe(signals),
                "biomarkers": json_safe(biomarkers),
                "disease_score": float(report.get("disease_score", 0.0)),
                "prediction": report.get("prediction", "Unknown"),
                "severity": float(report.get("severity", 0.0)),
                "stage": report.get("stage"),
                "speech_score": float(report.get("speech_score", 0.0)),
                "breathlessness_score": float(report.get("breathlessness_score", 0.0)),
                "confidence": float(report.get("confidence", 0.0)),
                "cough_detected": bool(report.get("cough_detected", False)),
                "wheeze_detected": bool(report.get("wheeze_detected", False)),
                "motor_updrs": float(report.get("motor_updrs")) if report.get("motor_updrs") is not None else None,
                "lstm_row": json_safe(report.get("lstm_row")),
                "model_source": report.get("model_source"),
                "clinical_insights": json_safe(clinical_insights),
            },
            "health_trend": report.get("health_trend", "stable"),
            "analyzed_at": analyzed_at_iso,
        }
        supabase.table("biomarkers").insert(biomarker_payload).execute()
        return True, None
    except Exception as db_error:
        error_text = str(db_error)
        if "PGRST205" in error_text and "recordings" in error_text:
            error_text = (
                "Supabase table cache does not include public.recordings. "
                "Run supabase_schema.sql in the Supabase SQL editor, then refresh the schema cache with: "
                "NOTIFY pgrst, 'reload schema';"
            )
        return False, error_text


def _normalize_disease(disease: str) -> Optional[str]:
    disease_mapping = {
        "parkinson's": "Parkinson’s",
        "parkinson’s": "Parkinson’s",
        "asthma": "Asthma",
        "depression": "Depression",
    }
    target = disease_mapping.get(disease.lower().strip())
    if not target and disease == "Parkinson's":
        target = "Parkinson’s"
    return target


def _build_patient_meta(
    target_disease: str,
    age: Optional[str | int],
    sex: Optional[str | int],
    onboarded_at: Optional[str],
) -> Tuple[Optional[Dict[str, Any]], Optional[JSONResponse]]:
    if target_disease != "Parkinson’s":
        return None, None

    try:
        patient_age = int(age) if age is not None and str(age).strip() != "" else None
    except (TypeError, ValueError):
        patient_age = None
    try:
        patient_sex = int(sex) if sex is not None and str(sex).strip() != "" else None
    except (TypeError, ValueError):
        patient_sex = None
    if patient_age is None or patient_sex not in (0, 1):
        return None, JSONResponse(
            status_code=400,
            content={
                "error": "Parkinson's UPDRS model requires age and sex. "
                "Add them in Settings or include in manual features."
            },
        )

    test_time_days = 0.0
    if onboarded_at:
        try:
            onboarded_dt = datetime.fromisoformat(onboarded_at.replace("Z", "+00:00"))
            if onboarded_dt.tzinfo is not None:
                onboarded_dt = onboarded_dt.replace(tzinfo=None)
            test_time_days = max(0.0, (datetime.utcnow() - onboarded_dt).total_seconds() / 86400.0)
        except (ValueError, TypeError):
            test_time_days = 0.0

    return {
        "age": patient_age,
        "sex": patient_sex,
        "test_time_days": test_time_days,
    }, None


def _finalize_analysis(
    target_disease: str,
    report: Dict[str, Any],
    user_id: Optional[str],
    recording_id: str,
) -> AnalysisResponse:
    bios = report.get("biomarkers", {}) or {}
    sigs = report.get("signals", {}) or {}
    scores = _biomarker_values(bios, sigs)
    health_score = int(report.get("health_score", 0))
    if health_score == 0:
        d_score = report.get("disease_score", 0.0)
        health_score = int((1.0 - d_score) * 100)
    health_score = max(0, min(100, health_score))

    severity = float(report.get("severity", (1 - health_score / 100) * 100))
    today_payload = {
        "health_score": health_score,
        "severity": severity,
        "speech_score": float(report.get("speech_score", 0)),
        "tremor_score": float(report.get("tremor_score", scores["tremor_score"])),
        "breathlessness_score": float(report.get("breathlessness_score", scores["breathlessness_score"])),
    }
    history_rows = _fetch_history_for_trends(user_id)
    trend_data = compute_trends(today_payload, history_rows, target_disease)
    report["health_trend"] = trend_data.get("trend", "stable")

    sig_val = 1.0 if report.get("signature_detected") else 0.0
    cough_detected = bool(report.get("cough_detected"))
    wheeze_detected = False if target_disease == "Asthma" else bool(report.get("wheeze_detected"))
    status = str(report.get("prediction", "Unknown"))
    if target_disease == "Asthma":
        if cough_detected:
            status = "COUGH DETECTED"
    analyzed_at = datetime.utcnow().isoformat()

    db_saved, db_error = _persist_analysis_to_supabase(
        recording_id=recording_id,
        user_id=user_id,
        disease=target_disease,
        duration=float(report.get("duration", 0.0)),
        analyzed_at_iso=analyzed_at,
        report=report,
        signals=sigs,
        health_score=health_score,
    )
    persistence_warning = None
    if not db_saved:
        persistence_warning = db_error or _supabase_unavailable_error()

    if db_saved and trend_data.get("alerts"):
        _persist_alerts(user_id, recording_id, trend_data["alerts"])

    trend_info = TrendInfo(
        baseline=trend_data.get("baseline"),
        vs_yesterday=trend_data.get("vs_yesterday"),
        vs_baseline=trend_data.get("vs_baseline"),
        weekly_change_pct=trend_data.get("weekly_change_pct"),
        trend=trend_data.get("trend", "stable"),
        risk=trend_data.get("risk", "moderate"),
        alert=bool(trend_data.get("alert")),
        baseline_ready=bool(trend_data.get("baseline_ready")),
        weekly_ready=bool(trend_data.get("weekly_ready")),
        forecast=trend_data.get("forecast"),
    )

    return AnalysisResponse(
        recording_id=recording_id,
        pitch_variation=scores["pitch_variation"],
        breath_score=scores["breathlessness_score"],
        pause_score=scores["pause_score"],
        speech_rate=scores["speech_rate"],
        tremor_score=float(report.get("tremor_score", scores["tremor_score"])),
        signature_detected=sig_val,
        cough_detected=cough_detected,
        wheeze_detected=wheeze_detected,
        health_score=health_score,
        status=status,
        severity=severity,
        stage=str(report.get("stage", "Mild")),
        confidence=float(report.get("confidence", 0.0)),
        speech_score=float(report.get("speech_score", 0.0)),
        breathlessness_score=float(report.get("breathlessness_score", scores["breathlessness_score"])),
        motor_updrs=float(report["motor_updrs"]) if report.get("motor_updrs") is not None else None,
        trends=trend_info,
        analyzed_at=analyzed_at,
        db_persisted=db_saved,
        persistence_warning=persistence_warning,
    )


@router.get("/history")
async def get_history(
    limit: int = 20,
    user_id: Optional[str] = None,
    source: str = "all",
    authorization: Optional[str] = Header(None),
):
    """Return recent analyzed recordings with linked biomarker rows."""
    bearer_sent = bool(authorization and authorization.lower().startswith("bearer "))
    user_id = resolve_user_id(authorization, user_id)

    if bearer_sent and not user_id:
        return {"items": []}

    if supabase is None:
        return {"items": []}

    items: list[dict[str, Any]] = []
    fetch_limit = max(1, min(limit, 100))

    try:
        recording_query = (
            supabase.table("recordings")
            .select("id,user_id,duration,recorded_at,status,notes,created_at")
            .order("recorded_at", desc=True)
            .limit(fetch_limit)
        )
        if user_id:
            recording_query = recording_query.eq("user_id", user_id)

        recording_response = recording_query.execute()
        recordings = recording_response.data or []

        if recordings:
            recording_ids = [recording.get("id") for recording in recordings if recording.get("id")]
            biomarker_map: Dict[str, Dict[str, Any]] = {}

            if recording_ids:
                biomarker_response = (
                    supabase.table("biomarkers")
                    .select(
                        "id,recording_id,user_id,tremor_score,breathlessness_score,pitch_mean,pitch_variation,speech_rate,pause_count,pause_duration_avg,energy_mean,spectral_centroid_mean,hnr,jitter,shimmer,health_score,health_category,health_trend,confidence,is_anomaly,raw_features,analyzed_at"
                    )
                    .in_("recording_id", recording_ids)
                    .execute()
                )
                for biomarker in biomarker_response.data or []:
                    recording_key = biomarker.get("recording_id")
                    if recording_key:
                        biomarker_map[recording_key] = biomarker

            for recording in recordings:
                biomarker = biomarker_map.get(recording.get("id"), {})
                score = float(biomarker.get("health_score") or 0)
                category = biomarker.get("health_category") or recording.get("status") or "Unknown"
                raw_features = biomarker.get("raw_features") or {}
                item_source = raw_features.get("source") or "audio-analysis"

                if source == "audio" and item_source != "audio-analysis":
                    continue
                if source == "imported" and item_source == "audio-analysis":
                    continue

                items.append(
                    {
                        "id": recording.get("id"),
                        "title": recording.get("notes") or category or "Voice Assessment",
                        "timestamp": biomarker.get("analyzed_at") or recording.get("recorded_at") or recording.get("created_at"),
                        "health_score": {
                            "score": score,
                            "category": category,
                        },
                        "recording": recording,
                        "biomarkers": biomarker,
                        "source": item_source,
                    }
                )
    except Exception as error:
        traceback.print_exc()
        items = []

    return {"items": items}


@router.get("/import-status")
async def import_status(
    user_id: Optional[str] = None,
    authorization: Optional[str] = Header(None),
):
    """Whether this user has an active imported medical report (server-side source of truth)."""
    bearer_sent = bool(authorization and authorization.lower().startswith("bearer "))
    user_id = resolve_user_id(authorization, user_id)

    if bearer_sent and not user_id:
        return {"active": False, "filename": None, "row_count": 0}

    if user_id:
        return get_import_status(supabase, user_id)

    return get_import_status(supabase, None)


@router.get("/alerts")
async def get_alerts(
    limit: int = 20,
    unread_only: bool = True,
    user_id: Optional[str] = None,
    authorization: Optional[str] = Header(None),
):
    """Return recent biomarker alerts for the authenticated user."""
    user_id = resolve_user_id(authorization, user_id)
    fetch_limit = max(1, min(limit, 50))

    if supabase is None or not user_id:
        return {"items": [], "unread_count": 0}

    try:
        query = (
            supabase.table("alerts")
            .select("id,alert_type,severity,message,biomarker,is_read,created_at,recording_id")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(fetch_limit)
        )
        if unread_only:
            query = query.eq("is_read", False)
        response = query.execute()
        items = response.data or []
        unread_resp = (
            supabase.table("alerts")
            .select("id")
            .eq("user_id", user_id)
            .eq("is_read", False)
            .execute()
        )
        unread_count = len(unread_resp.data or [])
        return {"items": items, "unread_count": unread_count}
    except Exception as error:
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"error": f"Could not load alerts: {str(error) or repr(error)}"},
        )


@router.patch("/alerts/{alert_id}/read")
async def mark_alert_read(
    alert_id: str,
    user_id: Optional[str] = None,
    authorization: Optional[str] = Header(None),
):
    user_id = resolve_user_id(authorization, user_id)
    if supabase is None or not user_id:
        return JSONResponse(status_code=400, content={"error": "Alerts require Supabase and a signed-in user."})
    try:
        supabase.table("alerts").update({"is_read": True}).eq("id", alert_id).eq("user_id", user_id).execute()
        return {"ok": True}
    except Exception as error:
        return JSONResponse(status_code=500, content={"error": str(error)})


@router.post("/preview-medical-records")
async def preview_medical_records(
    file: UploadFile = File(...),
    age: Optional[str] = Form(None),
    sex: Optional[str] = Form(None),
):
    """Detect age/sex in an import file vs profile settings before committing import."""
    temp_file_name = _save_upload_to_tempfile(file)
    try:
        try:
            profile_age = int(age) if age is not None and str(age).strip() != "" else None
        except (TypeError, ValueError):
            profile_age = None
        try:
            profile_sex = int(sex) if sex is not None and str(sex).strip() != "" else None
        except (TypeError, ValueError):
            profile_sex = None

        report_age, report_sex = _extract_report_demographics(
            temp_file_name,
            file.filename or "",
            file.content_type,
        )

        conflict = False
        if profile_age is not None and report_age is not None and profile_age != report_age:
            conflict = True
        if profile_sex is not None and report_sex is not None and profile_sex != report_sex:
            conflict = True

        return {
            "profile_age": profile_age,
            "profile_sex": profile_sex,
            "report_age": report_age,
            "report_sex": report_sex,
            "conflict": conflict,
            "has_report_demographics": report_age is not None or report_sex is not None,
        }
    except Exception as error:
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"error": f"Could not preview report demographics: {str(error) or repr(error)}"},
        )
    finally:
        if os.path.exists(temp_file_name):
            os.remove(temp_file_name)


@router.post("/extract-medical-records")
async def extract_medical_records(
    file: UploadFile = File(...),
    age: Optional[str] = Form(None),
    sex: Optional[str] = Form(None),
    user_id: Optional[str] = Form(None),
    authorization: Optional[str] = Header(None),
):
    """Extract text from uploaded medical pages/images and infer likely conditions."""
    bearer_sent = bool(authorization and authorization.lower().startswith("bearer "))
    user_id = resolve_user_id(authorization, user_id)
    if bearer_sent and not user_id:
        return JSONResponse(status_code=401, content={"error": "Invalid or expired session. Please sign in again."})
    temp_file_name = _save_upload_to_tempfile(file)
    try:
        try:
            default_age = int(age) if age is not None and str(age).strip() != "" else None
        except (TypeError, ValueError):
            default_age = None
        try:
            default_sex = int(sex) if sex is not None and str(sex).strip() != "" else None
        except (TypeError, ValueError):
            default_sex = None

        if _is_parkinson_csv_upload(file.filename, file.content_type):
            report = _parse_parkinson_history_csv(temp_file_name, default_age=default_age, default_sex=default_sex)
            if not report.get("rows"):
                return JSONResponse(
                    status_code=400,
                    content={"error": "No valid Parkinson history rows found in CSV."},
                )
            source_type = "csv"
            extracted_text = f"Parkinson CSV import: {file.filename} ({len(report['rows'])} rows)"
            detections = [
                {
                    "condition": "Parkinson's",
                    "matched_keywords": ["motor_UPDRS", "csv"],
                    "confidence": 0.95,
                }
            ]
            summary = (
                f"Imported {len(report['rows'])} days of Parkinson voice biomarker history from CSV "
                f"(patient {report.get('patient_name') or 'unknown'})."
            )
        else:
            extracted_text, source_type = _extract_text_from_document(temp_file_name, file.filename, file.content_type)
            detections = _detect_conditions_from_text(extracted_text)
            report = _parse_document_report_rows(extracted_text, default_age=default_age, default_sex=default_sex)
            summary = _summarize_medical_text(extracted_text, detections)

        saved, imported_rows, save_error = _persist_document_rows_to_supabase(
            report=report,
            detections=detections,
            source_type=source_type,
            filename=file.filename,
            user_id=user_id,
        )

        if not saved and save_error and save_error != SUPABASE_NOT_CONFIGURED_ERROR and imported_rows == 0:
            return JSONResponse(
                status_code=500,
                content={"error": f"Text extracted but failed to save imported rows: {save_error}"},
            )

        lstm_rows_parsed = sum(1 for row in (report.get("rows") or []) if is_complete_lstm_row(row.get("lstm_row")))

        return {
            "source_type": source_type,
            "filename": file.filename,
            "detected_conditions": detections,
            "summary": summary,
            "extracted_text": extracted_text[:12000],
            "character_count": len(extracted_text),
            "report": report,
            "imported_rows": imported_rows,
            "lstm_rows_parsed": lstm_rows_parsed,
            "db_persisted": bool(saved),
            "persistence_warning": None if saved else save_error,
        }
    except Exception as error:
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"error": f"Could not extract medical record text: {str(error) or repr(error)}"},
        )
    finally:
        if os.path.exists(temp_file_name):
            os.remove(temp_file_name)


@router.delete("/imported-medical-records")
async def delete_imported_medical_records(
    filename: Optional[str] = None,
    user_id: Optional[str] = None,
    authorization: Optional[str] = Header(None),
):
    """Remove imported report rows from LSTM history and DB; keep real voice recordings only."""
    user_id = resolve_user_id(authorization, user_id)
    try:
        result = remove_imported_medical_history(supabase, user_id=user_id, filename=filename)
        return {
            "ok": True,
            "message": "Imported medical history removed. Forecasting now uses only your saved voice recordings.",
            **result,
        }
    except Exception as error:
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"error": f"Could not remove imported history: {str(error) or repr(error)}"},
        )


@router.get("/export-parkinson-history")
async def export_parkinson_history(
    format: str = Query("csv", pattern="^(csv|pdf)$"),
    age: int = Query(..., ge=18, le=100),
    sex: int = Query(..., ge=0, le=1),
    subject_id: int = Query(1, ge=1),
    user_id: Optional[str] = None,
    authorization: Optional[str] = Header(None),
):
    """Export up to 30 latest history rows as Oxford CSV or Vocalis PDF (import + recordings merged)."""
    user_id = resolve_user_id(authorization, user_id)
    try:
        rows, base_name = build_parkinson_history_export(
            supabase,
            age=age,
            sex=sex,
            subject_id=subject_id,
            user_id=user_id,
        )
        if not rows:
            return JSONResponse(
                status_code=400,
                content={"error": "No voice biomarker history available to export yet."},
            )

        if format == "pdf":
            pdf_bytes = render_export_pdf(rows, subject_id=subject_id, age=age, sex=sex)
            return Response(
                content=pdf_bytes,
                media_type="application/pdf",
                headers={"Content-Disposition": f'attachment; filename="{base_name}.pdf"'},
            )

        csv_text = render_export_csv(rows)
        return Response(
            content=csv_text,
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{base_name}.csv"'},
        )
    except Exception as error:
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"error": f"Could not export history: {str(error) or repr(error)}"},
        )


@router.post("/analyze", response_model=AnalysisResponse)
async def analyze_voice(
    file: UploadFile = File(...),
    disease: str = Form("unknown"),
    user_id: Optional[str] = Form(None),
    age: Optional[str] = Form(None),
    sex: Optional[str] = Form(None),
    onboarded_at: Optional[str] = Form(None),
    authorization: Optional[str] = Header(None),
):
    """Voice biomarker analysis using XGBoost or Parkinson UPDRS model."""
    user_id = resolve_user_id(authorization, user_id)
    temp_file_name = _save_upload_to_tempfile(file)
    try:
        file_size = os.path.getsize(temp_file_name)

        if file_size == 0 or file_size < 1000:
            return JSONResponse(
                status_code=400,
                content={"error": "Audio file is empty or too small. Please record at least a few seconds."}
            )

        recording_id = str(uuid.uuid4())

        target_disease = _normalize_disease(disease)
        if not target_disease:
            return JSONResponse(
                status_code=400,
                content={"error": f"Unsupported condition: {disease}. Supported: Parkinson's, Depression, Asthma."},
            )

        if predict_voice is None:
            return JSONResponse(
                status_code=500,
                content={"error": f"ML router failed to load. Checked path: {ml_model_dir}"},
            )

        patient_meta, meta_error = _build_patient_meta(target_disease, age, sex, onboarded_at)
        if meta_error is not None:
            return meta_error

        report = predict_voice(target_disease, temp_file_name, patient_meta=patient_meta)
        return _finalize_analysis(target_disease, report, user_id, recording_id)

    except Exception as e:
        err_msg = str(e) or repr(e)
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": err_msg})
    finally:
        if os.path.exists(temp_file_name):
            os.remove(temp_file_name)


@router.post("/analyze-manual", response_model=AnalysisResponse)
async def analyze_voice_manual(
    body: ManualAnalysisRequest,
    authorization: Optional[str] = Header(None),
):
    """Dev/testing: run analysis from manual feature values (no audio)."""
    try:
        user_id = resolve_user_id(authorization, body.user_id)
        target_disease = _normalize_disease(body.disease)
        if not target_disease:
            return JSONResponse(
                status_code=400,
                content={"error": f"Unsupported condition: {body.disease}. Supported: Parkinson's, Depression, Asthma."},
            )

        if predict_voice_manual is None:
            return JSONResponse(
                status_code=500,
                content={"error": f"ML router failed to load. Checked path: {ml_model_dir}"},
            )

        features = body.features or {}
        age = body.age if body.age is not None else features.get("age")
        sex = body.sex if body.sex is not None else features.get("sex")

        patient_meta, meta_error = _build_patient_meta(
            target_disease,
            age,
            sex,
            body.onboarded_at,
        )
        if meta_error is not None:
            return meta_error

        recording_id = str(uuid.uuid4())
        report = predict_voice_manual(target_disease, body.features, patient_meta=patient_meta)
        return _finalize_analysis(target_disease, report, user_id, recording_id)

    except Exception as e:
        err_msg = str(e) or repr(e)
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": err_msg})


@router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "Vocalis Analysis API",
        "version": "1.0.0",
    }


@router.get("/biomarker-info")
async def biomarker_info():
    """Return information about tracked biomarkers and their meaning."""
    return {
        "biomarkers": [
            {
                "name": "Voice Tremor",
                "key": "tremor_score",
                "unit": "score (0-100)",
                "description": "Measures involuntary oscillations in voice amplitude. Higher scores indicate more tremor, often associated with Parkinson's or neurological conditions.",
                "healthy_range": "0-15",
                "warning_range": "15-30",
                "critical_range": "30+",
            },
            {
                "name": "Breathlessness",
                "key": "breathlessness_score",
                "unit": "score (0-100)",
                "description": "Assesses breathiness in voice through spectral analysis and harmonics-to-noise ratio. Elevated in asthma and respiratory conditions.",
                "healthy_range": "0-20",
                "warning_range": "20-40",
                "critical_range": "40+",
            },
            {
                "name": "Pitch (F0)",
                "key": "pitch_mean",
                "unit": "Hz",
                "description": "Fundamental frequency of voice. Changes can indicate vocal cord issues, hormonal changes, or neurological conditions.",
                "healthy_range": "85-300 Hz (varies by gender)",
            },
            {
                "name": "Pitch Variation",
                "key": "pitch_variation",
                "unit": "Hz (std dev)",
                "description": "Variability in pitch over time. Monotone speech may indicate depression; excessive variation may signal other conditions.",
            },
            {
                "name": "Speech Rate",
                "key": "speech_rate",
                "unit": "syllables/sec",
                "description": "Rate of speech production. Slowed speech can indicate cognitive decline, depression, or medication effects.",
                "healthy_range": "3-5 syl/s",
            },
            {
                "name": "Pause Patterns",
                "key": "pause_count",
                "unit": "count",
                "description": "Number and distribution of pauses during speech. Increased pausing may indicate breathlessness, cognitive changes, or fatigue.",
            },
            {
                "name": "Jitter",
                "key": "jitter",
                "unit": "%",
                "description": "Cycle-to-cycle variation in pitch period. Elevated jitter is associated with voice pathology and neurological conditions.",
                "healthy_range": "< 1.5%",
            },
            {
                "name": "Shimmer",
                "key": "shimmer",
                "unit": "%",
                "description": "Cycle-to-cycle variation in amplitude. High shimmer suggests incomplete vocal fold closure or neurological issues.",
                "healthy_range": "< 3%",
            },
        ]
    }
