# Model artifacts

## Parkinson's UPDRS (real model — preferred)

| File | Purpose |
|------|---------|
| `parkinsons_xgb.joblib` | Single-output XGBoost → `motor_UPDRS` |
| `parkinsons_updrs_features.joblib` | 19 input column names (order matters) |
| `parkinsons_updrs_scale.json` | UPDRS min/max for severity mapping |

Train in `notebooks/parkinsons_xgboost.ipynb`, then run `python training/export_updrs_artifacts.py`.

## Synthetic multi-output (Depression, Asthma, Parkinson fallback)

| File pattern | Purpose |
|---|---|
| `{condition}_xgb.pkl` | MultiOutput XGBoost |
| `{condition}_scaler.joblib` | StandardScaler |
| `{condition}_features.joblib` | 21 librosa feature names |
| `parkinsons_lstm.keras` | 7-day forecast (Parkinson's only) |

See [`../TRAINING.md`](../TRAINING.md) for full training steps.
