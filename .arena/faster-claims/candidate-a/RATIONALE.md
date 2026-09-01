# Rationale

## Problem

Begin Listening feels late because the click only POSTs a Session. Mic permission, Silero WASM, WebSocket auth, Gemini `live.connect`, AudioWorklet, and the first `activity_start` run later in a `useEffect` on the session page. The trial clock in ADR 0003 starts at that POST `started_at`, so the handshake burns listening time. Claim cards feel late for a different reason. Gemini Live with auto-VAD off infers `report_claim` only after `activity_end`. `prompts.py` asks for clause-level reports. The protocol ignores that. `inputTranscription` already streams during the turn and never creates a Claim. The page joins three bags (`claims[]`, `checkingIds`, `verdicts`) on `claim_text` versus `claim.id`, so illegal combinations compile. Native-audio function calls are sequential. The next `report_claim` waits on `tool_response`. Fact-check must stay out of that wait. `beginListening` marks `speaking` with no speech, so the 2.5s flush fires through initial silence. PCM before the first `activity_start` is dropped.

## Usage (caller's view)

`ContextSetup` calls `beginListenWarmup()` inside the Begin Listening click, holds the stream, and POSTs `/api/session` while Silero assets load. The session page takes that warmup and calls `useLiveSession`. It renders `live.claims` and `live.ready`. It never sees WebSocket messages, Silero events, or `toolCall`. `VerdictFeed` and `ClaimCard` take one `Claim` and switch on `phase`. Heard mounts the card. `report_claim` promotes the same id to checking and starts `POST /api/fact-check`. Unconfirmed heard rows leave the list.

## Shape

The load-bearing type is `Claim = HeardClaim | CheckingClaim | VerdictedClaim`. One array, one id through promote, no parallel bags. That is `model-the-domain` and `type-system-discipline`. `isChecking` plus a Verdict plus a missing row cannot compile.

Heard is a local sentence split of streaming `inputTranscription`, with a speech-end remainder when Gemini omits punctuation. That is not a second LLM. Cards mount during the turn. `report_claim` is confirmation, not first paint. Prompt text stays as-is because it cannot override turn-gated inference.

`reduceClaims` is the single writer for Claim identity, dedupe, promote, verdict, and retract. `useLiveSession` is the shell. It parses Gemini and WS at the hook boundary (`boundary-discipline`), acks `report_claim` with `{status:ok}` before React or HTTP, then dispatches `promote`. Fact-check fetches fan out per `ClaimId` (`separate-before-serializing-shared-state`). They never enter `browser_to_gemini`. Duplicate `report_claim` text, reconnect, and Strict Mode `connect` converge on the same row (`make-operations-idempotent`).

`beginListening` as a turn opener goes away (`subtract-before-you-add`). First `activity_start` is real Silero `speech_start`. A client PCM pad covers the missing server pre-speech buffer. The 2.5s flush stays only while actually speaking, so a long monologue can still end a turn. It is not how cards appear.

The public interface is `useLiveSession` (`ready`, `claims`, `connect`, `stop`, `pause`, `resume`) plus `beginListenWarmup`. That hides WS auth, VAD, pad, sentence split, tool ack, fact-check, and retract. Callers do not coordinate those steps. Wire types are not re-exported.

## Synthesis decision

(parent fills this)

## Tradeoffs accepted

- We accept some heard cards that retract, in exchange for mounting a quote at sentence time instead of after Gemini thinks.
- We accept a confirmation window after `turnComplete` (8s) in exchange for not retracting while sequential `report_claim` generations are still arriving.
- We accept POST overlapping Silero load, and we refuse POST if mic permission fails, in exchange for a clock that starts when the Account granted the mic and still overlaps the slow asset work.
- We accept a client PCM pad and a 2s connecting backlog, in exchange for not sending fake `activity_start` during silence.
- We accept leaving `prompts.py` and turn-gated `report_claim` in place, in exchange for not pretending the prompt can make native-audio infer mid-turn.
- We accept `browser_to_gemini` growing a control-before-audio drain, in exchange for acks that are not stuck behind PCM `send_realtime_input`.
- We accept folding `useGeminiLive` and `useFactCheck` into LiveSession, in exchange for one list the page can trust.

## Alternatives considered

- **Faster turn flush as the core.** Shorten 2.5s max-speech or flush on punctuation so `report_claim` arrives sooner. Callers still wait on Gemini after `activity_end`. `beginListening` silence flushes get worse. Cards still batch per turn. The public interface still leaks turn policy. Rejected. This candidate is the lifecycle machine. Flush stays only as a long-speech safety valve.
- **Second model or local classifier to decide Claim-ness.** Would hide false-positive cards, and would add a detector the constraint forbids unless the types require it. Retract on unconfirmed heard is enough. Rejected.
- **Keep `DetectedClaim` plus `isChecking` plus `verdicts[]`.** Smaller diff. The page keeps joining three bags. Illegal states stay representable. Rejected (`type-system-discipline`).
- **Optimistic empty card, wait for `report_claim` for the quote.** No transcript text on screen, so the card has nothing to say until the same gate we already have. Rejected (`experience-first`).
- **Server-VAD or a timer VAD.** Would fight `use-gemini-live.vad.test.ts` and the Silero-only rule. Rejected.
- **Serialize fact-checks so they line up with tool acks.** Hides races by putting HTTP on the sequential Live loop. That delays the next `report_claim`. Rejected.

## Open questions and risks

- How messy is Gemini `inputTranscription` punctuation in this Live model? If sentences almost never complete, do we still want remainder-on-`speech_end` as the main heard path for unpunctuated speech?
- Is 8s after `turnComplete` the right retract window when a sequential stack of `report_claim` calls is long?
- Should heard use a quieter pulse, or is a Verifying skeleton on heard acceptable even when we may retract?
- Cap the connecting PCM backlog at 2s. Is that enough for a slow `live.connect` without flooding `send_realtime_input` once `setupComplete` lands?

## Next implementation step

Write failing tests for `reduceClaims` and `pullCompletedSentences`, then fill those bodies before wiring `useLiveSession`.
