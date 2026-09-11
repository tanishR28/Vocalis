# Vocalis

AI-powered voice biomarker tracking for **Parkinson's** and **Asthma**. Users record short daily voice samples; the backend extracts acoustic features, runs ML models, and stores scores in Supabase for trends and (Parkinson's) LSTM progression forecasts.

**Audio is never stored** — only numeric biomarkers and metadata.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js, React, Tailwind, Recharts |
| Backend | FastAPI, Python 3.11 |
| ML | Librosa, Praat (parselmouth), XGBoost, TensorFlow (LSTM) |
| Database & Auth | Supabase (PostgreSQL + Google OAuth) |

## Project structure

```
Vocalis/
├── frontend/          Next.js UI
├── backend/           FastAPI API
├── ML/                  Feature extraction, inference, training scripts
│   ├── models/          Pre-trained weights (included in repo)
│   └── TRAINING.md      Retrain models locally
├── supabase_schema.sql
└── supabase_migrate_profiles.sql
```

## Prerequisites

- **Node.js** 18+
- **Python** 3.11 (see `.python-version`)
- **Supabase** project ([supabase.com](https://supabase.com)) — required for login and history sync

## Setup

### 1. Clone and Python environment

```powershell
git clone https://github.com/tanishR28/Vocalis.git
cd Vocalis
python -m venv .venv
.venv\Scripts\activate
pip install -r backend/requirements.txt
```

On macOS/Linux:

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt
```

Pre-trained models are already in `ML/models/`. Retrain only if files are missing — see [ML/TRAINING.md](ML/TRAINING.md).

### 2. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. SQL Editor → run `supabase_schema.sql`, then `supabase_migrate_profiles.sql`.
3. **Authentication → Providers** → enable **Google**.
4. **Authentication → URL configuration** → add `http://localhost:3000/auth/callback`.
5. Copy Project URL, anon key, and service role key.

### 3. Backend environment

```powershell
copy backend\.env.example backend\.env
```

Edit `backend/.env`:

```env
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
CORS_ORIGINS=http://localhost:3000
```

Start the API:

```powershell
cd backend
uvicorn main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

### 4. Frontend environment

```powershell
cd frontend
npm install
copy .env.example .env.local
```

Edit `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
NEXT_PUBLIC_REQUIRE_AUTH=true
```

Start the UI:

```powershell
npm run dev
```

Open http://localhost:3000 → Google sign-in → onboarding → record a voice sample.

## Demo flow

1. Sign in with Google at `/onboarding`
2. Complete profile (name, age, sex, condition: Parkinson's or Asthma)
3. **Record** a 15–20s voice sample at `/record`
4. View scores on the **Dashboard** (`/`)
5. **Insights** (`/insights`) — trend charts
6. **Parkinson's only** — LSTM forecast after ≥10 days of history (or import medical CSV)

## API endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /api/analyze` | Upload WAV, run ML, save scores |
| `GET /api/history` | Assessment timeline |
| `POST /forecast/parkinsons` | LSTM motor UPDRS forecast |
| `GET /docs` | OpenAPI (Swagger) |

## What is not in this repo

| Ignored | Reason |
|---------|--------|
| `.env`, `.env.local` | Secrets |
| `node_modules/`, `.next/`, `.venv/` | Install locally |
| `*.wav`, `*.pdf` | User recordings / reports |
| `ML/datasets/**/*.csv` | Generated training data |
| `docs/`, `deploy/` | Local notes / deploy scripts |

## License

MIT — Hackathon / portfolio demonstration. Not a medical device.
