# Deployment Design: Vercel + Render

**Date:** 2026-03-21
**Project:** make-it-make-sense
**Status:** Approved

## Overview

Deploy the two-service architecture (Next.js frontend + FastAPI backend) using Vercel for the frontend and Render for the backend. All deployment configuration is stored in the repo as code; secret values are set manually in the respective dashboards.

## Files to Create

### `render.yaml` (repo root)

Declares the Render web service for the FastAPI backend.

```yaml
services:
  - type: web
    name: make-it-make-sense-backend
    runtime: python
    rootDir: backend
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn main:app --host 0.0.0.0 --port $PORT
    envVars:
      - key: GEMINI_API_KEY
        sync: false
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_SERVICE_ROLE_KEY
        sync: false
      - key: ALLOWED_ORIGINS
        sync: false
```

### `backend/.env.example`

Documents required backend environment variables (no secrets).

```
GEMINI_API_KEY=your-google-ai-api-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
ALLOWED_ORIGINS=https://your-app.vercel.app
```

### `frontend/.env.example`

Documents required frontend environment variables.

```
NEXT_PUBLIC_BACKEND_URL=https://your-backend.onrender.com
```

## Files to Modify

### `backend/main.py` — CORS origins

Replace the hardcoded `allow_origins` list with env-var–driven origins:

```python
_origins_raw = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000")
origins = [o.strip() for o in _origins_raw.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

- In production: set `ALLOWED_ORIGINS=https://your-app.vercel.app` in Render dashboard
- Locally: env var absent → falls back to `http://localhost:3000` (no local `.env` change needed)

## Vercel Deployment

Vercel auto-detects Next.js. No `vercel.json` is needed if the project is imported with `frontend/` as the root directory in the Vercel dashboard.

**Vercel project settings:**
- Root directory: `frontend/`
- Framework: Next.js (auto-detected)
- Build command: `npm run build` (auto-detected)
- Output directory: `.next` (auto-detected)

**Env var to set in Vercel dashboard:**
- `NEXT_PUBLIC_BACKEND_URL` → Render service URL (e.g. `https://make-it-make-sense-backend.onrender.com`)

## Render Deployment

**Steps:**
1. Connect GitHub repo to Render
2. Render reads `render.yaml` automatically and creates the service
3. Set the four env vars manually in Render dashboard:
   - `GEMINI_API_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ALLOWED_ORIGINS` (set after Vercel URL is known)

**Note:** Render free tier spins down after inactivity (~15 min). The first request after spin-down will be slow. Upgrade to a paid instance type to avoid this if needed.

## Deployment Order

1. Push repo to GitHub
2. Deploy backend on Render first → get the Render URL
3. Deploy frontend on Vercel → set `NEXT_PUBLIC_BACKEND_URL` to the Render URL
4. Set `ALLOWED_ORIGINS` on Render to the Vercel URL
5. Redeploy backend (or it picks up the env var on next restart)

## What Stays Out of Git

- All `.env` and `.env.local` files (already in `.gitignore`)
- Secret values — set only in dashboards
- `.venv/` and `node_modules/` (already in `.gitignore`)
