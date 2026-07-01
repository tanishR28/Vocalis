"""Train Parkinson's LSTM for longitudinal severity forecasting."""

import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ml_config import MODELS_DIR

SEQUENCE_LEN = 7
FEATURE_DIM = 8
EPOCHS = 25
BATCH_SIZE = 32
N_SEQUENCES = 2000


def _build_synthetic_sequences(n_sequences: int, seq_len: int):
    X, y = [], []
    for _ in range(n_sequences):
        base = np.random.uniform(20, 80)
        seq = []
        for day in range(seq_len):
            drift = day * np.random.uniform(-1.5, 2.0)
            severity = np.clip(base + drift + np.random.normal(0, 3), 5, 95)
            speech = np.clip(100 - severity + np.random.normal(0, 5), 0, 100)
            tremor = np.clip(severity * 0.7 + np.random.normal(0, 4), 0, 100)
            pitch = np.random.uniform(80, 220)
            jitter = np.random.uniform(0, 0.05)
            shimmer = np.random.uniform(0, 0.4)
            rate = np.random.uniform(0.2, 0.9)
            seq.append([pitch, jitter, shimmer, rate, severity, speech, tremor, tremor * 0.5])
        X.append(seq)
        future_sev = np.clip(seq[-1][4] + np.random.uniform(-5, 8), 0, 100)
        y.append([future_sev, future_sev + np.random.uniform(0, 12), min(1.0, future_sev / 100), 1 - abs(future_sev - seq[-1][4]) / 50])
    return np.array(X, dtype=np.float32), np.array(y, dtype=np.float32)


def main():
    try:
        import tensorflow as tf
        from tensorflow import keras
        from tensorflow.keras import layers
    except ImportError as exc:
        raise SystemExit("tensorflow required for LSTM training: pip install tensorflow") from exc

    X, y = _build_synthetic_sequences(N_SEQUENCES, SEQUENCE_LEN)

    model = keras.Sequential([
        layers.Input(shape=(SEQUENCE_LEN, FEATURE_DIM)),
        layers.LSTM(64, return_sequences=True),
        layers.Dropout(0.2),
        layers.LSTM(32),
        layers.Dense(32, activation="relu"),
        layers.Dense(4),
    ])
    model.compile(optimizer="adam", loss="mse", metrics=["mae"])
    model.fit(X, y, epochs=EPOCHS, batch_size=BATCH_SIZE, validation_split=0.15, verbose=1)

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    out = MODELS_DIR / "parkinsons_lstm.keras"
    model.save(out)
    print(f"Saved LSTM to {out}")


if __name__ == "__main__":
    main()
