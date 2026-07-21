# Frontend Technical Guide

## Stack

| Tech | Version / role |
|------|----------------|
| Next.js | **16.2.3** — App Router |
| React | **19.2.4** |
| Tailwind CSS | **4.x** |
| Recharts | Charts on dashboard / insights |
| Framer Motion | Motion / presence |
| Supabase JS + SSR | Auth session + profiles |
| Radix / CVA | shadcn-style UI primitives |

Env (`frontend/.env.example`):

```bash
NEXT_PUBLIC_API_URL=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_REQUIRE_AUTH=true|false
```

---

## App shell pattern

`app/layout.js` wraps every page:

```
AuthProvider → ApiAuthBridge → OnboardingGate → AppLayout → page
```

| Layer | Job |
|-------|-----|
| `AuthProvider` | Supabase session, Google sign-in/out, `REQUIRE_AUTH` |
| `ApiAuthBridge` | Registers `getAccessToken` so `apiFetch` attaches Bearer JWT |
| `OnboardingGate` | Blocks incomplete profiles; hydrates from Supabase |
| `AppLayout` / `AppShell` | Sidebar, mobile nav, alerts bell, calendar; hides chrome on onboarding/login |

This avoids prop-drilling the JWT into every page.

---

## Routes

| Path | File | Purpose |
|------|------|---------|
| `/` | `app/page.js` | Main dashboard |
| `/dashboard` | `app/dashboard/page.js` | Redirect → `/` |
| `/record` | `app/record/page.js` | Capture + analyze |
| `/history` | `app/history/page.js` | Session list |
| `/insights` | `app/insights/page.js` | Deep charts |
| `/onboarding` | `app/onboarding/page.js` | Login + profile |
| `/login` | `app/login/page.js` | Soft redirect → onboarding |
| `/settings` | `app/settings/page.js` | Edit profile |
| `/auth/callback` | `app/auth/callback/route.js` | OAuth code exchange |

---

## API client (`lib/api.js`)

- Base URL from `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`).
- `apiFetch` / `apiFetchJson` attach `Authorization: Bearer …` when logged in.
- `withUserIdParams()` adds `user_id` for history/alerts/forecast scoping.
- Profile `userId` comes from Supabase user or local guest id.

---

## Client-side audio pipeline (important interview topic)

On `/record`:

1. `MediaRecorder` captures from the mic (often WebM/Opus).
2. Browser `AudioContext` decodes and resamples to **16 kHz mono**.
3. PCM is packed into a **WAV** blob.
4. Uploaded as multipart `file` to FastAPI.

**Why:** Backend / librosa / Praat expect consistent WAV; doing conversion client-side avoids a separate media service.

---

## Condition-driven UX (`lib/conditions.js`)

Single source of truth for:

- `apiValue` (string sent as `disease`)
- Record duration / sustain seconds / scripts
- Metric cards and result bars
- `ENABLED_CONDITION_IDS` (currently `parkinsons`, `asthma`)

Changing condition in Settings regenerates the whole recording + dashboard experience.

---

## State & caching

| Key / event | Role |
|-------------|------|
| `vocalis_patient_profile` | Local profile (condition, age, sex, …) |
| `vocalis_latest_analysis` | Last analyze result for dashboard ring before history refresh |
| `PROFILE_CHANGED` | Custom event so shell/pages refresh without full reload |
| `useAuthScope` | Clears stale analysis when user switches |

---

## Charts & insights data

- `insightsData.js` — build timeline, day aggregation, moving averages (sparse days don’t break charts).
- `clinicalInsights.js` — five **reference** biomarkers for education/UI (documented as not ML model inputs).
- `chartTheme.js` — shared Recharts styling.
- `InsightsCharts.jsx` — radar, clinical trends, jitter/shimmer, UPDRS, diagnostic pie, severity.

---

## Medical import UX

Hook `useMedicalReportImport` orchestrates:

preview → demographics conflict modal → extract → refresh history / forecast status.

Import metadata is also kept in localStorage (user-scoped) for UI state.

---

## Interview talking points

1. **App Router + global auth bridge** — one layout composition for auth, token injection, and gating.
2. **Guest vs enforced auth** via env flag without forking the UI.
3. **Condition as the primary UX axis** — one config object drives scripts, metrics, and gated features.
4. **Client WAV encoding** — no FFmpeg in the browser; AudioContext resampling.
5. **Clinical vs model feature storytelling** — charts label what fed the model vs what is explanatory UI.
