# Interview Q&A — Vocalis

Use with [ARCHITECTURE.md](./ARCHITECTURE.md) and [ML_PIPELINE.md](./ML_PIPELINE.md). Answers are written to sound natural out loud.

---

## Product & problem

### What problem does Vocalis solve?

Between clinic visits, patients have little objective signal of how speech-related symptoms are changing. Vocalis turns a short daily voice sample into biomarker scores and trends so patients (and eventually clinicians) can see progression earlier — without storing the audio itself.

### Who is the user?

A patient tracking **one** condition (Parkinson’s or Asthma in the UI). They onboard with demographics, record guided speech tasks, and review dashboard / insights. Google Auth supports multi-device sync.

### Why voice biomarkers?

Speech motor control, respiration, and prosody change with neurological and respiratory disease. Sustained phonation and read speech are established elicitation tasks; we extract acoustic measures (jitter, shimmer, HNR, MFCCs, etc.) that correlate with clinical scales like motor UPDRS in published datasets.

---

## Architecture

### Walk me through the system.

Next.js on Vercel handles UI and Google Auth. FastAPI on a Hugging Face Docker Space runs ML (librosa, Praat, XGBoost, TensorFlow). Supabase provides Postgres + Auth. The browser sends a WAV + JWT to `/api/analyze`; the API verifies the user, runs inference on a temp file, writes scores to Postgres, deletes the audio, and returns JSON. Charts read history from the API.

### Why not put ML on Vercel serverless?

Cold starts, short timeouts, and RAM limits don’t fit TensorFlow + librosa + Praat well. We split UI (edge-friendly) from a long-lived Docker API with **16 GB** on HF’s free CPU tier.

### Why Hugging Face over Render free?

Render free is ~512 MB — TensorFlow often OOM. HF CPU Basic free has enough RAM for the full stack. Tradeoff: Spaces sleep when idle; we wake `/docs` before demos.

---

## Auth & security

### How do you authenticate API calls?

Supabase Google OAuth issues a JWT. `ApiAuthBridge` attaches it as Bearer. FastAPI verifies with Supabase Auth using the service role client and uses **that** UUID for DB writes. Client-supplied `user_id` is ignored when a Bearer token is present.

### What’s the service role vs anon key?

Anon key is public in the browser and constrained by RLS (profiles). Service role is server-only and bypasses RLS so the API can insert biomarkers/alerts after verifying the JWT — clients cannot insert those rows directly.

### Do you store audio? Why not?

No. Privacy and free-tier Storage. We analyze in a tempfile and delete it. Only numeric scores and JSON metadata go to Postgres.

---

## ML

### Which models do you use?

- **Parkinson’s session:** XGBoost regressor on 19 Oxford telemonitoring features (Praat) → `motor_UPDRS`, mapped to a 0–100 severity scale.
- **Asthma / Depression:** multi-output XGBoost on 21 librosa features (synthetic training for the hackathon).
- **Parkinson forecast:** LSTM over the last 10 complete feature+UPDRS rows → next `motor_UPDRS`.

### Why XGBoost?

Tabular acoustic features, modest dataset size, strong baselines, and easier iteration than training a speech neural net end-to-end in a hackathon. Feature importances from notebooks help explain predictions.

### Why Praat / Oxford features for Parkinson’s?

To align with a public clinical dataset (Parkinson’s telemonitoring with motor UPDRS labels) instead of inventing labels. Praat measures (jitter/shimmer/HNR/RPDE/DFA/PPE) match speech science practice.

### What’s the difference between clinical insights and model features?

UI “clinical insights” are explanatory and tagged `used_by_ml_models: false`. Oxford/librosa vectors are the actual model inputs. Mixing them up would be incorrect scientifically — we keep them separate in the product copy.

### How does the LSTM get its history?

Each UPDRS analysis stores an `lstm_row` in `raw_features`. Imports can seed the same schema. When ≥10 complete rows exist, `/forecast/parkinsons` runs.

### Limitations you’d mention honestly?

Depression/Asthma models use synthetic data; confidence values may be simplified; OCR import is demo-grade; free HF Spaces sleep; this is **not** a diagnostic medical device — decision support / tracking demo only.

---

## Frontend

### How does recording work in the browser?

MediaRecorder captures audio; AudioContext resamples to 16 kHz mono WAV; FormData posts to the API. That keeps the ML stack consistent without a separate media converter service.

### How is the app structured?

App Router layout: AuthProvider → ApiAuthBridge → OnboardingGate → AppShell. Condition config drives scripts, metrics, and gated features (forecast/export).

### How do charts handle sparse data?

`insightsData` aggregates by day and applies moving averages so irregular recording habits don’t produce noisy empty charts.

---

## Backend / data

### What does `/api/analyze` return if the DB is down?

Still returns ML scores with `db_persisted: false` and a warning. Soft-fail keeps demos usable.

### Schema in one sentence?

`profiles` for the user; `recordings` for session metadata; `biomarkers` for scores + JSONB payload; `alerts` for trend/anomaly events — all RLS-scoped, no audio blobs.

### How do medical imports work?

Preview demographics → resolve conflicts → extract rows into the same tables with an import source tag → optional delete. Used to unlock LSTM demos quickly.

---

## Deployment & DevOps

### How do you deploy?

Frontend → Vercel (`frontend/` root). API+ML → HF Docker Space from root `Dockerfile` (port 7860). DB/Auth → Supabase. Env vars for CORS, Supabase keys, `NEXT_PUBLIC_API_URL`, `REQUIRE_AUTH`.

### What’s in the Docker image?

Python 3.11, system `libsndfile`/`ffmpeg`, `backend/requirements.txt` (includes TF, librosa, Praat, EasyOCR), copies `backend/` + `ML/`, runs uvicorn.

### CI / secrets hygiene?

`.gitignore` excludes `.env`, venvs, `node_modules`, often model binaries and datasets. Secrets live in Vercel / HF / Supabase dashboards. `.env.example` documents keys without values.

---

## Behavioral / design tradeoffs

### Biggest tradeoff you made?

Prioritizing a **working end-to-end PD path** (real Oxford-style features + UPDRS + LSTM) over equally strong real-data models for every disease. Asthma/Depression show the multi-disease architecture with synthetic trainers.

### If you had more time?

Real labeled asthma/depression audio; calibrated probabilities; clinician dashboard; encrypted audio opt-in storage; model monitoring/drift; stricter medical disclaimers and validation study design.

### What are you most proud of?

Closing the loop from **guided capture → clinically aligned features → session score → longitudinal forecast → charts**, with auth and scores-only persistence that fit free tiers.

---

## 60-second demo script

1. Wake HF `/docs`.
2. Google sign-in → onboarding (Parkinson’s, age, sex).
3. Record or import medical CSV to seed history.
4. Show dashboard health score + forecast when ready.
5. Open Insights — point out clinical vs model features.
6. Mention: audio deleted after analyze; only scores in Supabase.
