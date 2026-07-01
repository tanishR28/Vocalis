"""Backend trend engine wrapper around ML monitoring."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

ML_DIR = Path(__file__).resolve().parents[2] / "ML"
if str(ML_DIR) not in sys.path:
    sys.path.insert(0, str(ML_DIR))

from monitoring.engine import analyze_trends  # type: ignore


def compute_trends(
    today: Dict[str, Any],
    history_rows: List[Dict[str, Any]],
    condition: str,
) -> Dict[str, Any]:
    key_map = {
        "Parkinson's": "parkinsons",
        "Parkinson’s": "parkinsons",
        "parkinsons": "parkinsons",
        "Depression": "depression",
        "depression": "depression",
        "Asthma": "asthma",
        "asthma": "asthma",
    }
    condition_key = key_map.get(condition, "parkinsons")
    return analyze_trends(today, history_rows, condition_key=condition_key)
