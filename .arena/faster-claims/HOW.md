# How: listen start and claim cards

Synthesized from explorers plus [How explainer](25dc5711-f6ab-4b4c-b594-c678a1920fb3).

## Overview

Two independent pipelines share a session page. Start is a serial handshake. Claims become cards only when Gemini Live emits `report_claim`. Fact-check does not gate insertion. The spoken-claim-to-card delay is turn end plus tool-call latency.

## Wait table

| Perceived wait | Actually blocked on |
|---|---|
| BEGIN LISTENING → session chrome | POST `/api/session` + navigation + auth + GET `/api/session/:id` |
| Session page → LIVE | `getUserMedia` + WS + JWT + Gemini Live `connect()` |
| LIVE → Gemini hearing you | AudioWorklet + Silero WASM + first `activity_start` |
| Spoken claim → card | Silero turn end (≤2.5s continuous, or +250ms pause) + Live tool-call generation |
| Card → verdict | `POST /api/fact-check` (does not delay the card) |

## Binding constraints

- Native-audio tools are sequential. Next generation waits on `tool_response`.
- Prompt cannot override turn-gated inference.
- `inputTranscription` never creates a `DetectedClaim`.
- React 18 batches same-tick `setClaims`. Multiple `report_claim`s in one message mount together with no stagger.
- LIVE flips at `setupComplete`, before Silero opens a turn.
- Empty 2.5s flush can fire before real speech because `beginListening` marks speaking true.

Full explorer notes live in the parent conversation. Key files listed in GROUNDING.md.
