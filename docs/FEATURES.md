# Product Features → Code Map

Each feature below lists **what users see**, **key files**, and **interview talking points**.

---

## 1. Onboarding & condition selection

**User flow:** Sign in with Google (or guest in dev) → name, age, sex, condition → enter app.

| Piece | Location |
|-------|----------|
| Page | `frontend/app/onboarding/page.js` |
| Gate | `frontend/app/components/OnboardingGate.jsx` |
| Profile store | `frontend/lib/profile.js` (localStorage) |
| Cloud sync | `frontend/lib/supabase/profileSync.js` → `profiles` table |
| Condition catalog | `frontend/lib/conditions.js` |

**Talking point:** Profile is dual-written — localStorage for instant UX, Supabase for multi-device sync. Age/sex are required for Parkinson’s UPDRS features (Oxford dataset convention: sex 0/1).

---

## 2. Voice recording & analysis

**User flow:** `/record` → follow sustain + script → mic capture → analyze → see scores.

| Piece | Location |
|-------|----------|
| Page | `frontend/app/record/page.js` |
| Instructions | `frontend/app/components/RecordingInstructions.jsx` |
| API | `POST /api/analyze` → `backend/routers/analysis.py` |
| Inference | `ML/inference/router.py` → predictors |

Details: [VOICE_RECORDING.md](./VOICE_RECORDING.md), [ML_PIPELINE.md](./ML_PIPELINE.md).

---

## 3. Dashboard

**User flow:** `/` shows greeting, latest health score, clinical metric cards, stability trend, recent sessions; Parkinson’s users see UPDRS forecast.

| Piece | Location |
|-------|----------|
| Page | `frontend/app/page.js` |
| Charts | `HealthScoreAreaChart`, `VoiceStabilityTrendChart`, `MiniHealthSparkline` |
| Forecast | `GET/POST /forecast/parkinsons*` |

`/dashboard` redirects to `/` for a clean primary route.

---

## 4. History timeline

**User flow:** `/history` lists analyzed sessions; open a row for biomarker detail; optional Parkinson export.

| Piece | Location |
|-------|----------|
| Page | `frontend/app/history/page.js` |
| API | `GET /api/history?source=audio` |
| Export | `frontend/lib/exportHistory.js` → `/api/export-parkinson-history` |

---

## 5. Insights / biomarker charts

**User flow:** `/insights` builds timelines (7d / 30d / 90d / all) with clinical acoustics vs model outputs.

| Piece | Location |
|-------|----------|
| Page | `frontend/app/insights/page.js` |
| Timeline math | `frontend/lib/insightsData.js` |
| Clinical refs | `frontend/lib/clinicalInsights.js` |
| Chart suite | `frontend/app/components/insights/InsightsCharts.jsx` |

**Talking point:** UI explicitly separates **clinical/reference biomarkers** from **Oxford / XGBoost / LSTM model features** so you don’t claim the wrong inputs drove a prediction.

---

## 6. Alerts

**User flow:** Bell in the shell polls unread alerts; mark as read.

| Piece | Location |
|-------|----------|
| UI | `frontend/app/components/AlertsBell.jsx` |
| API | `GET /api/alerts`, `PATCH /api/alerts/{id}/read` |
| Logic | `ML/monitoring/engine.py` + `trend.py` via `backend/services/trend_engine.py` |

Alert types: `anomaly`, `trend_decline`, `threshold`.

---

## 7. Medical report import (demo seeding)

**User flow:** Upload PDF / image / CSV → optional demographics conflict modal → rows appear in history (esp. for LSTM readiness).

| Piece | Location |
|-------|----------|
| UI | `MedicalReportImport.jsx`, `useMedicalReportImport.js` |
| API | `/api/preview-medical-records`, `/api/extract-medical-records` |

Details: [MEDICAL_IMPORT.md](./MEDICAL_IMPORT.md).

---

## 8. Settings

**User flow:** Edit name, age, sex, condition; sync to Supabase.

| Piece | Location |
|-------|----------|
| Page | `frontend/app/settings/page.js` |

---

## 9. Auth (production)

**User flow:** Google OAuth → `/auth/callback` → session → gated app.

Details: [AUTH_AND_SECURITY.md](./AUTH_AND_SECURITY.md).

---

## Feature matrix by condition

| Capability | Parkinson’s | Asthma | Depression (code only) |
|------------|-------------|--------|-------------------------|
| Recording scripts | Sustain `eeeeeee` + sentence | Sustain `aah` + breath script | Free speech |
| Primary acoustic path | Praat Oxford + UPDRS XGB | Librosa 21 + multi-out XGB | Librosa 21 |
| Motor UPDRS | Yes | — | — |
| LSTM forecast | Yes (≥10 sessions) | — | — |
| History CSV/PDF export | Yes | — | — |
| Enabled in onboarding UI | Yes | Yes | No |
