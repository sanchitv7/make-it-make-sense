# Make It Make Sense

Real-time AI fact-checker that listens to live audio, detects factual claims, and verifies them against trusted sources — instantly.

## What it does

1. You tap Begin (no email required for the first 30-second preview)
2. You pick a context preset (political speech, news broadcast, earnings call, podcast)
3. The app listens via your microphone
4. Gemini Live API transcribes the audio and flags factual claims in real time
5. Each claim is immediately fact-checked using Gemini 2.5 Flash + Google Search
6. Verdicts appear as cards: **TRUE**, **FALSE**, **MISLEADING**, or **UNVERIFIED**
7. After the preview, create an account to keep past sessions, listen past 30 seconds, and copy a shareable verdict link

Verdicts are forced to **UNVERIFIED** if no citation from a trusted domain (Reuters, BBC, `.gov`, etc.) is found — no source, no verdict.

## Stack

- **Frontend**: Next.js 15, TypeScript, Tailwind CSS, Supabase Auth (`@supabase/ssr`)
- **Backend**: FastAPI (Python), Google Gemini SDK, JWT verification
- **AI**: Gemini Live API (audio transcription + claim detection), Gemini 2.5 Flash (fact-checking)
- **Database**: Supabase (accounts via Auth, sessions + claims)
- **Deployment**: Vercel (frontend) + Render (backend)

## Architecture

```
Browser ──mic──→ FastAPI /ws/live (JWT) ──→ Gemini Live API
  │
  ├──POST /api/fact-check (JWT)──→ Gemini 2.5 Flash + Google Search
  │
  └──POST /api/session (JWT)─────→ Supabase (sessions.user_id + claims)
```

## Running locally

### Prerequisites

- Python 3.11+ with `uv`
- Node.js 18+
- A Google AI API key ([get one here](https://aistudio.google.com/))
- A Supabase project

### 1. Apply the Supabase schema

Run this SQL in your Supabase dashboard → SQL Editor (or apply `docs/supabase-auth-migration.sql` then `docs/supabase-sessions-board-migration.sql` if tables already exist — the latter wipes existing sessions/claims and adds `title`/`blurb`):

```sql
CREATE TYPE verdict_type AS ENUM ('TRUE', 'FALSE', 'MISLEADING', 'UNVERIFIED');

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  context_preset TEXT NOT NULL,
  context_detail TEXT,
  title TEXT,
  blurb TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);

CREATE TABLE claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id),
  claim_text TEXT NOT NULL,
  timestamp_seconds INT NOT NULL,
  verdict verdict_type NOT NULL DEFAULT 'UNVERIFIED',
  verdict_summary TEXT,
  source_name TEXT,
  source_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_claims_session ON claims(session_id);
CREATE INDEX sessions_user_id_idx ON sessions(user_id);

-- Deny anon/authenticated direct table access; service role bypasses RLS.
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
-- no policies: anon/authenticated denied; service role bypasses
```

### 2. Configure Supabase Auth

1. Authentication → Providers → Email: enabled
2. Turn **Confirm email** on (stops accounts from being created with unverified addresses)
3. Authentication → Providers: enable **Anonymous sign-ins**
4. Authentication → Providers: enable **Manual linking** (needed to convert an anonymous user to email/password)
5. Authentication → URL configuration: add `http://localhost:3000/auth/callback` and `http://localhost:3000/auth/reset` (and the matching production URLs) to the redirect allow list
6. Copy **Project URL** and **anon key** (Settings → API)

### 3. Configure the backend

```bash
cp backend/.env.example backend/.env
```

```env
GEMINI_API_KEY=your_google_ai_api_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
```

### 4. Configure the frontend

```bash
cp frontend/.env.example frontend/.env.local
```

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### 5. Install deps and git hooks

```bash
make install   # uv backend deps, npm ci, pre-commit + pre-push hooks
```

Quality gate (same suite as `git push`):

```bash
make check
```

### 6. Start both services

```bash
# Terminal 1 — Backend
cd backend && source .venv/bin/activate && uvicorn main:app --reload

# Terminal 2 — Frontend
cd frontend && npm run dev
```

Open [http://localhost:3000](http://localhost:3000). **Begin** starts a 30-second preview without an email. After that, creating an account keeps the trial session and unlocks unlimited listening, Past Sessions, and copyable verdict links. **Sign in** is still in the header.

## Contributing / quality gates

- Run `make install` once per clone so git hooks are active.
- `pre-commit` formats/lints/scans secrets on commit; `pre-push` runs full `make check`.
- Do not use `--no-verify` unless you are intentionally bypassing in an emergency (agents must not).
- Unit tests: `backend/tests/`, frontend Vitest (`*.test.ts`). Manual Live scripts: `backend/scripts/`.

## API reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | public | Health check |
| `GET` | `/api/account` | JWT | Anonymous flag + trial used |
| `POST` | `/api/fact-check` | JWT + ownership | Fact-check a claim |
| `POST` | `/api/session` | JWT | Create a new session (anonymous: one only) |
| `GET` | `/api/sessions` | JWT | List ended sessions with claims |
| `GET` | `/api/session/{id}` | JWT + ownership | Get session + all claims |
| `PATCH` | `/api/session/{id}` | JWT + ownership | End session (async title/blurb) |
| `WS` | `/ws/live` | JWT first message (`type: auth`, plus `session_id` for anonymous) | Live audio proxy |

## Key modules

### Backend

| File | Purpose |
|------|---------|
| `main.py` | FastAPI app, CORS, JWT-gated routes, WebSocket proxy |
| `auth.py` | Verify Supabase access tokens (`Principal.is_anonymous`) |
| `trial.py` | Anonymous trial duration and one-Session gate |
| `fact_check.py` | Fact-check pipeline |
| `session_blurb.py` | One-shot session title/blurb |
| `session_cards.py` | Past Sessions card assembly |
| `source_filter.py` | Trusted domain whitelist |
| `prompts.py` | System instructions per context preset |
| `supabase_client.py` | Supabase CRUD + ownership checks |

### Frontend

| File | Purpose |
|------|---------|
| `components/auth-modal.tsx` | Sign in / sign up / forgot password |
| `components/auth-provider.tsx` | Auth state + helpers |
| `hooks/use-gemini-live.ts` | WebSocket + mic (passes JWT) |
| `hooks/use-fact-check.ts` | Authenticated fact-check calls |
| `app/auth/callback/route.ts` | PKCE exchange for confirm-email links |
| `app/auth/reset/page.tsx` | Password recovery |
| `app/sessions/page.tsx` | Past Sessions card board |

## Notes

- The Live WebSocket auto-reconnects at 13.5 minutes to stay within Gemini's 15-minute session limit
- `SUPABASE_SERVICE_ROLE_KEY` must be the new **Secret key** (`sb_secret_...`), not the legacy service_role JWT
- Audio is captured at 16kHz PCM mono via the Web Audio API's AudioWorklet
- Ending a session kicks off a cheap Gemini title/blurb for the verdict page and Sessions board
