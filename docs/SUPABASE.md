# Supabase in Vocalis

Vocalis uses **Supabase PostgreSQL** for cloud persistence and **optional Supabase Auth** for per-user data. The FastAPI backend remains the ML/analysis layer; the Next.js app talks to the API with a Bearer JWT when logged in.

**Audio is not stored.** Recordings are analyzed in memory on the server; only biomarker scores and metadata go to Postgres. This keeps usage within the **Supabase free tier** (no Storage bucket required).

## Architecture

```
Next.js  ──Bearer JWT──▶  FastAPI (service role)  ──▶  Supabase Postgres
       ──anon key──▶     Supabase Auth / profiles (client)
```

| Layer | Uses Supabase for |
|-------|-------------------|
| **Backend** | `recordings`, `biomarkers`, `alerts` inserts/reads (metadata + JSON scores only) |
| **Frontend** | Auth (email/password); `profiles` upsert |
| **Local fallback** | `backend/.data/*.json` when Supabase is offline or unconfigured |

## One-time setup

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor** → run [`supabase_schema.sql`](../supabase_schema.sql).
3. Copy keys into env files (see below).
4. Enable **Email** provider under Authentication → Providers.

You do **not** need Supabase Storage or a `voice-recordings` bucket.

## Environment variables

### Backend (`backend/.env`)

```bash
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-secret>
CORS_ORIGINS=http://localhost:3000
```

### Frontend (`frontend/.env.local`)

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-public-key>
NEXT_PUBLIC_REQUIRE_AUTH=false
```

- **Service role** — server only; bypasses RLS for API writes.
- **Anon key** — browser-safe; respects RLS for Auth and `profiles`.
- **`NEXT_PUBLIC_REQUIRE_AUTH`** — `true` forces `/login` before the app; `false` allows local demo mode without auth.

## Auth providers

| Provider | Status |
|----------|--------|
| **Email + password** | Implemented (`/login`) |
| **Google OAuth** | Implemented — enable Google provider in Supabase (see below) |
| **Magic link** | Not implemented |

### Enable Google sign-in

1. [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services → OAuth consent screen**:
   - **App name:** `Vocalis` (this is what users see instead of the raw Supabase URL)
   - **User support email** and **Developer contact** filled in
   - Add your email under **Test users** while the app is in *Testing*
2. **Credentials** → **OAuth client ID** (Web application):
   - Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
3. Supabase Dashboard → **Authentication → Providers → Google** → paste Client ID + Secret, enable.
4. Supabase → **Project Settings → General** → set **Project name** to `Vocalis`
5. Supabase → **Authentication → URL configuration** → add:
   - `http://localhost:3000/auth/callback` (dev)
   - `https://your-app.vercel.app/auth/callback` (production)

### Profile columns migration (required for age/sex sync)

If you see `column profiles.age does not exist` in the browser console, run [`supabase_migrate_profiles.sql`](../supabase_migrate_profiles.sql) in the SQL Editor, then:

```sql
NOTIFY pgrst, 'reload schema';
```

## Tables

| Table | Purpose |
|-------|---------|
| `profiles` | User name, condition, **age**, **sex** (linked to `auth.users.id`) |
| `recordings` | Session metadata only (time, duration, notes) — no audio files |
| `biomarkers` | Scores + `raw_features` JSONB (`clinical_insights`, `lstm_row`, `prediction`, `source`) |
| `alerts` | Trend/anomaly events after voice analysis |

## API behaviour

- **`POST /api/analyze`** — ML on uploaded WAV in temp memory; saves scores to local JSON + Supabase; **does not** persist audio.
- **`GET /api/history`** — Supabase first, then merges `backend/.data/` fallback.
- **`GET /api/alerts`** — unread alerts for the authenticated user.
- **JWT** — send `Authorization: Bearer <access_token>`; backend derives `user_id` from the token.

## Free tier tips

- Postgres rows for scores/metadata are small — well within 500 MB DB limit for typical use.
- Skip Storage entirely (no WAV uploads).
- Auth free tier includes monthly active users on the current Supabase plan.
- Profile fields (`age`, `sex`, `condition`) sync across devices when users sign in.

## Production deployment

See [`docs/DEPLOYMENT.md`](./DEPLOYMENT.md) for Vercel + Render/Railway setup.

## Operational modes

| Mode | Behaviour |
|------|-----------|
| No Supabase env | Local JSON only; app fully usable on one machine |
| Supabase only (no login) | Cloud writes under `user_id = null` / `default` local key |
| Full auth | Per-user history, profiles, alerts |

## Troubleshooting

**`PGRST205` / table not found** — re-run `supabase_schema.sql`, then:

```sql
NOTIFY pgrst, 'reload schema';
```

**History empty but imports worked** — check backend logs; local `.data/` should still populate dashboard when Supabase fails.

