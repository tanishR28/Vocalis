# Medical Report Import

## Why it exists

Hackathon / interview demos often need **10+ Parkinson sessions** before the LSTM forecast is ready. Daily recording takes days. Import lets you seed history from a CSV/PDF/image “medical report” so forecast and charts work immediately.

Imports are tagged `source = "imported-medical-record"` and can be deleted without wiping real `audio-analysis` rows.

---

## User flow

1. Dashboard or History → Medical report import UI.
2. Upload file (PDF / image / CSV depending on backend parsers).
3. `POST /api/preview-medical-records` — extract demographics; if age/sex conflict with profile → **DemographicsConflictModal**.
4. Confirm → `POST /api/extract-medical-records` — parse rows, persist as history-compatible biomarkers (including LSTM fields when present).
5. UI refreshes history + forecast status.
6. Optional: delete via `DELETE /api/imported-medical-records`.
7. Status: `GET /api/import-status`.

Frontend: `MedicalReportImport.jsx`, `useMedicalReportImport.js`, `reportImport.js`, `reportDisplay.js`.

Backend: handlers in `backend/routers/analysis.py`; OCR via EasyOCR; PDF via pypdf; export via reportlab in `parkinson_export.py`.

---

## What gets stored

Same tables as live analysis (`recordings` + `biomarkers`), but:

- Notes / `raw_features.source` mark the import
- Rows may include full `lstm_row`-compatible columns for forecast
- No audio file is involved

---

## Export (inverse path)

Parkinson users can export history:

- `GET /api/export-parkinson-history?format=csv|pdf&age=&sex=`
- Frontend helper: `exportHistory.js`
- Uses **profile** demographics for consistency with the UPDRS schema

---

## Interview talking points

1. **Bootstrap longitudinal ML** without waiting for real calendar time.
2. **Conflict UX** for demographics — models depend on age/sex; silent overwrite would corrupt features.
3. **Tagged, deletable demo data** — keeps production-like tables clean.
4. Honest caveat: OCR/PDF parsing is **demo-grade**; clinical deployment would need validated ingestion and clinician review.
