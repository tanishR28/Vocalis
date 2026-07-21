# Backend Technical Guide (FastAPI)

## Stack

| Package | Role |
|---------|------|
| FastAPI + Uvicorn | HTTP API |
| python-multipart | Audio / file uploads |
| Pydantic | Request/response models |
| supabase (Python) | Auth verify + DB writes (service role) |
| ML deps | librosa, xgboost, tensorflow, praat-parselmouth, easyocr, pypdf, reportlab |

Entry: `backend/main.py` — CORS from `config.get_cors_origins()`, mounts analysis + forecast routers.

`config.py` adds `ML/` onto `sys.path` so routers import `inference.*` and `monitoring.*`.

---

## Auth (`backend/auth.py`)

| Function | Behavior |
|----------|----------|
| `verify_supabase_access_token(token)` | `auth.get_user(token)` via service-role client → UUID or `None` |
| `resolve_user_id(authorization, claimed_user_id)` | If Bearer present → **only** verified JWT id; else fall back to claimed id (local demo) |

Production rule: **never trust the form/query `user_id` when a Bearer token is present.**

---

## API reference

Base prefixes: analysis under `/api`, forecast under `/forecast`.

### Analysis (`backend/routers/analysis.py`)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/analyze` | Main voice analysis |
| `POST` | `/api/analyze-manual` | Dev: features without audio |
| `GET` | `/api/history` | List recordings + biomarkers |
| `GET` | `/api/import-status` | Active medical import? |
| `GET` | `/api/alerts` | User alerts |
| `PATCH` | `/api/alerts/{alert_id}/read` | Mark read |
| `POST` | `/api/preview-medical-records` | Demographics preview (no persist) |
| `POST` | `/api/extract-medical-records` | Import PDF/image/CSV |
| `DELETE` | `/api/imported-medical-records` | Remove import rows only |
| `GET` | `/api/export-parkinson-history` | CSV or PDF export |
| `GET` | `/api/health` | Liveness |
| `GET` | `/api/biomarker-info` | Biomarker glossary |

### Forecast (`backend/routers/forecast.py`)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/forecast/parkinsons` | LSTM next `motor_UPDRS` |
| `GET` | `/forecast/parkinsons/status` | Session count / readiness |

Schemas: `backend/models/schemas.py`.

---

## `POST /api/analyze` (core path)

1. Resolve user from JWT / claimed id.
2. Save upload to **tempfile**; reject tiny/empty audio.
3. Normalize disease label (`Parkinson’s`, `Depression`, `Asthma`).
4. Parkinson’s: build `patient_meta` — **age**, **sex**, `test_time_days` from `onboarded_at`.
5. `predict_voice(condition, path, patient_meta)`.
6. `_finalize_analysis`:
   - Map biomarkers → DB columns
   - Fetch prior history → `compute_trends` → optional alerts
   - Persist recording + biomarkers
7. `finally`: delete temp file.

Response highlights: scores, prediction/severity, `motor_updrs?`, `trends`, `db_persisted`, `persistence_warning`.

---

## Persistence

`_persist_analysis_to_supabase`:

- `recordings`: metadata (duration, status=`analyzed`, notes, timestamps). `audio_url` column exists but is **unused**.
- `biomarkers`: numeric score columns + `raw_features` JSONB (`prediction`, `lstm_row`, `clinical_insights`, `source`, etc.).

Service role client inserts biomarkers/alerts (no client INSERT policies for those tables).

`json_safe.py` converts numpy types before JSONB insert.

---

## Services

| Module | Responsibility |
|--------|----------------|
| `services/trend_engine.py` | Bridge to `ML/monitoring` trend analysis |
| `services/lstm_history.py` | Fetch/validate complete LSTM rows; import helpers |
| `services/clinical_history.py` | `build_clinical_insights` (UI-only; `used_by_ml_models: false`) |
| `services/parkinson_export.py` | Oxford-style CSV / PDF export |

---

## Error & resilience patterns

| Situation | Behavior |
|-----------|----------|
| Bad audio / missing demographics | HTTP 400 |
| ML crash | HTTP 500 |
| DB unavailable | Analysis still returns scores; `db_persisted=false` |
| Alert insert fail | Swallowed (don’t fail the analyze call) |
| History without Supabase | Empty list |

---

## CORS & deploy

- `CORS_ORIGINS` comma-separated (Vercel URL + localhost).
- Docker (`Dockerfile`): Python 3.11, `libsndfile` + `ffmpeg`, uvicorn on **7860** for Hugging Face Spaces.
- Env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CORS_ORIGINS`.

---

## Interview talking points

1. **API as ML gateway** — verifies identity, runs heavy inference, writes only scores.
2. **Soft DB failure** — demos aren’t blocked by Postgres outages.
3. **Temp-file hygiene** — privacy + free-tier Storage avoidance.
4. **Service role after JWT verify** — elevated writes scoped to verified `user_id`.
5. **Disease routing stays in ML package** — backend stays thin; `predict_voice` owns model selection.
