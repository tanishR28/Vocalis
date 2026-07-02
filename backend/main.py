"""
Vocalis — FastAPI Backend
Main application entry point with CORS middleware and routing.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pathlib import Path

from config import get_cors_origins

# Load backend/.env regardless of where uvicorn is launched from.
load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env")

from routers.analysis import router as analysis_router
from routers.forecast import router as forecast_router

app = FastAPI(
    title="Vocalis API",
    description="AI-powered vocal biomarker analysis for disease tracking. "
                "Analyzes voice recordings to extract tremor, breathlessness, pitch, "
                "speech rate, pause patterns, and other clinically-relevant biomarkers.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(analysis_router)
app.include_router(forecast_router)


@app.get("/")
async def root():
    return {
        "message": "Vocalis API",
        "docs": "/docs",
        "version": "1.0.0",
    }
