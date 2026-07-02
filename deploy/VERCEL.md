# Vercel deployment

Deploy the Next.js frontend from the `frontend/` directory.

## Steps

1. Go to [vercel.com/new](https://vercel.com/new) → Import Git repository `tanishR28/Vocalis`
2. **Root Directory:** `frontend` (click Edit → set to `frontend`)
3. **Framework:** Next.js (auto-detected)
4. **Environment variables** (Production):

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_API_URL` | `https://<username>-vocalis-api.hf.space` |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (public) key |
| `NEXT_PUBLIC_REQUIRE_AUTH` | `true` |

5. Deploy
6. Copy the Vercel URL (e.g. `https://vocalis.vercel.app`)
7. Update **Supabase** → Auth → URL configuration:
   - Site URL: your Vercel URL
   - Redirect URLs: `https://<vercel-url>/auth/callback`
8. Update **HF Space secrets** → `CORS_ORIGINS`:
   ```
   https://<vercel-url>,http://localhost:3000
   ```
9. Redeploy HF Space if CORS changed (or restart the Space)

## Local vs production

| Variable | Local | Production |
|----------|-------|------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | HF Space URL |
| `NEXT_PUBLIC_REQUIRE_AUTH` | `false` | `true` |

## Verify

- Visit Vercel URL → redirects to `/onboarding`
- Google sign-in works
- After onboarding, dashboard loads and API calls hit HF Space (Network tab)
