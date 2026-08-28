# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Quality gates (preferred)

```bash
make install          # backend+frontend deps + git hooks (pre-commit, pre-push)
make hooks            # install/reinstall git hooks only
make sync-main        # fetch + update local main to origin/main (start new tasks here)
make fmt              # ruff + prettier
make check            # Maximal suite (same as pre-push) — sectioned fail-fast
make lint typecheck test build smoke-backend   # individual targets
```

Never use `git commit --no-verify` or `git push --no-verify`. Ship via normal `git push` (runs `make check` once).

New task / worktree: run `make sync-main`, then create the branch from updated main. Cursor blocks `git switch -c` / `checkout -b` / `worktree add` if HEAD does not contain `origin/main`.

Before `gh pr create`, update from `origin/main` (merge or rebase) so the branch contains main and has no conflicts — Cursor hook enforces this for agents. GitHub does not gate merge on up-to-date.

### Backend
```bash
cd backend && source .venv/bin/activate && uvicorn main:app --reload
```
Dependencies: `make install` or `cd backend && uv pip install -r requirements.txt -r requirements-dev.txt`

Environment: copy `backend/.env.example` → `backend/.env` and fill in:
- `GEMINI_API_KEY` — Gemini API key
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — from Supabase dashboard (service role also verifies access tokens via Auth API)
- `ALLOWED_ORIGINS` — set to `http://localhost:3000` for local dev

Frontend env (`frontend/.env.local`): `NEXT_PUBLIC_BACKEND_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Auth: email/password via Supabase Auth. Begin silently creates an Anonymous Account for a one-minute first Session; creating an email Account converts that user in place. Session HTTP, fact-check, and `/ws/live` require JWT. Sessions store `user_id`. Schema migration: `docs/supabase-auth-migration.sql`. ADRs: `docs/adr/0001-supabase-auth.md`, `docs/adr/0003-anonymous-trial.md`.

Unit tests (in `make check`):
```bash
cd backend && .venv/bin/python -m pytest tests -q
```

Manual Live/Gemini flow tests (API keys / mic required — **not** in `make check`):
```bash
cd backend && .venv/bin/python scripts/test_claims.py
cd backend && .venv/bin/python scripts/test_live.py
cd backend && .venv/bin/python scripts/test_tool_cycle.py
```

### Frontend
```bash
cd frontend && npm run dev      # dev server
cd frontend && npm run build    # production build
cd frontend && npm run lint     # eslint
cd frontend && npm run typecheck
cd frontend && npm run test     # vitest
cd frontend && npm run format   # prettier
```

## Architecture

Two separate services that never share code:

**Browser → FastAPI Backend → Gemini Live API** (proxied WebSocket)
- Browser captures mic at 16kHz PCM mono via AudioWorklet
- Streams audio chunks to backend `/ws/live`, which proxies to Gemini Live via the Python SDK
- Backend sets the system instruction and tools; Gemini transcribes and calls `report_claim()` when a factual claim is detected

**Browser → FastAPI Backend** (HTTP)
- Each detected claim → `POST /api/fact-check` → Gemini 2.5 Flash + Google Search
- Sessions and claims persisted to Supabase

### Key data flow rules
- Verdicts are **forced to UNVERIFIED** if no URL from a trusted domain is found in grounding citations (`source_filter.py` maintains the whitelist)
- The Live WebSocket auto-reconnects at 13.5 min to stay within Gemini's 15-min session limit
- `SUPABASE_SERVICE_ROLE_KEY` in `backend/.env` maps to Supabase's new **Secret key** (`sb_secret_...`), not the legacy service_role JWT

### Backend modules
- `main.py` `/ws/live` — proxies browser audio to Gemini Live via Python SDK; owns system instruction and `report_claim` tool config
- `fact_check.py` — calls Gemini 2.5 Flash with `google_search` tool, extracts grounding citations, filters for trusted sources
- `source_filter.py` — trusted domain list + `.gov` pattern match
- `prompts.py` — system instructions per preset (political, news, earnings, podcast)
- `supabase_client.py` — thin wrapper around supabase-py

### Frontend hooks
- `use-gemini-live.ts` — owns the WebSocket lifecycle, mic capture, AudioWorklet, auto-reconnect, and emits `DetectedClaim` events
- `use-fact-check.ts` — fires parallel `POST /api/fact-check` calls for each claim, deduplicates by `claim_text` via `lib/claim-dedupe.ts`

### Supabase schema
Must be applied manually in the Supabase SQL editor — see `CONTEXT.md` for the full SQL. Two tables: `sessions` and `claims`, with a `verdict_type` enum.

## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues (`gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical roles map 1:1 to GitHub labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
