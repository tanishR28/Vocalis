# Vocalis — Voice Biomarker Disease Tracking

An AI-powered **voice diary** application that enables patients to record daily voice samples and automatically analyze vocal biomarkers to track disease progression between clinical visits.

## Architecture

```
frontend/          Next.js app (UI)
backend/           FastAPI API layer
ML/                Feature extraction + XGBoost inference (see ML/TRAINING.md)
supabase_schema.sql PostgreSQL schema
```

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Frontend   │────▶│   FastAPI   │────▶│  Supabase   │
│  (Next.js)  │     │   backend   │     │  PostgreSQL │
└─────────────┘     └──────┬──────┘     └─────────────┘
                           │
                    ┌──────▼──────┐
                    │  ML/        │
                    │  inference  │
                    └─────────────┘
```

## Features

- **Voice recording** — 15-second daily samples with disease-specific prompts
- **ML analysis** — librosa features + XGBoost per disease (+ optional Parkinson LSTM forecast)
- **Dashboard** — trends, calendar, assessment history (`/`)
- **Insights** — biomarker charts from saved assessments (`/insights`)
- **History** — timeline of voice analyses (`/history`)
- **Medical record import** — optional PDF/image import for demo datasets

## Documentation

Interview-oriented technical docs live in **[`docs/`](docs/README.md)** — architecture, features, frontend, backend, ML, auth, database, and Q&A:

| Doc | Topic |
|-----|--------|
| [docs/README.md](docs/README.md) | Doc index + reading order |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design & data flow |
| [docs/FEATURES.md](docs/FEATURES.md) | Features mapped to code |
| [docs/ML_PIPELINE.md](docs/ML_PIPELINE.md) | Librosa / Praat / XGBoost / LSTM |
| [docs/INTERVIEW_QA.md](docs/INTERVIEW_QA.md) | Likely interview questions |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Vercel + HF + Supabase |
| [docs/SUPABASE.md](docs/SUPABASE.md) | Auth, tables, env vars |

## Deployment (production)

See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** for the full interview-demo setup:

| Layer | Host |
|-------|------|
| Frontend | Vercel (`frontend/`) |
| API + ML | Hugging Face Docker Space (16 GB RAM free tier) |
| Database + Auth | Supabase (Google OAuth) |

Quick links: [HF Space setup](deploy/HF_SPACE.md) · [Vercel setup](deploy/VERCEL.md) · [Smoke test script](deploy/smoke-test.ps1)

## Quick start

### Prerequisites

- Node.js 18+
- Python 3.10+
- Supabase project (optional, for persistence)

### 1. Train ML models (local — not committed to git)

See **[ML/TRAINING.md](ML/TRAINING.md)** for full detail. Short version:

```bash
cd ML
python -m venv venv && venv\Scripts\activate   # Windows
pip install -r requirements.txt
python datasets/generate.py                    # or place your own CSVs
python training/train_parkinsons.py
python training/train_depression.py
python training/train_asthma.py
python training/train_lstm_parkinsons.py       # optional
```

Outputs go to `ML/models/` as `*.pkl`, `*.joblib`, `parkinsons_lstm.keras`.

### 2. Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn main:app --reload --port 8000
```

Set in `backend/.env`:

```bash
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
CORS_ORIGINS=http://localhost:3000
```

### 3. Frontend

```bash
cd frontend
npm install
copy .env.example .env.local
npm run dev
```

Set in `frontend/.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Database

Run [`supabase_schema.sql`](supabase_schema.sql) in the Supabase SQL editor, then:

```sql
NOTIFY pgrst, 'reload schema';
```

See **[docs/SUPABASE.md](docs/SUPABASE.md)** for how Vocalis uses Supabase (tables, auth, env vars, and local fallback).

## Project structure

```
Vocalis/
├── frontend/
│   ├── app/
│   │   ├── page.js              # Main dashboard
│   │   ├── record/page.js       # Voice recording + analysis
│   │   ├── history/page.js      # Assessment timeline
│   │   ├── insights/page.js     # Biomarker charts
│   │   └── dashboard/page.js    # Redirects to /
│   └── lib/supabase/            # Auth client + profile sync
├── backend/
│   ├── main.py                  # FastAPI entry point
│   ├── config.py                # Paths + CORS settings
│   ├── routers/analysis.py      # /api/analyze, /api/history, etc.
│   └── models/schemas.py        # API response models
├── ML/
│   ├── preprocessing/features.py  # librosa biomarkers
│   ├── inference/                 # predict_voice() router
│   ├── training/                  # train_*.py scripts
│   ├── datasets/generate.py       # synthetic CSV generator
│   ├── TRAINING.md                # how to train models yourself
│   └── models/                    # trained weights (gitignored — generate locally)
└── supabase_schema.sql
```

## API endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/analyze` | POST | Analyze uploaded audio |
| `/api/history` | GET | List saved assessments |
| `/api/extract-medical-records` | POST | Import PDF/image reports |
| `/api/health` | GET | Health check |
| `/api/biomarker-info` | GET | Biomarker documentation |

## Supported conditions

| Condition | ML support |
|-----------|------------|
| Parkinson's | Yes |
| Depression | Yes |
| Asthma | Yes |

Patients select **one condition** during onboarding. The app tunes prompts, biomarkers, and dashboard for that condition only.

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js, React, Recharts, Tailwind |
| Backend | FastAPI, Python |
| ML | Librosa, XGBoost, TensorFlow (LSTM), scikit-learn |
| Database | Supabase (PostgreSQL) |

## Pushing to GitHub

`.gitignore` is set up so you push **code + requirements + docs**, not secrets or generated blobs:

| Pushed | Not pushed (local only) |
|--------|-------------------------|
| `backend/`, `frontend/`, `ML/*.py` | `backend/.env`, `frontend/.env.local` |
| `requirements.txt`, `package.json` | `node_modules/`, `.next/`, `venv/` |
| `ML/TRAINING.md`, `datasets/generate.py` | `ML/models/*.pkl`, `*.joblib`, `*.keras` |
| `.env.example` files | `ML/datasets/**/*.csv`, root `datasets/` WAVs |
| `supabase_schema.sql` | `note.txt`, `*.pdf`, recorded `*.wav` |

After clone: install deps → train models → copy `.env.example` → run.

## License

MIT — Built for hackathon demonstration purposes.
