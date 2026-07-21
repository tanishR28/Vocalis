# Insights, History, Dashboard & Alerts

## Dashboard (`/`)

Purpose: one-glance status after onboarding.

Typical blocks:

- Greeting + condition subtitle + CTA to `/record`
- Health score ring (latest history or `vocalis_latest_analysis`)
- Voice stability / sparkline charts
- Clinical metric cards from `conditions.js`
- Medical report import (dashboard variant)
- Parkinson’s: LSTM forecast card (`/forecast/parkinsons/status` + predict)
- Recent assessments → link to history

File: `frontend/app/page.js`.

---

## History (`/history`)

Purpose: session timeline and drill-down.

- Loads `GET /api/history?source=audio` (excludes or filters imports depending on query).
- List items styled by health-score tone (`diagnosticStyling.js`).
- Deep link `?recording=` opens detail modal with biomarkers.
- Parkinson export panel: CSV/PDF via `/api/export-parkinson-history` using **profile** age/sex.

File: `frontend/app/history/page.js`.

---

## Insights (`/insights`)

Purpose: longitudinal analytics for interviews/clinicians.

1. Fetch up to ~200 history items.
2. `buildInsightsTimeline` (`insightsData.js`):
   - Normalize rows
   - Optional **daily aggregation**
   - 3-session moving averages
   - Range filters: 7d / 30d / 90d / all
3. Chart suite (`InsightsCharts.jsx`): clinical trends, acoustic series, UPDRS, diagnostic pie, severity bars.
4. Copy in UI clarifies **clinical acoustics ≠ Oxford model features**.

Supporting: `clinicalInsights.js` (five reference biomarkers for education).

---

## Alerts

| Step | Detail |
|------|--------|
| Create | After analyze, monitoring engine may insert `alerts` rows |
| Read | `AlertsBell` polls `GET /api/alerts` (~60s) |
| Dismiss | `PATCH /api/alerts/{id}/read` |

Types: `anomaly`, `trend_decline`, `threshold`.

---

## Session calendar

`sessionCalendar.js` + `NavbarSessionCalendar` — month grid / activity heatmap from history dates for adherence visibility.

---

## Data sources on charts

| Source tag | Origin |
|------------|--------|
| `audio-analysis` | Live `/api/analyze` |
| `imported-medical-record` | Medical import path |

Timeline helpers label sources so imported demo data isn’t confused with patient recordings.

---

## Interview talking points

1. **Sparse data UX** — aggregation + moving averages keep charts readable with irregular daily use.
2. **Layered storytelling** — dashboard for “how am I today?”, insights for “how am I trending?”, history for audit.
3. **Forecast gated on data readiness** — status endpoint before LSTM predict avoids empty-state failures.
4. **Export** closes the loop for sharing Parkinson longitudinal rows outside the app.
