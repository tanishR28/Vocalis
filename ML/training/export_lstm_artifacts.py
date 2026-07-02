"""Export parkinsons_lstm_config.json from existing LSTM artifacts."""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ml_config import MODELS_DIR, load_lstm_feature_columns, model_paths


def main():
    feature_columns = load_lstm_feature_columns()
    config = {
        "sequence_length": 10,
        "feature_count": len(feature_columns),
        "target": "motor_UPDRS",
    }

    out_path = model_paths("parkinsons")["lstm_config"]
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)

    print(f"Wrote {out_path}")
    print(json.dumps(config, indent=2))


if __name__ == "__main__":
    main()
