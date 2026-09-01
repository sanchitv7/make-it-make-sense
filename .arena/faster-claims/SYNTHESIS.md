# Synthesized design. Sentence-time claims, preflight listen

Base: candidate A. Judge: `.arena/faster-claims/JUDGE.md`. Parent agrees.

## Synthesis decision

A is the base because it is the only shape that paints a card during the turn. Criterion 2 is the product ask.

Graft from C. Replace consume-once warmup with a non-consuming preflight slot (`empty | arming | held`). Open `/ws/live` in `arm`, before or during `router.push`. Remount reattaches. Do not rebuild the pipe in a session-page `useEffect`. Client send queue: control frames before audio.

Graft from B. Skip GET on the fresh BEGIN path. Stash `sessionId` and `started_at` with the held session. Reload still GETs. Warmup/arm is a singleton on a second click. POST `/api/session` returns `started_at`.

Rejected. B as base. C as base. TurnCutter as a second sentence splitter. Transcript-never-creates-a-Claim. Page-level subscribe-ingest-settle glue. Wire `WebSocket` on lib signatures. Empty cards with no quote. Server-VAD. Ack-after-search. Frozen 8s retract (keep retract, measure the window).

## Usage

Same as A call sites, with C's `arm` / `adopt` names.

`ContextSetup.handleStart` calls `ListenPreflight.arm({ preset, contextDetail, accessToken })` in the click. Mic grant first. No POST on deny. POST returns `{ session_id, started_at }`. `arm` opens `/ws/live` without waiting for `setupComplete`. Then `router.push`.

Session page `ListenPreflight.adopt(sessionId)` then `useLiveSession`. It renders `live.ready` and `live.claims` only. No GET on that path. Reload with empty slot GETs then `LiveSession.connect`.

`VerdictFeed` / `ClaimCard` switch on `claim.phase`. Same `id` through hear → promote → verdict.

## Shape

Keep A's types: `Claim = HeardClaim | CheckingClaim | VerdictedClaim`, `reduceClaims`, `pullCompletedSentences`, `PcmPadBuffer`, `ListenReady`.

Keep A's reducer rules (hear / promote / verdict / retractUnconfirmed). Promote match stays inside `reduceClaims`. Do not export it.

Replace A's `holdListenWarmup` / `takeListenWarmup` with C's slot:

- `arm` idempotent for in-flight intent
- `adopt(sessionId)` does not consume
- orphan slot for a different id is stopped

`useLiveSession` owns fact-check fan-out, tool ack before React, sentence pull, PCM pad, Silero without `beginListening`. Failed search → `UNVERIFIED`.

`ready.status === "listening"` only when worklet and Silero are running, not at `setupComplete`.

Control-priority send on both browser `LiveSession` and `browser_to_gemini`.

## First units (TDD)

1. Failing tests for `reduceClaims` and `pullCompletedSentences` / `pullRemainderOnSpeechEnd`. Fill those bodies.
2. `ListenPreflight.arm` plus POST `started_at`, no POST on mic deny.
3. Wire session page to `live.claims`. Delete page-facing `useFactCheck` bags and `DetectedClaim` as the live card type in the same wave.
4. Backend control-before-audio drain.
5. Delete `beginListening` as a turn opener.

Silero stays the only VAD. JWT `/ws/live` and `/api/fact-check` stay.
