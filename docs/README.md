# Vocalis — Project Documentation

Interview-oriented technical docs for **Vocalis**: an AI voice-diary app that extracts vocal biomarkers and tracks disease progression between clinical visits.

Use this folder to understand **what the product does**, **how each layer works**, and **how to explain it in interviews**.

---

## Quick map

| Doc | What you learn |
|-----|----------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | End-to-end system design, data flow, trust boundaries |
| [FEATURES.md](./FEATURES.md) | Product features mapped to code |
| [FRONTEND.md](./FRONTEND.md) | Next.js App Router, pages, charts, client audio pipeline |
| [BACKEND.md](./BACKEND.md) | FastAPI routes, services, auth, persistence |
| [ML_PIPELINE.md](./ML_PIPELINE.md) | Librosa / Praat features, XGBoost, UPDRS, LSTM |
| [AUTH_AND_SECURITY.md](./AUTH_AND_SECURITY.md) | Google OAuth, JWT, RLS, service role |
| [DATABASE.md](./DATABASE.md) | Postgres schema, tables, what is / isn’t stored |
| [VOICE_RECORDING.md](./VOICE_RECORDING.md) | Mic → WAV → analyze → scores |
| [INSIGHTS_AND_HISTORY.md](./INSIGHTS_AND_HISTORY.md) | Dashboard, history, insights charts, alerts |
| [MEDICAL_IMPORT.md](./MEDICAL_IMPORT.md) | PDF/CSV/OCR import for demo datasets |
| [INTERVIEW_QA.md](./INTERVIEW_QA.md) | Likely interview questions + strong answers |
| [SUPABASE.md](./SUPABASE.md) | Supabase setup (env, Google, tables) |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Vercel + Hugging Face Spaces + Supabase |

Related (outside `docs/`):

- [`../ML/TRAINING.md`](../ML/TRAINING.md) — how models are trained
- [`../deploy/`](../deploy/) — HF / Vercel checklists

---

## One-paragraph pitch (memorize this)

> Vocalis lets a patient pick one condition (Parkinson’s or Asthma), record short daily voice samples in the browser, and get ML-based biomarker scores without uploading audio to cloud storage. A Next.js frontend talks to a FastAPI + ML backend; scores and trends live in Supabase Postgres with Google Auth. Parkinson’s uses Oxford-style Praat features and an XGBoost motor-UPDRS model, plus an optional LSTM that forecasts the next UPDRS from ~10 sessions.

---

## Tech stack at a glance

| Layer | Stack |
|-------|--------|
| Frontend | Next.js 16, React 19, Tailwind 4, Recharts, Framer Motion, Supabase JS |
| Backend | FastAPI, Uvicorn, Pydantic, Supabase Python client |
| ML | Librosa, Praat-Parselmouth, XGBoost, scikit-learn, TensorFlow LSTM |
| Data / Auth | Supabase (Postgres + Google OAuth), no audio Storage |
| Deploy | Vercel (UI), Hugging Face Docker Space (API+ML), Supabase cloud |

---

## Suggested reading order for interviews

1. [ARCHITECTURE.md](./ARCHITECTURE.md)  
2. [ML_PIPELINE.md](./ML_PIPELINE.md)  
3. [AUTH_AND_SECURITY.md](./AUTH_AND_SECURITY.md)  
4. [FEATURES.md](./FEATURES.md) + [INTERVIEW_QA.md](./INTERVIEW_QA.md)  
5. [DEPLOYMENT.md](./DEPLOYMENT.md) if asked about production
