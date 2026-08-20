# Make It Make Sense

Real-time AI fact-checking web app that listens to live audio, detects factual claims via Gemini Live API, and fact-checks them against trusted sources.

## Language

**Account**:
A signed-in identity (email/password via Supabase Auth) that owns listening Sessions.
On create account, the Account stores `full_name` in Auth `user_metadata`. The UI shows a shared AccountChip (person icon + first name) in the home header and session top bar.
_Avoid_: User (ambiguous), customer, profile

**Session**:
One listening run — mic on, claims detected, verdicts recorded — owned by an Account.
_Avoid_: Auth session (use Account / access token), conversation

**Claim**:
A factual statement detected in live audio that may be fact-checked.

**Verdict**:
The outcome of a fact-check on a Claim: TRUE, FALSE, MISLEADING, or UNVERIFIED.

## Architecture

```
Browser ──mic──→ FastAPI /ws/live (JWT) ──→ Gemini Live API
  │
  │──POST /api/session (JWT)──→ Supabase sessions (user_id)
  │──POST /api/fact-check (JWT)──→ Gemini 2.5 Flash + Google Search
```

Guests see the splash and how-it-works only. An Account is required to Begin and listen. Signed-in Accounts can open Past Sessions (`/sessions`) to reopen ended Sessions that have Claims.

## File Structure

### Backend (`backend/`)

- `main.py` — FastAPI app, CORS, JWT-gated routes, WebSocket proxy
- `auth.py` — Supabase JWT verification
- `models.py` — Pydantic request/response models
- `prompts.py` — System prompts per context preset + fact-check template
- `fact_check.py` — Fact-check pipeline
- `session_blurb.py` — One-shot Session title/blurb generation
- `source_filter.py` — Trusted domain whitelist
- `supabase_client.py` — Service-role CRUD for sessions and claims
- `requirements.txt` / `.env`

### Frontend (`frontend/`)

- `src/app/page.tsx` — Home (splash + gated setup)
- `src/app/auth/reset/page.tsx` — Password recovery
- `src/app/session/[id]/page.tsx` — Live listening
- `src/app/summary/[id]/page.tsx` — Session verdict report
- `src/app/sessions/page.tsx` — Past Sessions card board
- `src/components/auth-provider.tsx` / `auth-modal.tsx` / `site-header.tsx` / `account-chip.tsx`
- `src/lib/account-display-name.ts` — First-name label from Account `full_name`
- `src/lib/supabase/` — Browser/server/middleware clients
- `src/lib/api.ts` — Authenticated fetch helper
- `src/hooks/use-gemini-live.ts` / `use-fact-check.ts`

## Data Flow

1. Account signs in (or creates an account) via the auth modal
2. Account picks a context preset → `POST /api/session` (JWT) creates a Session with `user_id`
3. Session page opens → `/ws/live` auth message then proxies mic audio to Gemini Live
4. Each detected claim → `POST /api/fact-check` (JWT + ownership check)
5. On stop → `PATCH /api/session/{id}` ends the Session and kicks off a one-shot title/blurb generation → verdict page
6. Past Sessions board → `GET /api/sessions` lists ended Sessions with Claims for the Account

## API Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | public | Health check |
| POST | `/api/fact-check` | JWT + ownership | Fact-check a claim |
| POST | `/api/session` | JWT | Create Session for Account |
| GET | `/api/sessions` | JWT | List ended Sessions with Claims for Account |
| GET | `/api/session/{id}` | JWT + ownership | Get Session + claims |
| PATCH | `/api/session/{id}` | JWT + ownership | End Session (async title/blurb) |
| WS | `/ws/live` | JWT first message | Live audio proxy |

## Env Vars

| Variable | Location | Purpose |
|----------|----------|---------|
| GEMINI_API_KEY | backend/.env | Google AI API key |
| SUPABASE_URL | backend/.env | Supabase project URL |
| SUPABASE_SERVICE_ROLE_KEY | backend/.env | Service role / secret key (DB + token verification) |
| NEXT_PUBLIC_BACKEND_URL | frontend/.env.local | Backend URL |
| NEXT_PUBLIC_SUPABASE_URL | frontend/.env.local | Supabase project URL |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | frontend/.env.local | Supabase anon key |

## Supabase Schema

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

Existing projects: run [`docs/supabase-auth-migration.sql`](docs/supabase-auth-migration.sql), then [`docs/supabase-sessions-board-migration.sql`](docs/supabase-sessions-board-migration.sql) (wipes existing Sessions/Claims and adds `title`/`blurb`).

## Follow-ups

- Session retention / TTL (rows are stored indefinitely today)
