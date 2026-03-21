# Make It Make Sense

Real-time AI fact-checking web app that listens to live audio, detects factual claims via Gemini Live API, and fact-checks them against trusted sources.

## Architecture

```
Browser ──getUserMedia──→ Gemini Live API (direct WebSocket, ephemeral token)
  │                              │
  │ ←── transcript deltas ───────┘
  │ ←── report_claim() function calls
  │
  │──POST /api/fact-check──→ FastAPI Backend ──→ Gemini 2.5 Flash + Google Search
  │                              │                      │
  │ ←── FactCheckResponse ──────┘               source_filter.py
  │                              │
  │──POST /api/session─────→ Supabase (sessions + claims tables)
```

## File Structure

### Backend (`backend/`)
- `main.py` — FastAPI app, CORS, all routes (health, token, fact-check, session CRUD)
- `models.py` — Pydantic request/response models (FactCheckRequest, FactCheckResponse, etc.)
- `prompts.py` — System prompts for 4 context presets + fact-check prompt template
- `fact_check.py` — Fact-check pipeline: Gemini 2.5 Flash + Google Search + source filtering
- `gemini_live.py` — Ephemeral token generation for client-side Live API access
- `source_filter.py` — Trusted domain whitelist + URL filtering (reuters, bbc, gov, etc.)
- `supabase_client.py` — Supabase client init + CRUD for sessions and claims
- `requirements.txt` — Python dependencies
- `.env` — Environment variables (GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

### Frontend (`frontend/`)
- `src/app/page.tsx` — Home page (renders ContextSetup)
- `src/app/layout.tsx` — Root layout (dark theme, DM Sans + JetBrains Mono fonts)
- `src/app/globals.css` — Global styles, verdict colors, animations, grain texture
- `src/app/session/[id]/page.tsx` — Live session page (transcript + verdict feed)
- `src/app/summary/[id]/page.tsx` — Session summary page (all claims + verdicts)
- `src/components/context-setup.tsx` — Preset selection cards + start button
- `src/components/transcript-panel.tsx` — Scrolling transcript with claim highlighting
- `src/components/verdict-card.tsx` — Single verdict card with badge, summary, source link
- `src/components/verdict-feed.tsx` — Stack of verdict cards, newest on top
- `src/components/top-bar.tsx` — Session timer, claim count, verdict pills, stop button
- `src/hooks/use-gemini-live.ts` — WebSocket to Gemini Live API, mic capture, transcript/claim events
- `src/hooks/use-fact-check.ts` — POST claims to backend, manage verdict state
- `src/lib/prompts.ts` — Client-side copy of system prompts for Live API session config
- `src/types/index.ts` — All TypeScript interfaces
- `.env.local` — NEXT_PUBLIC_BACKEND_URL

## Data Flow

1. User selects a context preset → POST /api/session creates a Supabase session
2. Session page opens → fetches ephemeral token from GET /api/token
3. WebSocket connects to Gemini Live API with system instruction + report_claim tool
4. Mic audio is captured at 16kHz PCM mono, streamed via WebSocket
5. Gemini transcribes audio, detects claims, calls report_claim()
6. Each detected claim → POST /api/fact-check → Gemini 2.5 Flash + Google Search
7. Source URLs are filtered through trusted domain whitelist
8. If no trusted source → verdict forced to UNVERIFIED
9. Verdict card appears in feed, transcript highlights the claim
10. On stop → PATCH /api/session/{id} → navigate to summary page

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Health check |
| GET | /api/token | Get ephemeral Gemini Live API token |
| POST | /api/fact-check | Fact-check a claim |
| POST | /api/session | Create new session |
| GET | /api/session/{id} | Get session + all claims |
| PATCH | /api/session/{id} | End session (set ended_at) |

## Env Vars

| Variable | Location | Purpose |
|----------|----------|---------|
| GEMINI_API_KEY | backend/.env | Google AI API key for Gemini |
| SUPABASE_URL | backend/.env | Supabase project URL |
| SUPABASE_SERVICE_ROLE_KEY | backend/.env | Supabase service role key |
| NEXT_PUBLIC_BACKEND_URL | frontend/.env.local | Backend URL (default: http://localhost:8000) |

## Running Locally

```bash
# Terminal 1 — Backend
cd backend && source .venv/bin/activate && uvicorn main:app --reload

# Terminal 2 — Frontend
cd frontend && npm run dev
```

## Supabase Schema

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

## Build Status

- [x] Backend: all routes implemented and importing cleanly
- [x] Frontend: builds successfully, all pages and components in place
- [ ] Supabase: schema needs to be applied (run SQL in Supabase dashboard)
- [ ] End-to-end testing with live audio
