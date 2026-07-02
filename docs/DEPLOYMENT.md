# Deploying Vocalis (Vercel + Hugging Face Spaces + Supabase)

Production layout:

| Service | Host | Role |
|---------|------|------|
| **Frontend** | [Vercel](https://vercel.com) | Next.js UI |
| **API + ML** | [Hugging Face Spaces](https://huggingface.co/docs/hub/spaces-overview) (Docker) | FastAPI + TensorFlow LSTM + XGBoost |
| **Database & Auth** | [Supabase](https://supabase.com) free tier | Postgres, Google OAuth, history |

Audio is **not** stored in Supabase Storage — only scores and metadata in Postgres.

**Why Hugging Face over Render free tier:** TensorFlow + librosa need more than 512 MB RAM. HF CPU Basic (free) provides **16 GB RAM** — enough for the full ML stack including LSTM forecast.

---

## 1. Supabase (required)

1. Create a project and run [`supabase_schema.sql`](../supabase_schema.sql) in the SQL Editor.
2. If you already ran an older schema, also run [`supabase_migrate_profiles.sql`](../supabase_migrate_profiles.sql).
3. **Authentication → Providers** → enable **Google** (see [`SUPABASE.md`](./SUPABASE.md)).
4. **Authentication → URL configuration** → add your production URLs:
   - Site URL: `https://your-app.vercel.app`
   - Redirect URLs: `https://your-app.vercel.app/auth/callback`, `http://localhost:3000/auth/callback`
5. Copy **Project URL**, **anon key**, and **service role key**.

### What is stored where

| Data | Location |
|------|----------|
| Google account | `auth.users` (Supabase Auth) |
| Name, condition, age, sex | `profiles` |
| Session scores | `recordings` + `biomarkers` |
| Alerts | `alerts` |

---

## 2. Backend (Hugging Face Docker Space)

The repo includes a root [`Dockerfile`](../Dockerfile) and [`deploy/`](../deploy/) helpers.

### Create the Space

1. [huggingface.co/new-space](https://huggingface.co/new-space) → SDK: **Docker** → Hardware: **CPU basic (free)**.
2. Connect your GitHub repo (`tanishR28/Vocalis`) or push the Space manually.
3. HF builds from the root `Dockerfile` and exposes port **7860**.

### Space secrets (Settings → Variables and secrets)

```bash
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-secret>
CORS_ORIGINS=https://your-app.vercel.app,http://localhost:3000
```

### Verify

Open `https://<username>-vocalis-api.hf.space/docs` — FastAPI Swagger should load.

**Note:** Free Spaces sleep after ~30 min idle. Wake the backend before a demo by opening `/docs`.

### ML model files

Trained weights (`*.joblib`, `*.pkl`, `*.keras`) are committed for deploy (~8 MB). If missing after clone, run training per [`ML/TRAINING.md`](../ML/TRAINING.md).

---

## 3. Frontend (Vercel)

1. Import the repo; set **Root Directory** to `frontend` (lowercase — not `Frontend/`).
2. Framework preset: **Next.js** (auto-detected).

### Environment variables

```bash
NEXT_PUBLIC_API_URL=https://<username>-vocalis-api.hf.space
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
NEXT_PUBLIC_REQUIRE_AUTH=true
```

- **`NEXT_PUBLIC_REQUIRE_AUTH=true`** — users must sign in with Google (recommended for production).
- **`false`** — local demo mode without login (dev only).

3. Deploy, then add the Vercel URL to backend `CORS_ORIGINS` and Supabase redirect URLs.

See [`deploy/VERCEL.md`](../deploy/VERCEL.md) for step-by-step Vercel setup.

---

## 4. Post-deploy checklist

- [ ] Open HF `/docs` — wake backend before demo
- [ ] Google sign-in on production → complete onboarding (age, sex, condition)
- [ ] Record a voice sample → history appears after refresh
- [ ] Open Insights → chart shows data
- [ ] Parkinson's user → LSTM forecast endpoint returns (not 503)
- [ ] Sign in on a **second browser** → profile and history sync from Supabase
- [ ] API calls include `Authorization: Bearer …` (check Network tab)

---

## 5. Local development

```bash
# Terminal 1 — API
cd backend && uvicorn main:app --reload

# Terminal 2 — UI
cd frontend && npm run dev
```

Use `frontend/.env.local` and `backend/.env` (see `.env.example` files).  
`NEXT_PUBLIC_REQUIRE_AUTH=false` is fine locally.

---

## 6. Costs & limits (free tier)

- **Supabase:** Postgres rows only (no Storage bucket). Auth included on free tier.
- **Vercel:** Hobby plan for personal/small apps.
- **Hugging Face:** CPU Basic free — 16 GB RAM, sleeps when idle, public Space required.

---

## Alternative: Render / Railway (paid)

If HF sleep is unacceptable, use Render **Starter** ($7/mo, ≥2 GB RAM) with [`render.yaml`](../render.yaml):

- Root directory: `backend`
- Build: `pip install -r requirements.txt`
- Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`

Render **free** tier (512 MB) is **not** recommended — TensorFlow will likely OOM.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| CORS error | Add exact Vercel URL to `CORS_ORIGINS` (no trailing slash). |
| History empty in prod | Backend missing `SUPABASE_*` env vars. |
| Profile not syncing | Run `supabase_migrate_profiles.sql`; check `profiles` RLS policies. |
| 401 on API | User not logged in or `NEXT_PUBLIC_REQUIRE_AUTH` mismatch. |
| ML OOM on deploy | Use HF CPU Basic (16 GB) or Render Starter. |
| HF Space build fails | Check build logs; TensorFlow install takes ~5–10 min. |
| LSTM 503 | Verify `ML/models/parkinsons_lstm.keras` is in the repo. |

See also [`docs/SUPABASE.md`](./SUPABASE.md) and [`deploy/HF_SPACE.md`](../deploy/HF_SPACE.md).
