# Make It Make Sense

Real-time AI fact-checker that listens to live audio, detects factual claims, and verifies them against trusted sources — instantly.

## What it does

1. You pick a context preset (political speech, news broadcast, earnings call, podcast)
2. The app listens via your microphone
3. Gemini Live API transcribes the audio and flags factual claims in real time
4. Each claim is immediately fact-checked using Gemini 2.5 Flash + Google Search
5. Verdicts appear as cards: **TRUE**, **FALSE**, **MISLEADING**, or **UNVERIFIED**
6. Every session and its claims are saved to Supabase for review

Verdicts are forced to **UNVERIFIED** if no citation from a trusted domain (Reuters, BBC, `.gov`, etc.) is found — no source, no verdict.

## Stack

- **Frontend**: Next.js 15, TypeScript, Tailwind CSS
- **Backend**: FastAPI (Python), Google Gemini SDK
- **AI**: Gemini Live API (audio transcription + claim detection), Gemini 2.5 Flash (fact-checking)
- **Database**: Supabase (sessions + claims)
- **Deployment**: Vercel (frontend) + Render (backend)

## Architecture

```
Browser ──getUserMedia──→ Gemini Live API (ephemeral token, WebSocket)
  │                              │
  │ ←── transcript deltas ───────┘
  │ ←── report_claim() function calls
  │
  ├──POST /api/fact-check──→ FastAPI ──→ Gemini 2.5 Flash + Google Search
  │                              │              │
  │ ←── FactCheckResponse ───────┘       source_filter.py
  │
  └──POST /api/session──────→ Supabase (sessions + claims)
```

Two services, no shared code:

- **WebSocket path**: browser mic → backend `/ws/live` → Gemini Live API (proxied)
- **HTTP path**: detected claims → `POST /api/fact-check` → Gemini 2.5 Flash

## Running locally

### Prerequisites

- Python 3.11+ with `uv`
- Node.js 18+
- A Google AI API key ([get one here](https://aistudio.google.com/))
- A Supabase project

### 1. Apply the Supabase schema

Run this SQL in your Supabase dashboard → SQL Editor:

```sql
CREATE TYPE verdict_type AS ENUM ('TRUE', 'FALSE', 'MISLEADING', 'UNVERIFIED');

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  context_preset TEXT NOT NULL,
  context_detail TEXT,
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
```

### 2. Configure the backend

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```env
GEMINI_API_KEY=your_google_ai_api_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...   # Secret key, not the anon key
```

### 3. Configure the frontend

```bash
echo "NEXT_PUBLIC_BACKEND_URL=http://localhost:8000" > frontend/.env.local
```

### 4. Start both services

```bash
# Terminal 1 — Backend
cd backend && uv pip install -r requirements.txt && source .venv/bin/activate && uvicorn main:app --reload

# Terminal 2 — Frontend
cd frontend && npm install && npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## API reference

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/api/token` | Get ephemeral Gemini Live API token |
| `POST` | `/api/fact-check` | Fact-check a claim |
| `POST` | `/api/session` | Create a new session |
| `GET` | `/api/session/{id}` | Get session + all claims |
| `PATCH` | `/api/session/{id}` | End session |

## Key modules

### Backend

| File | Purpose |
|------|---------|
| `main.py` | FastAPI app, CORS, all routes, WebSocket proxy to Gemini Live |
| `fact_check.py` | Fact-check pipeline: Gemini 2.5 Flash + Google Search + source filtering |
| `source_filter.py` | Trusted domain whitelist (Reuters, BBC, AP, `.gov`, etc.) |
| `prompts.py` | System instructions for each context preset |
| `gemini_live.py` | Ephemeral token generation for client-side Live API |
| `supabase_client.py` | Supabase CRUD for sessions and claims |

### Frontend

| File | Purpose |
|------|---------|
| `hooks/use-gemini-live.ts` | WebSocket lifecycle, mic capture, AudioWorklet, auto-reconnect |
| `hooks/use-fact-check.ts` | POST claims to backend, deduplicate, manage verdict state |
| `components/verdict-card.tsx` | Single verdict with badge, summary, and source link |
| `components/transcript-panel.tsx` | Scrolling transcript with claim highlights |
| `app/session/[id]/page.tsx` | Live session view |
| `app/summary/[id]/page.tsx` | Post-session summary |

## Notes

- The Live WebSocket auto-reconnects at 13.5 minutes to stay within Gemini's 15-minute session limit
- `SUPABASE_SERVICE_ROLE_KEY` must be the new **Secret key** (`sb_secret_...`), not the legacy service_role JWT
- Audio is captured at 16kHz PCM mono via the Web Audio API's AudioWorklet
