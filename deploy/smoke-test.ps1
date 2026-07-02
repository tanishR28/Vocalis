#!/usr/bin/env pwsh
# Pre-deploy smoke test — run locally before connecting Vercel / HF Space.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

Write-Host "=== Frontend build ===" -ForegroundColor Cyan
Push-Location "$root/frontend"
npm run build
Pop-Location

Write-Host "`n=== ML model files ===" -ForegroundColor Cyan
$required = @(
  "ML/models/parkinsons_xgb.joblib",
  "ML/models/parkinsons_updrs_features.joblib",
  "ML/models/parkinsons_lstm.keras",
  "ML/models/parkinsons_lstm_scaler.joblib",
  "ML/models/asthma_xgb.pkl",
  "ML/models/asthma_scaler.joblib"
)
foreach ($f in $required) {
  $path = Join-Path $root $f
  if (Test-Path $path) {
    Write-Host "  OK  $f"
  } else {
    Write-Host "  MISSING  $f" -ForegroundColor Red
    exit 1
  }
}

Write-Host "`n=== Backend health (requires running uvicorn) ===" -ForegroundColor Cyan
try {
  $r = Invoke-RestMethod -Uri "http://localhost:8000/" -TimeoutSec 5
  Write-Host "  OK  GET / -> $($r.message)"
} catch {
  Write-Host "  SKIP  Backend not running at localhost:8000 (start: cd backend && uvicorn main:app --reload)"
}

Write-Host "`n=== Production checklist (manual) ===" -ForegroundColor Cyan
@(
  "HF Space /docs loads",
  "Vercel onboarding + Google sign-in",
  "Record voice -> dashboard scores",
  "Insights chart + LSTM forecast (Parkinson's)"
) | ForEach-Object { Write-Host "  [ ] $_" }

Write-Host "`nDone." -ForegroundColor Green
