# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend
```bash
cd backend && source .venv/bin/activate && uvicorn main:app --reload
```
Dependencies: `cd backend && uv pip install -r requirements.txt`

### Frontend
```bash
cd frontend && npm run dev      # dev server
cd frontend && npm run build    # production build
cd frontend && npm run lint     # eslint
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
- `use-fact-check.ts` — fires parallel `POST /api/fact-check` calls for each claim, deduplicates by `claim_text`

### Supabase schema
Must be applied manually in the Supabase SQL editor — see `CONTEXT.md` for the full SQL. Two tables: `sessions` and `claims`, with a `verdict_type` enum.
