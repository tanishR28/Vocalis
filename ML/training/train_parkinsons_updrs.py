"""
Train Parkinson's motor_UPDRS XGBoost — mirrors notebooks/parkinsons_xgboost.ipynb.

Run from repo root or ML/:
    python training/train_parkinsons_updrs.py
"""

from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import RandomizedSearchCV, train_test_split
from xgboost import XGBRegressor

ML_ROOT = Path(__file__).resolve().parents[1]
MODELS_DIR = ML_ROOT / "models"
CSV_PATH = ML_ROOT / "datasets" / "parkinsons_real" / "parkinsons_telemonitoring_updrs.csv"


def main() -> None:
    # ==========================================================
    # Load Dataset (notebook cell)
    # ==========================================================
    df = pd.read_csv(CSV_PATH)

    # ==========================================================
    # Features / target (notebook cell)
    # ==========================================================
    target = "motor_UPDRS"

    drop_columns = [
        "subject#",
        "motor_UPDRS",
        "total_UPDRS",
    ]

    X = df.drop(columns=drop_columns)
    y = df[target]

    print("Features :", X.shape)
    print("Target :", y.shape)

    # ==========================================================
    # Train / test split (notebook cell)
    # ==========================================================
    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.20,
        random_state=42,
    )

    print("Train Shape :", X_train.shape)
    print("Test Shape :", X_test.shape)

    # ==========================================================
    # RandomizedSearchCV (notebook cell)
    # ==========================================================
    param_grid = {
        "n_estimators": [200, 300, 500],
        "max_depth": [3, 4, 5, 6],
        "learning_rate": [0.01, 0.03, 0.05, 0.1],
        "subsample": [0.8, 1.0],
        "colsample_bytree": [0.8, 1.0],
        "min_child_weight": [1, 3, 5],
        "gamma": [0, 0.1, 0.2],
    }

    random_search = RandomizedSearchCV(
        estimator=XGBRegressor(
            objective="reg:squarederror",
            random_state=42,
        ),
        param_distributions=param_grid,
        n_iter=10,
        scoring="r2",
        cv=3,
        random_state=42,
        n_jobs=-1,
        verbose=1,
    )

    random_search.fit(X_train, y_train)

    print("=" * 60)
    print("BEST PARAMETERS")
    print("=" * 60)
    print(random_search.best_params_)
    print()
    print("Best Cross Validation Score")
    print(random_search.best_score_)

    best_model = random_search.best_estimator_

    train_pred = best_model.predict(X_train)
    test_pred = best_model.predict(X_test)

    # ==========================================================
    # Metrics (notebook cell)
    # ==========================================================
    print("=" * 60)
    print("TRAIN METRICS")
    print("=" * 60)

    train_mae = mean_absolute_error(y_train, train_pred)
    train_rmse = np.sqrt(mean_squared_error(y_train, train_pred))
    train_r2 = r2_score(y_train, train_pred)

    print(f"MAE  : {train_mae:.4f}")
    print(f"RMSE : {train_rmse:.4f}")
    print(f"R²   : {train_r2:.4f}")
    print()

    print("=" * 60)
    print("TEST METRICS")
    print("=" * 60)

    test_mae = mean_absolute_error(y_test, test_pred)
    test_rmse = np.sqrt(mean_squared_error(y_test, test_pred))
    test_r2 = r2_score(y_test, test_pred)

    print(f"MAE  : {test_mae:.4f}")
    print(f"RMSE : {test_rmse:.4f}")
    print(f"R²   : {test_r2:.4f}")

    # ==========================================================
    # Save model + feature columns (notebook cell)
    # ==========================================================
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    joblib.dump(best_model, MODELS_DIR / "parkinsons_xgb.joblib")
    joblib.dump(list(X.columns), MODELS_DIR / "parkinsons_updrs_features.joblib")

    print("Model Saved Successfully!")
    print("Feature columns saved to parkinsons_updrs_features.joblib")

    # ==========================================================
    # Save metrics (notebook cell)
    # ==========================================================
    metrics = {
        "Train_MAE": float(train_mae),
        "Train_RMSE": float(train_rmse),
        "Train_R2": float(train_r2),
        "Test_MAE": float(test_mae),
        "Test_RMSE": float(test_rmse),
        "Test_R2": float(test_r2),
        "Best_Parameters": random_search.best_params_,
    }

    with open(MODELS_DIR / "parkinsons_metrics.json", "w", encoding="utf-8") as handle:
        json.dump(metrics, handle, indent=4)

    print("Metrics Saved Successfully!")


if __name__ == "__main__":
    main()
