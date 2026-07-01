# ML — Voice monitoring (3 diseases)

**Parkinson's**, **Depression**, and **Asthma** voice biomarker pipeline.

## Layout

```
ML/
├── ml_config.py                 # Paths, feature names, disease keys
├── preprocessing/features.py    # librosa biomarkers + disease scoring
├── inference/
│   ├── router.py                # predict_voice() — API entry point
│   └── predictor.py             # XGBoost (all 3 diseases)
├── monitoring/
│   ├── engine.py                # Trends, alerts, LSTM forecast
│   └── trend.py                 # Baseline / vs-yesterday helpers
├── datasets/generate.py         # Synthetic training CSVs
├── training/
│   ├── common.py                # Shared XGBoost trainer
│   ├── train_parkinsons.py
│   ├── train_depression.py
│   ├── train_asthma.py
│   └── train_lstm_parkinsons.py
├── models/                      # *.pkl, *.joblib, parkinsons_lstm.keras
└── requirements.txt
```

## Backend integration

- `backend/routers/analysis.py` → `predict_voice(condition, audio_path)` from `inference/router.py`
- `backend/services/trend_engine.py` → `analyze_trends()` from `monitoring/engine.py`

## Train from scratch

```bash
cd ML
pip install -r requirements.txt
python datasets/generate.py
python training/train_parkinsons.py
python training/train_depression.py
python training/train_asthma.py
python training/train_lstm_parkinsons.py
```
