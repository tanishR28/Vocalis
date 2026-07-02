---
title: Vocalis API
emoji: 🎙️
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
license: mit
---

# Vocalis API

FastAPI backend for Vocalis — voice biomarker analysis with XGBoost, TensorFlow LSTM forecast, and Supabase persistence.

- **Docs:** `/docs`
- **Health:** `/`

Set these secrets in Space Settings → Variables and secrets:

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server only) |
| `CORS_ORIGINS` | Comma-separated frontend URLs, e.g. `https://your-app.vercel.app,http://localhost:3000` |

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for full setup.
