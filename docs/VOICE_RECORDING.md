# Voice Recording Feature

## User journey

1. Open `/record` (requires completed onboarding + condition).
2. See condition-specific instructions (sustain vowel + scripted phrase).
3. Press record → mic permission → countdown / progress for configured duration.
4. Stop → client encodes WAV → `POST /api/analyze`.
5. UI shows health score, prediction/severity, biomarker bars, optional trends.
6. Latest result cached in `localStorage` (`vocalis_latest_analysis`) for the dashboard.
7. Server persists scores (not audio); history/insights refresh from `GET /api/history`.

---

## Condition protocols (`lib/conditions.js`)

| Condition | Duration (typical) | Sustain | Script focus |
|-----------|--------------------|---------|--------------|
| Parkinson’s | ~15s | `"eeeeeee"` (~5s) | Articulation / steadiness sentence |
| Asthma | ~20s | `"aah"` (~5s) | Breathlessness-oriented script |
| Depression (disabled UI) | ~15s | none | Free speech |

RecordingInstructions (`RecordingInstructions.jsx`) drives live step prompts.

---

## Client audio pipeline

File: `frontend/app/record/page.js` (MediaRecorder + AudioContext).

```
Mic stream
  → MediaRecorder (browser container, often WebM)
  → decode AudioBuffer
  → resample / mix to mono 16 kHz
  → encode PCM WAV blob
  → FormData { file, disease, age, sex, onboarded_at, user_id }
  → POST /api/analyze (+ Bearer)
```

**Why 16 kHz?** Matches librosa load settings in `ML/preprocessing/features.py` and keeps upload size modest.

---

## Server handling

1. Write upload to tempfile; reject empty/tiny files.
2. Parkinson’s: require age + sex; compute `test_time_days`.
3. Route to UPDRS or multi-output XGBoost.
4. Trends vs prior history; optional alerts.
5. Insert `recordings` + `biomarkers`.
6. Delete tempfile in `finally`.

---

## Manual / dev analysis

`POST /api/analyze-manual` accepts JSON feature vectors without a mic:

- Parkinson’s path: Oxford-style columns
- Asthma / others: librosa-style 21-vector

Useful for demos when a quiet room isn’t available.

---

## Failure modes to explain

| Issue | Handling |
|-------|----------|
| Mic denied | UI error; no upload |
| Too short / empty WAV | API 400 |
| Missing PD demographics | API 400 |
| DB down | Scores still returned; `db_persisted=false` |
| Model file missing | Predictor not ready / error — deploy must ship weights |

---

## Interview talking points

1. End-to-end **biomarker pipeline without storing PHI audio**.
2. **Condition-specific elicitation** — same as clinical speech tasks (sustained phonation + reading).
3. Browser-side WAV normalization so the ML stack sees consistent inputs.
4. Separation of **capture UX** (frontend) and **inference** (backend/ML).
