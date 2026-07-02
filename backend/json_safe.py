"""Convert numpy / non-JSON types to plain Python for json.dump and APIs."""

from __future__ import annotations

from typing import Any


def json_safe(value: Any) -> Any:
    try:
        import numpy as np  # type: ignore
    except Exception:
        np = None  # type: ignore

    if value is None:
        return None
    if np is not None and isinstance(value, np.ndarray):
        return [json_safe(item) for item in value.tolist()]
    if np is not None and isinstance(value, np.generic):
        return value.item()
    if isinstance(value, dict):
        return {key: json_safe(item) for key, item in value.items()}
    if isinstance(value, list):
        return [json_safe(item) for item in value]
    if isinstance(value, tuple):
        return [json_safe(item) for item in value]
    return value
