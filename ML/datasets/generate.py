"""Generate synthetic training CSVs for Parkinson's, Depression, and Asthma."""

import os
import pandas as pd
import numpy as np
from pathlib import Path

ML_ROOT = Path(__file__).resolve().parents[1]


def create_synthetic_data(condition: str, output_path: Path):
    print(f"Synthesizing {condition} -> {output_path}")
    n = 6000
    data = {
        f"mfcc_{i}": np.random.normal(0, 1, n) for i in range(1, 14)
    }
    data.update({
        "pitch_mean": np.random.normal(200, 50, n),
        "pitch_std": np.random.normal(20, 10, n),
        "jitter": np.random.uniform(0, 0.05, n),
        "shimmer": np.random.uniform(0, 0.5, n),
        "hnr": np.random.normal(20, 5, n),
        "speech_rate": np.random.uniform(0, 1, n),
        "pause_count": np.random.randint(0, 10, n),
        "avg_pause_len": np.random.uniform(0.1, 0.8, n),
    })
    df = pd.DataFrame(data)

    def norm(col):
        return (df[col] - df[col].min()) / (df[col].max() - df[col].min() + 1e-8)

    if condition == "Asthma":
        df["breathlessness"] = (1 - norm("hnr")).clip(upper=0.7)
        df["pause_patterns"] = norm("avg_pause_len")
        df["speech_rate_bio"] = norm("speech_rate")
        df["noise"] = np.random.uniform(0, 1, n)
        df["energy_decay"] = np.random.uniform(0, 1, n)
        lin = (
            0.3 * df["breathlessness"] + 0.2 * df["pause_patterns"]
            + 0.2 * (1 - df["speech_rate_bio"]) + 0.15 * df["noise"] + 0.15 * df["energy_decay"]
        )
        mult = df["breathlessness"] * df["pause_patterns"] * df["noise"]
        df["disease_score"] = 0.7 * lin + 0.3 * mult
        df["tremor_score"] = (norm("jitter") + norm("shimmer")).clip(0, 1) * 100
        df["breathlessness_score"] = df["breathlessness"] * 100
        df["speech_score"] = (1 - df["disease_score"]) * 80 + 20

    elif condition == "Parkinson’s":
        df["pitch_variation"] = norm("pitch_std")
        df["tremor"] = (norm("jitter") + norm("shimmer")).clip(upper=1.0)
        df["breathlessness"] = (1 - norm("hnr")).clip(upper=0.7)
        df["pause_patterns"] = norm("avg_pause_len")
        df["speech_rate_bio"] = norm("speech_rate")
        lin = (
            0.25 * df["tremor"] + 0.10 * df["breathlessness"] + 0.20 * df["pause_patterns"]
            + 0.25 * (1 - df["pitch_variation"]) + 0.20 * (1 - df["speech_rate_bio"])
        )
        mult = df["tremor"] * df["breathlessness"] * df["pause_patterns"]
        df["disease_score"] = 0.75 * lin + 0.25 * mult
        df["tremor_score"] = df["tremor"] * 100
        df["breathlessness_score"] = df["breathlessness"] * 100
        df["speech_score"] = (1 - df["disease_score"]) * 85 + 15

    elif condition == "Depression":
        df["speech_rate_bio"] = norm("speech_rate")
        df["pause_patterns"] = norm("avg_pause_len")
        df["pitch_monotony"] = 1 - norm("pitch_std")
        df["vocal_energy"] = 1 - norm("shimmer")
        df["disease_score"] = (
            0.30 * (1 - df["speech_rate_bio"]) + 0.25 * df["pause_patterns"]
            + 0.25 * df["pitch_monotony"] + 0.20 * (1 - df["vocal_energy"])
        )
        df["tremor_score"] = norm("jitter") * 50
        df["breathlessness_score"] = (1 - df["vocal_energy"]) * 60
        df["speech_score"] = df["speech_rate_bio"] * 100

    else:
        raise ValueError(f"Unsupported condition: {condition}")

    df["status"] = (df["disease_score"] > 0.45).astype(int)
    df["severity"] = (df["disease_score"] * 100).clip(0, 100)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(output_path, index=False)
    print(f"Saved {output_path}")


def generate_all():
    specs = [
        ("Parkinson’s", ML_ROOT / "datasets" / "parkinsons" / "parkinsons_updated.csv"),
        ("Depression", ML_ROOT / "datasets" / "depression" / "depression.csv"),
        ("Asthma", ML_ROOT / "datasets" / "asthma" / "asthma.csv"),
    ]
    for condition, path in specs:
        if not path.exists():
            create_synthetic_data(condition, path)
    # Legacy data/ paths for compatibility
    legacy_dir = ML_ROOT / "data"
    legacy_dir.mkdir(exist_ok=True)
    for condition, path in specs:
        legacy = legacy_dir / path.name
        if not legacy.exists() and path.exists():
            import shutil
            shutil.copy(path, legacy)


if __name__ == "__main__":
    generate_all()
