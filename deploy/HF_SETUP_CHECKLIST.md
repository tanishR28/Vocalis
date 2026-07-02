# Hugging Face Space — one-time setup checklist

After pushing to GitHub, create the API Space:

1. Open https://huggingface.co/new-space
2. **Name:** `vocalis-api`
3. **SDK:** Docker
4. **Hardware:** CPU basic (free)
5. **Repo:** Link `tanishR28/Vocalis` (monorepo — uses root `Dockerfile`)

## Secrets (Settings → Variables and secrets)

```
SUPABASE_URL=<from backend/.env>
SUPABASE_SERVICE_ROLE_KEY=<from backend/.env — never commit>
CORS_ORIGINS=https://frontend-six-gray-tx72065yzw.vercel.app,http://localhost:3000
```

## Verify

- Build logs finish without error (~5–10 min for TensorFlow)
- Open `https://tanishr28-vocalis-api.hf.space/docs`

## Then deploy frontend

```powershell
powershell -ExecutionPolicy Bypass -File deploy/set-vercel-env.ps1 -ApiUrl "https://tanishr28-vocalis-api.hf.space"
```

Update Supabase → Auth → URL configuration:

- Site URL: `https://frontend-six-gray-tx72065yzw.vercel.app`
- Redirect URL: `https://frontend-six-gray-tx72065yzw.vercel.app/auth/callback`
