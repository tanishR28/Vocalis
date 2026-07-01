"""Shared XGBoost training utilities."""

import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.multioutput import MultiOutputRegressor
from xgboost import XGBRegressor

import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ml_config import MODELS_DIR, SIGNAL_FEATURE_NAMES, TARGET_NAMES, dataset_path


def load_training_frame(condition_key: str) -> pd.DataFrame:
    path = dataset_path(condition_key)
    if not path or not path.exists():
        raise FileNotFoundError(f"Dataset not found for {condition_key}: {path}")
    return pd.read_csv(path)


def train_xgboost(condition_key: str) -> dict:
    df = load_training_frame(condition_key)
    feature_cols = [c for c in SIGNAL_FEATURE_NAMES if c in df.columns]
    if len(feature_cols) < len(SIGNAL_FEATURE_NAMES):
        feature_cols = SIGNAL_FEATURE_NAMES

    target_cols = [c for c in TARGET_NAMES if c in df.columns]
    if "severity" not in target_cols and "disease_score" in df.columns:
        df["severity"] = df["disease_score"] * 100
        target_cols = TARGET_NAMES

    X = df[feature_cols].values
    y = df[target_cols].values

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s = scaler.transform(X_test)

    base = XGBRegressor(
        n_estimators=200,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.9,
        colsample_bytree=0.9,
        random_state=42,
        n_jobs=-1,
    )
    model = MultiOutputRegressor(base)
    model.fit(X_train_s, y_train)
    preds = model.predict(X_test_s)
    mae = float(np.mean(np.abs(preds - y_test)))

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    model_path = MODELS_DIR / f"{condition_key}_xgb.pkl"
    scaler_path = MODELS_DIR / f"{condition_key}_scaler.joblib"
    feats_path = MODELS_DIR / f"{condition_key}_features.joblib"

    joblib.dump(model, model_path)
    joblib.dump(scaler, scaler_path)
    joblib.dump(feature_cols, feats_path)

    return {
        "condition": condition_key,
        "mae": mae,
        "model_path": str(model_path),
        "samples": len(df),
    }
