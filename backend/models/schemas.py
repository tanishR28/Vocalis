from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class TrendInfo(BaseModel):
    baseline: Optional[float] = None
    vs_yesterday: Optional[float] = None
    vs_baseline: Optional[float] = None
    weekly_change_pct: Optional[float] = None
    trend: str = "stable"
    risk: str = "moderate"
    alert: bool = False
    baseline_ready: bool = False
    weekly_ready: bool = False
    forecast: Optional[Dict[str, float]] = None


class AnalysisResponse(BaseModel):
    """Voice biomarker analysis result returned to the frontend."""
    recording_id: Optional[str] = None
    pitch_variation: float = Field(..., description="Pitch variation score")
    breath_score: float = Field(..., description="Breathlessness score")
    pause_score: float = Field(..., description="Pause pattern score")
    speech_rate: float = Field(..., description="Estimated speech rate")
    tremor_score: float = Field(0.0, description="Voice tremor score (jitter based)")
    signature_detected: float = Field(0.0, description="Signature detection severity")
    cough_detected: bool = Field(False, description="Asthma: cough burst signature")
    wheeze_detected: bool = Field(False, description="Asthma: wheeze signature")
    motor_updrs: Optional[float] = Field(None, description="Parkinson's: predicted motor_UPDRS")
    health_score: int = Field(..., description="Composite health score (0-100)")
    status: str = Field(..., description="Status string (e.g. Warning, OK, Critical)")
    severity: float = Field(0.0, description="Disease severity 0-100")
    stage: str = Field("Mild", description="Mild / Moderate / Severe")
    confidence: float = Field(0.0, description="Model confidence 0-1")
    speech_score: float = Field(0.0, description="Speech quality sub-score")
    breathlessness_score: float = Field(0.0, description="Breathlessness sub-score")
    trends: Optional[TrendInfo] = None
    analyzed_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    db_persisted: bool = Field(True, description="Whether analysis was saved to Supabase")
    persistence_warning: Optional[str] = Field(None, description="Non-fatal database persistence warning")


class AnalysisRequest(BaseModel):
    """Request metadata for analysis."""
    user_id: Optional[str] = None
    condition: Optional[str] = None
    notes: Optional[str] = None
