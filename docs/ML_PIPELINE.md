# ML Pipeline

Training does **not** run at request time. The API only **loads** artifacts from `ML/models/` and runs inference.

Full training steps: [`../ML/TRAINING.md`](../ML/TRAINING.md).

---

## Layout

```
ML/
├── ml_config.py                 # Feature names, paths, disease keys
├── preprocessing/
│   ├── features.py              # Librosa 21 + disease biomarkers + signatures
│   └── oxford_voice.py          # Praat/Parselmouth Oxford features
├── inference/
│   ├── router.py                # predict_voice() entry
│   ├── predictor.py             # Multi-output XGBoost (Dep/Asthma/PD fallback)
│   ├── predictor_updrs.py       # Parkinson UPDRS XGBoost
│   └── predict_parkinsons_lstm.py
├── monitoring/
│   ├── engine.py                # Trends + alert builders
│   └── trend.py                 # Baseline / weekly change helpers
├── training/                    # Offline train & export scripts
├── datasets/                    # Synthetic generator + real PD CSVs
└── models/                      # *.joblib, *.pkl, *.keras (+ JSON configs)
```

---

## Disease routing (`inference/router.py`)

```
predict_voice(condition, audio_path, patient_meta)
  if Parkinson’s AND parkinsons_xgb.joblib exists:
      → UPDRSPredictor (Praat Oxford path)
  else:
      → XGBoostPredictor(condition_key)  # 21 librosa features
```

Same split for `predict_voice_manual` (dev panel without mic).

---

## Feature extraction

### A. Librosa path (Depression, Asthma, PD fallback) — 21 features

From `preprocessing/features.py` → `extract_signal_features`:

| Group | Features |
|-------|----------|
| Timbre | `mfcc_1` … `mfcc_13` (means) |
| Pitch | `pitch_mean`, `pitch_std` (pyin F0) |
| Perturbation | `jitter`, `shimmer` |
| Noise | `hnr` (HPSS-based) |
| Prosody | `speech_rate`, `pause_count`, `avg_pause_len` |

Also detects **signatures** used in UI / asthma logic:

- Micro-tremor (4–8 Hz Welch PSD)
- Wheeze band energy
- Cough bursts (RMS, flatness, ZCR, onsets)

Audio load: **16 kHz**, peak-normalize, trim.

### B. Oxford / Praat path (preferred Parkinson’s) — 19 inputs

From `preprocessing/oxford_voice.py` via **praat-parselmouth**:

```
age, sex, test_time,
Jitter(%), Jitter(Abs), Jitter:RAP, Jitter:PPQ5, Jitter:DDP,
Shimmer, Shimmer(dB), Shimmer:APQ3, Shimmer:APQ5, Shimmer:APQ11, Shimmer:DDA,
NHR, HNR, RPDE, DFA, PPE
```

- `age` / `sex` from profile (sex: 0 female, 1 male)
- `test_time` = days since `onboardedAt`
- Voice measures extracted at runtime to match the Oxford Parkinson’s Telemonitoring dataset

UPDRS inference **also** extracts librosa biomarkers when possible so the UI still shows familiar clinical cards.

---

## Models

| Disease | Artifact | Algorithm | Input | Output |
|---------|----------|-----------|-------|--------|
| Parkinson’s (preferred) | `parkinsons_xgb.joblib` | XGBoost regressor | 19 Oxford | `motor_UPDRS` → severity 0–100 via scale JSON |
| Parkinson’s (fallback) | `parkinsons_xgb.pkl` | MultiOutput XGB | 21 librosa | severity + sub-scores |
| Depression | `depression_xgb.pkl` | MultiOutput XGB | 21 librosa | severity + speech/breath/tremor scores |
| Asthma | `asthma_xgb.pkl` | MultiOutput XGB | 21 librosa | same; cough signature can override label |
| Parkinson forecast | `parkinsons_lstm.keras` | LSTM | `(1, 10, 19)` | next `motor_UPDRS` |

Multi-output training targets: `severity`, `speech_score`, `breathlessness_score`, `tremor_score`.

Labels for UI often map to **YES / MONITOR / NO** style categories from severity thresholds; confidence may be fixed (e.g. `0.88`) in the multi-out path — be honest about this in interviews (hackathon simplification).

---

## Parkinson’s UPDRS + LSTM coupling

1. Each successful UPDRS analysis builds an **`lstm_row`** (19 fields including `motor_UPDRS`) and stores it in `raw_features`.
2. Forecast endpoint loads complete rows from history (audio and/or imports).
3. When **≥ sequence_length (10)** rows exist, MinMax-scale → LSTM → inverse-scale predicted UPDRS.
4. Trend helper: Worsening / Improving / Stable from delta (±1).

**Talking point:** Session model (XGBoost) and longitudinal model (LSTM) share a feature schema so daily use automatically feeds forecasting.

---

## Monitoring & alerts

`monitoring/trend.py`:

- Baseline from first ~3 days
- Vs yesterday
- Weekly % change
- Trend labels and risk levels

`monitoring/engine.py` → `analyze_trends` / `build_alerts` → types: threshold, trend decline, anomaly → persisted in `alerts`.

Backend bridge: `backend/services/trend_engine.py`.

---

## Clinical insights vs model inputs

`build_clinical_insights` (backend service) produces explanatory content marked **`used_by_ml_models: false`**.

Never claim those narrative insights were features to XGBoost/LSTM. Interviewers often probe this.

---

## Training summary

| Script / notebook | Produces |
|-------------------|----------|
| `datasets/generate.py` | Synthetic Dep/Asthma CSVs |
| `training/train_depression.py` / `train_asthma.py` | `*.pkl` + scalers |
| `notebooks/parkinsons_xgboost.ipynb` + `export_updrs_artifacts.py` | `.joblib` + scale JSON |
| `notebooks/parkinsons_lstm.ipynb` + export scripts | `.keras` + config JSON |

Model binaries are typically **gitignored** for local clones; production HF Space must include or bake them.

---

## Interview talking points

1. **Why Oxford features for PD?** Align with a public clinical dataset (telemonitoring UPDRS) rather than inventing labels.
2. **Why Praat?** Jitter/shimmer/HNR families match speech-pathology tooling, not only deep-learning embeddings.
3. **Why XGBoost over a neural net for session scores?** Tabular acoustic features + small data; strong baseline, interpretable feature importances in notebooks.
4. **Why LSTM on sequences?** Capture short-term motor UPDRS trajectory after enough daily points.
5. **Synthetic data caveat** for Dep/Asthma — demo-quality until real labeled audio exists; say so clearly.
6. **No training in the request path** — latency and safety; artifacts versioned offline.
