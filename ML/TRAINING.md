# Training guide — XGBoost, UPDRS & LSTM models

Use this folder when you train models yourself. The app **does not** train at runtime; it only **loads** files from `ML/models/`.

## Two Parkinson's paths

| Path | Model file | Input | Output | When used |
|------|------------|-------|--------|-----------|
| **Real UPDRS** (preferred) | `parkinsons_xgb.joblib` | 19 Oxford features + age/sex/test_time | `motor_UPDRS` | If `.joblib` exists in `models/` |
| **Synthetic multi-output** (fallback) | `parkinsons_xgb.pkl` | 21 librosa MFCC features | severity + 3 sub-scores | If `.joblib` missing |

Depression and Asthma always use the synthetic `*.pkl` multi-output pipeline until you train real models.

---

## Real Parkinson's UPDRS model (Oxford telemonitoring)

### Train in notebook

1. Open [`notebooks/parkinsons_xgboost.ipynb`](notebooks/parkinsons_xgboost.ipynb)
2. Train on [`datasets/parkinsons_real/parkinsons_telemonitoring_updrs.csv`](datasets/parkinsons_real/parkinsons_telemonitoring_updrs.csv)
3. Export artifacts to `ML/models/`:

```python
joblib.dump(best_model, "../models/parkinsons_xgb.joblib")
joblib.dump(list(X.columns), "../models/parkinsons_updrs_features.joblib")
```

4. Generate severity scale + verify columns:

```bash
python training/export_updrs_artifacts.py
```

### UPDRS model I/O

**Input (19 features, exact column order):**

```
age, sex, test_time,
Jitter(%), Jitter(Abs), Jitter:RAP, Jitter:PPQ5, Jitter:DDP,
Shimmer, Shimmer(dB), Shimmer:APQ3, Shimmer:APQ5, Shimmer:APQ11, Shimmer:DDA,
NHR, HNR, RPDE, DFA, PPE
```

- `age`, `sex` (0=female, 1=male): from app Settings / onboarding
- `test_time`: days since monitoring started (`onboardedAt`)
- Voice columns: extracted at runtime by [`preprocessing/oxford_voice.py`](preprocessing/oxford_voice.py) via **praat-parselmouth**

**Output:** single `motor_UPDRS` (scaled to UI severity 0–100 using `parkinsons_updrs_scale.json`)

### Runtime requirements

```bash
pip install praat-parselmouth
```

Patient must have **age + sex** saved in profile before recording (Parkinson's only).

### Verify UPDRS pipeline

```bash
python -c "from inference.predictor_updrs import UPDRSPredictor; print(UPDRSPredictor().ready)"
```

---

## Synthetic XGBoost (Depression, Asthma, Parkinson fallback)

### Folder map

```
ML/
├── datasets/generate.py
├── training/train_*.py
├── models/{disease}_xgb.pkl + scaler + features.joblib
├── preprocessing/features.py    # librosa → 21 features
└── ml_config.py
```

### Feature vector (21 inputs)

```
mfcc_1 … mfcc_13, pitch_mean, pitch_std, jitter, shimmer, hnr,
speech_rate, pause_count, avg_pause_len
```

### Training targets (4 outputs)

```
severity, speech_score, breathlessness_score, tremor_score
```

```bash
python datasets/generate.py          # Depression + Asthma synthetic CSVs only
python training/train_depression.py
python training/train_asthma.py
```

Parkinson's models use **real** Oxford telemonitoring data — train in Jupyter:

- `notebooks/parkinsons_xgboost.ipynb` → `models/parkinsons_xgb.joblib`
- `notebooks/parkinsons_lstm.ipynb` → `models/parkinsons_lstm.keras`

---

## LSTM (Parkinson motor UPDRS forecast)

File: `parkinsons_lstm.keras` (trained in `notebooks/parkinsons_lstm.ipynb`)

| Input | Shape | Output |
|-------|-------|--------|
| Last 10 days × 19 features (age, sex, Oxford voice biomarkers, motor_UPDRS) | `(1, 10, 19)` | Next `motor_UPDRS` |

Requires **at least 10 days** of complete history (daily recordings or CSV/PDF import with 10+ rows).

---

## Environment

```bash
cd ML
python -m venv venv
venv\Scripts\activate   # Windows
pip install -r requirements.txt
```

Restart `uvicorn` after adding or replacing models.

## GitHub

Model binaries (`*.pkl`, `*.joblib`, `*.keras`) are gitignored — train locally after clone. Code under `ML/inference/`, `preprocessing/`, and `training/` is tracked.
