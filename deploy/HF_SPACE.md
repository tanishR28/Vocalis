# Hugging Face Space deployment

Deploy the Vocalis API as a Docker Space with full ML stack (TensorFlow LSTM + XGBoost).

## Prerequisites

- Hugging Face account
- GitHub repo pushed with ML model files and root `Dockerfile`
- Supabase project configured (see [`docs/SUPABASE.md`](../docs/SUPABASE.md))

## Steps

1. Go to [huggingface.co/new-space](https://huggingface.co/new-space)
2. **Space name:** `vocalis-api` (or your choice)
3. **SDK:** Docker
4. **Hardware:** CPU basic (free — 16 GB RAM)
5. **Visibility:** Public (required for free hardware)
6. Connect GitHub repo `tanishR28/Vocalis` or clone and push:

```bash
git clone https://huggingface.co/spaces/<username>/vocalis-api
cd vocalis-api
# Copy Dockerfile, backend/, ML/ from Vocalis repo OR link same GitHub repo in HF settings
git push
```

If using the monorepo directly, HF reads the root [`Dockerfile`](../Dockerfile).

7. **Settings → Variables and secrets** → add:

```
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<secret>
CORS_ORIGINS=https://<your-app>.vercel.app,http://localhost:3000
```

8. Wait for build (~5–10 min for TensorFlow). Check **Logs** tab.
9. Verify: `https://<username>-vocalis-api.hf.space/docs`

## Notes

- Port **7860** is required by HF Spaces.
- `HF_HOME=/tmp/huggingface` redirects model caches away from the 50 GB disk cap.
- EasyOCR downloads weights on first PDF import — stored under `/tmp`.
- Wake the Space before demos (open `/docs`) — free tier sleeps after idle.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Build timeout | Retry; TensorFlow pip install is slow |
| 502 on wake | Wait 30–60s for cold start |
| Import error for ML | Ensure `ML/models/*.joblib` etc. are in the repo |
| CORS errors | Update `CORS_ORIGINALS` with exact Vercel URL (no trailing slash) |
