# System Architecture

## High-level diagram

```
┌──────────────────┐     Bearer JWT      ┌──────────────────┐   service role   ┌─────────────────┐
│  Next.js (Vercel)│ ──────────────────▶ │ FastAPI + ML     │ ───────────────▶ │ Supabase        │
│  frontend/       │                     │ (HF Space / local│                  │ Postgres + Auth │
│                  │ ◀── anon key ────── │  Docker)         │                  │                 │
│  Auth / profiles │                     │ backend/ + ML/   │                  └─────────────────┘
└──────────────────┘                     └────────┬─────────┘
                                                  │
                                         temp WAV → features → models
                                         (file deleted after analyze)
```

**Audio never persists in the cloud.** The API writes a temporary file, runs inference, saves numeric scores + JSON metadata, then deletes the file.

---

## Repository layout

```
Vocalis/
├── frontend/          # Next.js UI (App Router)
├── backend/           # FastAPI API layer
├── ML/                # Feature extraction, training, inference, monitoring
├── docs/              # This documentation
├── deploy/            # HF / Vercel helpers
├── supabase_schema.sql
└── Dockerfile         # HF Space: backend + ML on port 7860
```

---

## Request lifecycle (voice analysis)

1. **Browser** records audio (`MediaRecorder`) and encodes **16 kHz mono WAV** in-memory.
2. **Frontend** `POST /api/analyze` with multipart form: `file`, `disease`, demographics, `user_id`, plus `Authorization: Bearer <access_token>`.
3. **Backend** verifies JWT via Supabase Auth (`backend/auth.py`), resolves trusted `user_id`.
4. **ML router** (`ML/inference/router.py`) picks the model:
   - Parkinson’s + UPDRS artifact → Praat Oxford features → XGBoost → `motor_UPDRS`
   - Depression / Asthma (or PD fallback) → Librosa 21 features → multi-output XGBoost
5. **Trend engine** compares against prior Supabase history; may create **alerts**.
6. **Persistence**: insert `recordings` + `biomarkers` (scores in columns + `raw_features` JSONB).
7. **Cleanup**: temp audio deleted in a `finally` block.
8. **Response**: health score, biomarkers, prediction, trends → UI; charts later read `GET /api/history`.

Separate path for Parkinson’s forecast: `POST /forecast/parkinsons` loads last **10** complete `lstm_row`s and runs the TensorFlow LSTM.

---

## Trust boundaries

| Boundary | Rule |
|----------|------|
| Browser → Supabase Auth | Anon key; RLS on `profiles` |
| Browser → FastAPI | JWT in `Authorization`; never trust client `user_id` when Bearer present |
| FastAPI → Supabase DB | **Service role** bypasses RLS after server verifies JWT |
| FastAPI → disk | Ephemeral temp files only |

Local demo mode: if no Bearer and `NEXT_PUBLIC_REQUIRE_AUTH=false`, API may accept a claimed `user_id` for hacking without login.

---

## Why this split?

| Choice | Reason |
|--------|--------|
| Separate UI and API hosts | ML (TF + librosa + Praat) needs ~GB RAM; Vercel serverless is a poor fit |
| HF Space for API | Free tier **16 GB RAM** vs Render free 512 MB (OOM risk) |
| Scores-only DB | Privacy + stay on Supabase free tier (no Storage bucket) |
| One condition per user | Prompts, feature schema, and dashboard cards stay coherent |

---

## Condition axis (product + ML)

Patients choose **one** condition at onboarding. That choice drives:

- Recording script / duration (`frontend/lib/conditions.js`)
- Disease string sent to `/api/analyze`
- Which biomarkers the UI emphasizes
- Parkinson’s-only LSTM forecast and history export

Enabled in UI today: **Parkinson’s**, **Asthma**. Depression remains in the catalog / ML code but is disabled in onboarding.

---

## Soft failure design

Analysis can succeed even if Supabase is down:

- Response includes `db_persisted` and optional `persistence_warning`
- UI can still show the session result (also cached in `localStorage` as `vocalis_latest_analysis`)

This matters for demos and interviews: **ML path is decoupled from DB availability**.
