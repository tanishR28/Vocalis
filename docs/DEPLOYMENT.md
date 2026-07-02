# Deploying Vocalis (Vercel + Render / Railway)

Production layout:

| Service | Host | Role |
|---------|------|------|
| **Frontend** | [Vercel](https://vercel.com) | Next.js UI |
| **API** | [Render](https://render.com) or [Railway](https://railway.app) | FastAPI + ML inference |
| **Database & Auth** | [Supabase](https://supabase.com) free tier | Postgres, users, history |

Audio is **not** stored in Supabase Storage — only scores and metadata in Postgres.

---

## 1. Supabase (required for real users)

1. Create a project and run [`supabase_schema.sql`](../supabase_schema.sql) in the SQL Editor.
2. If you already ran an older schema, also run [`supabase_migrate_profiles.sql`](../supabase_migrate_profiles.sql).
3. **Authentication → Providers** → enable **Email** and **Google** (see [`SUPABASE.md`](./SUPABASE.md)).
4. **Authentication → URL configuration** → add your production URLs:
   - Site URL: `https://your-app.vercel.app`
   - Redirect URLs: `https://your-app.vercel.app/auth/callback`, `http://localhost:3000/auth/callback`
5. Copy **Project URL**, **anon key**, and **service role key**.

### What is stored where

| Data | Location |
|------|----------|
| Email, password (hashed) | `auth.users` (Supabase Auth) |
| Name, condition, age, sex | `profiles` |
| Session scores | `recordings` + `biomarkers` |
| Alerts | `alerts` |

---

## 2. Backend (Render or Railway)

Cloud hosts have **ephemeral disks** — `backend/.data/*.json` is **not** durable. You **must** set Supabase env vars in production.

### Environment variables

```bash
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-secret>
CORS_ORIGINS=https://your-app.vercel.app,http://localhost:3000
```

### Render (`render.yaml` in repo root)

1. Connect the GitHub repo on Render.
2. Use the blueprint or create a **Web Service**:
   - **Root directory:** `backend`
   - **Build:** `pip install -r requirements.txt`
   - **Start:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
3. Set env vars in the Render dashboard (never commit secrets).
4. Use at least a **Standard** instance — TensorFlow + librosa need RAM (≥2 GB recommended).

### Railway

1. New project → Deploy from GitHub.
2. Set **Root directory** to `backend`.
3. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Add the same env vars as above.

### Health check

After deploy, open `https://your-api.onrender.com/docs` (or Railway URL).

---

## 3. Frontend (Vercel)

1. Import the repo; set **Root Directory** to `frontend`.
2. Framework preset: **Next.js** (auto-detected).

### Environment variables

```bash
NEXT_PUBLIC_API_URL=https://your-api.onrender.com
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
NEXT_PUBLIC_REQUIRE_AUTH=true
```

- **`NEXT_PUBLIC_REQUIRE_AUTH=true`** — users must sign up / sign in (recommended for production).
- **`false`** — local demo mode without login (dev only).

3. Deploy, then add the Vercel URL to backend `CORS_ORIGINS` and Supabase redirect URLs.

---

## 4. Post-deploy checklist

- [ ] Sign up on production → complete onboarding (age, sex, condition).
- [ ] Record a voice sample → history appears after refresh.
- [ ] Sign in on a **second browser** → profile and history sync from Supabase.
- [ ] API calls include `Authorization: Bearer …` (check Network tab).

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
- **Render:** Free tier sleeps after inactivity; cold starts are slow for ML. Paid tier recommended for demos.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| CORS error | Add exact Vercel URL to `CORS_ORIGINS` (no trailing slash). |
| History empty in prod | Backend missing `SUPABASE_*` env vars. |
| Profile not syncing | Run `supabase_migrate_profiles.sql`; check `profiles` RLS policies. |
| 401 on API | User not logged in or `NEXT_PUBLIC_REQUIRE_AUTH` mismatch. |
| ML OOM on deploy | Upgrade instance RAM on Render/Railway. |

See also [`docs/SUPABASE.md`](./SUPABASE.md).
