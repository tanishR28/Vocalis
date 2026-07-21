# Auth & Security

## Goals

- Per-user history and profiles across devices
- API writes only for the authenticated user
- Stay on Supabase free tier (Auth + Postgres, no Storage)
- Support a **local guest mode** for demos without Google

---

## Components

| Layer | Mechanism |
|-------|-----------|
| Identity | Supabase Auth — **Google OAuth only** (email/password removed) |
| Browser DB access | Anon key + RLS on `profiles` |
| API identity | `Authorization: Bearer <access_token>` |
| API DB writes | Service role key (bypasses RLS) after JWT verification |

Diagram:

```
Browser
  ├─ anon key ──▶ Supabase Auth / profiles (RLS)
  └─ Bearer JWT ──▶ FastAPI ── service role ──▶ recordings / biomarkers / alerts
```

---

## Frontend flow

1. User clicks Google on `/onboarding` → `signInWithGoogle`.
2. Redirect to `/auth/callback` → `exchangeCodeForSession` (server client in `app/auth/callback/route.js`).
3. `AuthProvider` holds `session`, `accessToken`, `user`.
4. `ApiAuthBridge` registers the token getter for `lib/api.js`.
5. `OnboardingGate` links/hydrates profile (`profileSync.js`); incomplete profiles stay on onboarding.
6. `NEXT_PUBLIC_REQUIRE_AUTH=true` → no “Continue without account”.

Logout (`AppShell`): clear local profile + caches + Supabase `signOut`.

---

## Backend verification

`backend/auth.py`:

- Service-role Supabase client calls `auth.get_user(jwt)`.
- Valid token → UUID used for all inserts/selects.
- Invalid / missing when required → empty history or `401` on protected ops.
- **No Bearer** → optional claimed `user_id` for local guest demos.

**Interview answer:** “We don’t trust the client’s user_id in production. The JWT is verified server-side; that id scopes every write.”

---

## RLS (high level)

Enabled on `profiles`, `recordings`, `biomarkers`, `alerts`.

- Users can SELECT/UPDATE/INSERT **own** profiles.
- Users can SELECT/INSERT own recordings; SELECT own biomarkers; SELECT/UPDATE own alerts.
- **No client INSERT** on biomarkers/alerts — only the backend service role creates those after analysis.

Trigger `handle_new_user` auto-inserts a `profiles` row on signup (`SECURITY DEFINER`).

---

## Secrets placement

| Secret | Where | Never in |
|--------|-------|----------|
| `SUPABASE_ANON_KEY` | Frontend env (`NEXT_PUBLIC_…`) | — (public by design; RLS protects) |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend / HF Space secrets only | Frontend, git, client bundles |
| Google OAuth client secret | Supabase Auth provider config | App code |

---

## Privacy choices

1. **No cloud audio storage** — temp file deleted after inference.
2. Scores + JSON metadata only in Postgres.
3. One condition per profile reduces accidental cross-condition data mixing.
4. Medical imports are tagged and deletable without wiping real recordings.

---

## Env flags

| Variable | Effect |
|----------|--------|
| `NEXT_PUBLIC_REQUIRE_AUTH=true` | Production: force Google |
| `NEXT_PUBLIC_REQUIRE_AUTH=false` | Local: allow guest onboarding |
| Backend `SUPABASE_*` missing | Persistence fails soft; history empty |

---

## Common failures (interview + ops)

| Symptom | Likely cause |
|---------|--------------|
| CORS errors | Vercel URL missing from `CORS_ORIGINS` |
| 401 on API | Not logged in / auth flag mismatch |
| History empty in prod | Backend missing service role env |
| Profile age/sex missing | Need `supabase_migrate_profiles.sql` + schema reload |
| Google redirect fail | Redirect URLs not listed in Supabase + Google Cloud |
