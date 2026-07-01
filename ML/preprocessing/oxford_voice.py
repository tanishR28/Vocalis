"""Oxford Parkinson's Telemonitoring voice features (UCI dataset compatible)."""

from __future__ import annotations

import math
from pathlib import Path
from typing import Dict, Optional

import numpy as np

OXFORD_VOICE_COLUMNS = [
    "Jitter(%)",
    "Jitter(Abs)",
    "Jitter:RAP",
    "Jitter:PPQ5",
    "Jitter:DDP",
    "Shimmer",
    "Shimmer(dB)",
    "Shimmer:APQ3",
    "Shimmer:APQ5",
    "Shimmer:APQ11",
    "Shimmer:DDA",
    "NHR",
    "HNR",
    "RPDE",
    "DFA",
    "PPE",
]

OXFORD_FEATURE_COLUMNS = [
    "age",
    "sex",
    "test_time",
    *OXFORD_VOICE_COLUMNS,
]

_PITCH_FLOOR = 75.0
_PITCH_CEILING = 600.0


def _safe_float(value: float, default: float = 0.0) -> float:
    if value is None or (isinstance(value, float) and (math.isnan(value) or math.isinf(value))):
        return default
    return float(value)


def _rpde(pitch_values: np.ndarray, tau: int = 1, epsilon: float = 0.1) -> float:
    """Recurrence period density entropy on voiced pitch periods."""
    if len(pitch_values) < 10:
        return 0.45
    periods = 1.0 / np.clip(pitch_values, _PITCH_FLOOR, _PITCH_CEILING)
    embedded = np.column_stack([periods[i : len(periods) - tau + i] for i in range(tau)])
    if len(embedded) < 5:
        return 0.45
    dists = np.sqrt(np.sum((embedded[:, None, :] - embedded[None, :, :]) ** 2, axis=2))
    np.fill_diagonal(dists, np.inf)
    recurrence = (dists <= epsilon * np.std(periods)).astype(float)
    density = recurrence.sum(axis=1) / max(len(embedded) - 1, 1)
    density = density[density > 0]
    if len(density) == 0:
        return 0.45
    hist, _ = np.histogram(density, bins=10, range=(0, 1), density=True)
    hist = hist[hist > 0]
    return float(-np.sum(hist * np.log(hist + 1e-12)))


def _dfa(series: np.ndarray) -> float:
    """Detrended fluctuation analysis scaling exponent (alpha)."""
    if len(series) < 16:
        return 0.55
    y = np.cumsum(series - np.mean(series))
    sizes = [4, 8, 16, 32]
    sizes = [s for s in sizes if s < len(y)]
    if len(sizes) < 2:
        return 0.55
    fluctuations = []
    for size in sizes:
        n_seg = len(y) // size
        if n_seg < 1:
            continue
        rms = []
        for i in range(n_seg):
            segment = y[i * size : (i + 1) * size]
            x = np.arange(size)
            coeff = np.polyfit(x, segment, 1)
            trend = np.polyval(coeff, x)
            rms.append(np.sqrt(np.mean((segment - trend) ** 2)))
        fluctuations.append((size, np.mean(rms)))
    if len(fluctuations) < 2:
        return 0.55
    log_sizes = np.log([f[0] for f in fluctuations])
    log_fluc = np.log(np.array([f[1] for f in fluctuations]) + 1e-12)
    alpha = np.polyfit(log_sizes, log_fluc, 1)[0]
    return float(np.clip(alpha, 0.3, 1.2))


def _ppe(pitch_values: np.ndarray, bins: int = 50) -> float:
    """Pitch period entropy."""
    if len(pitch_values) < 5:
        return 0.2
    periods = 1.0 / np.clip(pitch_values, _PITCH_FLOOR, _PITCH_CEILING)
    hist, _ = np.histogram(periods, bins=bins, density=True)
    hist = hist[hist > 0]
    if len(hist) == 0:
        return 0.2
    entropy = -np.sum(hist * np.log(hist + 1e-12))
    return float(np.clip(entropy / 10.0, 0.05, 0.9))


def extract_oxford_voice_features(audio_path: str) -> Dict[str, float]:
    """Extract 16 voice biomarkers aligned with the Oxford telemonitoring CSV."""
    try:
        import parselmouth
        from parselmouth.praat import call
    except ImportError as exc:
        raise ImportError(
            "praat-parselmouth required for UPDRS inference: pip install praat-parselmouth"
        ) from exc

    sound = parselmouth.Sound(str(audio_path))
    pitch = call(sound, "To Pitch", 0.0, _PITCH_FLOOR, _PITCH_CEILING)
    point_process = call(sound, "To PointProcess (periodic, cc)", _PITCH_FLOOR, _PITCH_CEILING)

    jitter_pct = _safe_float(
        call(point_process, "Get jitter (local)", 0, 0, 0.0001, 0.02, 1.3) * 100
    )
    jitter_abs = _safe_float(
        call(point_process, "Get jitter (local, absolute)", 0, 0, 0.0001, 0.02, 1.3)
    )
    jitter_rap = _safe_float(
        call(point_process, "Get jitter (rap)", 0, 0, 0.0001, 0.02, 1.3)
    )
    jitter_ppq5 = _safe_float(
        call(point_process, "Get jitter (ppq5)", 0, 0, 0.0001, 0.02, 1.3)
    )
    jitter_ddp = _safe_float(
        call(point_process, "Get jitter (ddp)", 0, 0, 0.0001, 0.02, 1.3)
    )

    shimmer = _safe_float(
        call([sound, point_process], "Get shimmer (local)", 0, 0, 0.0001, 0.02, 1.3, 1.6)
    )
    shimmer_db = _safe_float(
        call([sound, point_process], "Get shimmer (local_dB)", 0, 0, 0.0001, 0.02, 1.3, 1.6)
    )
    shimmer_apq3 = _safe_float(
        call([sound, point_process], "Get shimmer (apq3)", 0, 0, 0.0001, 0.02, 1.3, 1.6)
    )
    shimmer_apq5 = _safe_float(
        call([sound, point_process], "Get shimmer (apq5)", 0, 0, 0.0001, 0.02, 1.3, 1.6)
    )
    shimmer_apq11 = _safe_float(
        call([sound, point_process], "Get shimmer (apq11)", 0, 0, 0.0001, 0.02, 1.3, 1.6)
    )
    shimmer_dda = _safe_float(
        call([sound, point_process], "Get shimmer (dda)", 0, 0, 0.0001, 0.02, 1.3, 1.6)
    )

    harmonicity = call(sound, "To Harmonicity (cc)", 0.01, _PITCH_FLOOR, 0.1, 1.0)
    hnr = _safe_float(call(harmonicity, "Get mean", 0, 0), default=20.0)
    nhr = _safe_float(1.0 / (hnr + 1e-6) if hnr > 0 else 0.02, default=0.02)

    pitch_values = pitch.selected_array["frequency"]
    pitch_values = pitch_values[pitch_values > 0]
    if len(pitch_values) < 5:
        pitch_values = np.array([150.0, 152.0, 148.0, 151.0, 149.0])

    rpde = _rpde(pitch_values)
    dfa = _dfa(pitch_values)
    ppe = _ppe(pitch_values)

    return {
        "Jitter(%)": jitter_pct,
        "Jitter(Abs)": jitter_abs,
        "Jitter:RAP": jitter_rap,
        "Jitter:PPQ5": jitter_ppq5,
        "Jitter:DDP": jitter_ddp,
        "Shimmer": shimmer,
        "Shimmer(dB)": shimmer_db,
        "Shimmer:APQ3": shimmer_apq3,
        "Shimmer:APQ5": shimmer_apq5,
        "Shimmer:APQ11": shimmer_apq11,
        "Shimmer:DDA": shimmer_dda,
        "NHR": nhr,
        "HNR": hnr,
        "RPDE": rpde,
        "DFA": dfa,
        "PPE": ppe,
    }


def build_updrs_feature_row(
    audio_path: str,
    age: int,
    sex: int,
    test_time_days: float,
    feature_columns: Optional[list] = None,
) -> Dict[str, float]:
    """Build one feature row for the UPDRS XGBoost model."""
    voice = extract_oxford_voice_features(audio_path)
    row = {
        "age": float(age),
        "sex": float(sex),
        "test_time": float(test_time_days),
        **voice,
    }
    columns = feature_columns or OXFORD_FEATURE_COLUMNS
    return {col: float(row.get(col, 0.0)) for col in columns}
