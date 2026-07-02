"""Parkinson's LSTM progression forecast API."""

import sys
import traceback
from pathlib import Path
from typing import Optional

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from config import ML_DIR
from models.schemas import ParkinsonForecastRequest, ParkinsonForecastResponse
from routers.analysis import supabase
from services.lstm_history import (
    compute_forecast_trend,
    fetch_parkinsons_lstm_history,
)

router = APIRouter(prefix="/forecast", tags=["forecast"])

ml_model_dir = str(ML_DIR)
if ml_model_dir not in sys.path:
    sys.path.insert(0, ml_model_dir)

try:
    from ml_config import lstm_sequence_length  # type: ignore
    from inference.predict_parkinsons_lstm import forecast_parkinsons, get_forecaster  # type: ignore
except ImportError as import_error:
    print(f"[ERROR] Failed to import LSTM forecaster from {ml_model_dir}: {import_error}")
    lstm_sequence_length = lambda: 10  # type: ignore
    forecast_parkinsons = None  # type: ignore
    get_forecaster = None  # type: ignore


@router.post("/parkinsons", response_model=ParkinsonForecastResponse)
async def forecast_parkinsons_progression(body: ParkinsonForecastRequest):
    """Predict future motor_UPDRS from the patient's last N LSTM history rows."""
    try:
        sessions_required = lstm_sequence_length()
        history_rows, sessions_available = fetch_parkinsons_lstm_history(
            supabase,
            user_id=body.user_id,
        )

        if sessions_available < sessions_required:
            remaining = sessions_required - sessions_available
            return ParkinsonForecastResponse(
                ready=False,
                sessions_available=sessions_available,
                sessions_required=sessions_required,
                message=(
                    f"Need {remaining} more session{'s' if remaining != 1 else ''} "
                    f"with complete UPDRS history before forecasting."
                ),
            )

        if forecast_parkinsons is None or get_forecaster is None or not get_forecaster().ready:
            return JSONResponse(
                status_code=500,
                content={"error": f"LSTM forecaster failed to load. Checked path: {ml_model_dir}"},
            )

        result = forecast_parkinsons(history_rows)
        predicted = float(result["predicted_motor_updrs"])
        current = float(history_rows[-1]["motor_UPDRS"])
        delta = round(predicted - current, 2)
        trend = compute_forecast_trend(delta)

        return ParkinsonForecastResponse(
            ready=True,
            predicted_motor_updrs=round(predicted, 2),
            current_motor_updrs=round(current, 2),
            delta=delta,
            trend=trend,
            sessions_available=sessions_available,
            sessions_required=sessions_required,
        )

    except Exception as error:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(error) or repr(error)})


@router.get("/parkinsons/status", response_model=ParkinsonForecastResponse)
async def forecast_parkinsons_status(user_id: Optional[str] = None):
    """Return how many complete LSTM sessions are available (no prediction)."""
    from services.lstm_history import fetch_all_complete_lstm_rows

    sessions_required = lstm_sequence_length()
    all_rows = fetch_all_complete_lstm_rows(supabase, user_id=user_id)
    sessions_available = len(all_rows)

    ready = sessions_available >= sessions_required
    message = None
    if not ready:
        remaining = sessions_required - sessions_available
        message = (
            f"Need {remaining} more session{'s' if remaining != 1 else ''} "
            f"with complete UPDRS history before forecasting."
        )

    current = round(float(all_rows[-1]["motor_UPDRS"]), 2) if all_rows else None

    return ParkinsonForecastResponse(
        ready=ready,
        current_motor_updrs=current,
        sessions_available=sessions_available,
        sessions_required=sessions_required,
        message=message,
    )
