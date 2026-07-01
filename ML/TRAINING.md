# Training guide — XGBoost & LSTM models

Use this folder when you train models yourself. The app **does not** train at runtime; it only **loads** files from `ML/models/`.

## Folder map

```
ML/
├── datasets/
│   ├── generate.py              # Build synthetic CSVs (or replace CSVs with your own)
│   ├── parkinsons/parkinsons_updated.csv
│   ├── depression/depression.csv
│   └── asthma/asthma.csv
├── training/
│   ├── common.py                # Shared XGBoost trainer
│   ├── train_parkinsons.py
│   ├── train_depression.py
│   ├── train_asthma.py
│   └── train_lstm_parkinsons.py # 7-day forecast (Parkinson's only)
├── models/                      # OUTPUT — inference reads from here
│   ├── parkinsons_xgb.pkl
│   ├── parkinsons_scaler.joblib
│   ├── parkinsons_features.joblib
│   ├── depression_xgb.pkl
│   ├── depression_scaler.joblib
│   ├── depression_features.joblib
│   ├── asthma_xgb.pkl
│   ├── asthma_scaler.joblib
│   ├── asthma_features.joblib
│   └── parkinsons_lstm.keras
├── preprocessing/features.py    # librosa → 21 features (used at train + inference)
└── ml_config.py                 # Paths & feature names (do not rename outputs casually)
```

## Model file formats

| File | Format | Purpose |
|------|--------|---------|
| `{disease}_xgb.pkl` | joblib pickle | `MultiOutputRegressor(XGBRegressor)` — predicts severity, speech, breathlessness, tremor |
| `{disease}_scaler.joblib` | joblib | `StandardScaler` fit on training features |
| `{disease}_features.joblib` | joblib | List of column names (order matters at inference) |
| `parkinsons_lstm.keras` | Keras | Optional 7-day severity forecast when enough history exists |

**Disease keys** (must match filenames): `parkinsons`, `depression`, `asthma`

## Feature vector (21 inputs)

Defined in `ml_config.py` → `SIGNAL_FEATURE_NAMES`:

```
mfcc_1 … mfcc_13, pitch_mean, pitch_std, jitter, shimmer, hnr,
speech_rate, pause_count, avg_pause_len
```

Extracted from audio by `preprocessing/features.py` → `extract_signal_features()`.

## Training targets (4 outputs per disease)

```
severity, speech_score, breathlessness_score, tremor_score
```

CSV columns must include these (synthetic generator adds them automatically).

## Step-by-step (from repo root)

### 1. Environment

```bash
cd ML
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
```

### 2. Training data

**Option A — synthetic (quick test)**

```bash
python datasets/generate.py
```

Creates ~6000 rows per disease under `ML/datasets/<disease>/`.

**Option B — your real data**

Replace the CSVs but keep:

- Same feature column names as `SIGNAL_FEATURE_NAMES`
- Target columns: `severity`, `speech_score`, `breathlessness_score`, `tremor_score`
- One row = one labeled voice sample’s features (extract features with `extract_signal_features` in a separate script if starting from WAVs)

Your raw WAV folders (e.g. repo root `datasets/`) are **gitignored** — keep them local.

### 3. Train XGBoost (all 3 diseases)

```bash
python training/train_parkinsons.py
python training/train_depression.py
python training/train_asthma.py
```

Each script prints MAE and writes three files into `ML/models/`.

### 4. Train Parkinson LSTM (optional)

```bash
python training/train_lstm_parkinsons.py
```

Writes `ML/models/parkinsons_lstm.keras`. Used only for trend **forecast** after 7+ daily recordings.

### 5. Verify

```bash
python -c "from inference.predictor import XGBoostPredictor; print('parkinsons', XGBoostPredictor('parkinsons').ready)"
python -c "from inference.predictor import XGBoostPredictor; print('asthma', XGBoostPredictor('asthma').ready)"
```

All should print `True`.

### 6. Run app

Backend loads `ML/` automatically (`backend/config.py` → `ML_DIR`). Restart uvicorn after retraining.

## What gets committed to GitHub

| Tracked | Ignored (you generate locally) |
|---------|--------------------------------|
| `ML/datasets/generate.py`, `.gitkeep` | `ML/datasets/**/*.csv` |
| `ML/training/*.py`, `preprocessing/`, `inference/` | `ML/models/*.pkl`, `*.joblib`, `*.keras` |
| `ML/requirements.txt`, `ml_config.py` | Root `datasets/` WAV folders |
| `ML/models/README.md` | `note.txt`, `.env`, `*.pdf` |

If you want to **share trained weights** via GitHub, use [Git LFS](https://git-lfs.github.com/) or a release zip — default `.gitignore` excludes binaries so clones stay small.

## Custom training tips

- **Do not rename** output files without updating `ml_config.py` → `model_paths()`.
- **Feature order** in `{disease}_features.joblib` must match inference vector order.
- Asthma at runtime: XGBoost for scores; librosa still detects cough/wheeze flags for UI (not hardcoded scores).
- Retrain all three XGBoost models if you change `SIGNAL_FEATURE_NAMES` or feature extraction.
