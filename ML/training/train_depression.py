"""Train Depression XGBoost model."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from datasets.generate import generate_all
from training.common import train_xgboost


def main():
    generate_all()
    result = train_xgboost("depression")
    print(f"Depression model trained: MAE={result['mae']:.4f}, samples={result['samples']}")


if __name__ == "__main__":
    main()
