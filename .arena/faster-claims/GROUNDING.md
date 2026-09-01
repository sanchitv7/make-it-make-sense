# Grounding: faster listen start and claim cards

Read these files. Do not guess.

## Product

Real-time fact-check app. Mic audio → Gemini Live `report_claim` → claim card → `POST /api/fact-check` (Gemini Flash + Google Search) → verdict.

User goal: Begin Listening feels instant. A spoken claim becomes a card immediately (phasing / Verifying animation) while search continues. Three rapid claim-sentences become three staggered cards, not one batch after a pause.

## What the how pass found

Cards already insert on `report_claim`. Search does not gate the card. Delays:

1. BEGIN LISTENING is a serial handshake: POST session → navigate → middleware getUser → GET session → getUserMedia (from useEffect, not the click) → WS auth → Gemini `live.connect()` → synthetic setupComplete (LIVE) → AudioWorklet → Silero WASM/ONNX → `activity_start`. Trial clock starts at POST `started_at` (ADR 0003), including this wait.
2. Gemini Live only emits `report_claim` after a turn ends (`activity_end`). Turns end on Silero speech_end (~250ms redemption) or a 2.5s max-speech flush. Prompt asks for sentence-boundary reports; the protocol does not. Three sentences in one turn land as a batch after Gemini thinks.
3. `inputTranscription` streams into `segments` but the session page never renders them. `TranscriptPanel` is dead.
4. Claim UI state is three bags (`claims[]`, `checkingIds`, `verdicts`) joined by `claim_text` vs `claim.id`. No lifecycle type. DB insert is post-verdict only.
5. Top bar counts wait on first verdict, not first card.
6. LIVE means Gemini setupComplete, not mic/VAD ready. Empty copy says “Listening…” while OFFLINE.

## Claim-recognition extras (must honor)

- Native-audio Live function calling is sequential. The model will not start the next generation until `tool_response` arrives. The client already acks `{status:ok}` immediately. Do not wait on fact-check. Still serialize overlapping `report_claim` generations at Gemini.
- `NO_INTERRUPTION` plus `TURN_INCLUDES_ALL_INPUT`. A new turn does not abort in-flight generation.
- Prompt vs protocol. `prompts.py` asks for clause-level reports. Live with auto-VAD off only infers after `activity_end`.
- `beginListening` marks `speaking: true` with no speech, so the 2.5s flush fires during initial silence.
- Custom VAD has no server pre-speech buffer. PCM before the first `activity_start` is dropped.
- `browser_to_gemini` is one serial loop. A slow `send_realtime_input` delays `activity_end` and `tool_response`.
- Transcript chunks never create a `DetectedClaim`. Session empty state lasts until the first tool call.

## Constraints

- Domain words from `CONTEXT.md`: Account, Session, Claim, Verdict. Do not invent User/conversation.
- Keep JWT-gated `/ws/live` and `/api/fact-check`.
- Anonymous trial: 60s wall clock from `started_at` at session insert. Do not start the clock before the user means to listen, and do not burn the trial on warmup that never connects.
- Silero is the only VAD. No timer-VAD or server-VAD fallback (`use-gemini-live.vad.test.ts`).
- `ClaimCard` already has enter animation + Verifying skeleton. Prefer reusing it.
- Laziness: smallest shape that makes cards appear at sentence time and overlaps start. Do not add a second LLM detector unless the type sketch requires it.
- Experience First: user delight over implementation convenience.
- Model the Domain: encode Claim phases in a structure, not more booleans.
- Boundary Discipline: parse Gemini/WS at the hook boundary; session page consumes domain types.
- Type System Discipline: illegal combinations unrepresentable (no `isChecking` plus `result` plus missing claim).
- Separate before serializing: concurrent fact-checks already fan out; do not funnel claims through one mutex unless an invariant requires it.
- Idempotent: duplicate `report_claim` text, reconnect, and Strict Mode must converge.

## Key files

- `frontend/src/hooks/use-gemini-live.ts`
- `frontend/src/hooks/use-fact-check.ts`
- `frontend/src/lib/silero-vad.ts`
- `frontend/src/app/session/[id]/page.tsx`
- `frontend/src/components/context-setup.tsx`
- `frontend/src/components/claim-card.tsx`
- `frontend/src/components/verdict-feed.tsx`
- `frontend/src/types/index.ts`
- `backend/live_config.py`
- `backend/main.py` (`live_ws`, `create_session`, `check_fact`)
- `backend/prompts.py`
- `docs/adr/0003-anonymous-trial.md`
