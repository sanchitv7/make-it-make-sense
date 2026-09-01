# Rationale

## Problem

Begin Listening spends the anonymous trial on a serial handshake (POST, navigate, GET, then `getUserMedia` from `useEffect`, then WS, Gemini, worklet, Silero). LIVE is `setupComplete`, so the feed still says "Listening for factual claims…" while the badge is OFFLINE. Cards already mount on `report_claim`. They arrive late because Gemini with auto-VAD off only infers after `activity_end`, and today that end is Silero `speech_end` or a 2.5s flush. `beginListening` marks `speaking: true` with no speech, so the flush also fires empty turns in the opening silence. The prompt asks for clause-level `report_claim`. The protocol ignores that. Claim UI is three bags joined by `claim_text` versus `claim.id`. Native-audio function calling is sequential. The next generation waits on `tool_response`. Fact-check must not enter that wait. PCM before the first `activity_start` is dropped. A slow `send_realtime_input` in the single `browser_to_gemini` loop delays both `activity_end` and the ack.

## Usage (caller's view)

ContextSetup starts mic and Silero import on the BEGIN click, POSTs only after the mic exists, and stashes `{ sessionId, startedAt, warmup }`. The session page consumes that stash, skips GET on that path, and calls `start()`. It renders `Claim[]` and `LivePhase`. `useGeminiLive` hides TurnCutter, the PCM gate, WS parse, and the connect machine. `useClaims.ingestClaim` is the only `onClaim`. `ClaimCard` takes one `Claim`.

The Live hook is the other caller. It acks `report_claim` first, then ingests. It never builds a Claim from transcript text.

Full call sites live in `SKETCH.md`.

## Shape

**Data.** One `Claim` keyed by `ClaimId`, phase `verifying | resolved`. One `LivePhase` (`connecting | live | paused | offline`). One `CutterState` reducer. A `TurnGate` that buffers PCM while the turn is closed. Those four replace `claims` + `checkingIds` + `verdicts`, `isConnected` + `isPaused`, `beginListening` + the 2.5s primary flush, and un-gated worklet sends.

**Flow.** Silero `speech_start` opens a turn. Transcript punctuation or Silero `speech_end` closes it (sentence vs pause). A tick may close a long open turn. That is the fallback, not the primary cut. `activity_end` is what lets Gemini call `report_claim`. Immediate `{status:ok}` unblocks the next native-audio generation. `POST /api/fact-check` fans out per Claim id and writes back onto that id. `NO_INTERRUPTION` plus `TURN_INCLUDES_ALL_INPUT` mean the cutter does not wait on `tool_response` before the next cut. In-flight generation is not aborted. Later PCM belongs to the next turn.

**Connect.** `beginLiveWarmup` uses the BEGIN gesture. POST returns `started_at`. Fresh navigation does not GET. WS/Gemini, worklet, and Silero bind in parallel on the session page. `live` requires mic + Silero + Gemini setup. Connecting vs Live vs Offline is honest. Empty copy is "Connecting…", "Listening for factual claims…", "Paused", or "Offline".

**Encoded in types.** No verifying+verdict bag. No result without a Claim. No LIVE boolean that means only `setupComplete`. `DetectedClaim` and `use-fact-check` go away in the same wave.

**Validation.** `parseLiveMessage` and `claimFromToolArgs` at the hook. Session page trusts `Claim` and `LivePhase`. HTTP `FactCheckResult` does not leak into cards.

**Deliberately not done.** No transcript-sourced Claim. No second LLM detector. No server-VAD or timer-VAD. No revival of `TranscriptPanel`. Prompts stay as intent. They do not cut turns.

**Interface depth.** Session page imports `useGeminiLive`, `useClaims`, and three presentational components. It does not coordinate activity frames, tool acks, PCM gating, or id joins. Complexity sits in the cutter, the gate, the connect machine, and the Claim store. Public API stays small on purpose, per laziness-protocol and minimize-reader-load.

**Red flag screen.** TurnCutter is one module with Silero, transcript, and fallback as inputs. That is ownership of turn policy, not a load/validate/save pipeline (temporal decomposition). `sendToolAck` is not a pass-through. It is the sequential-generation policy. Wire types stay behind `parseLiveMessage` (information leakage). We do not export a connect kit of `startMic` / `startWs` / `startSilero` for the page to orchestrate (shallow module).

Principles that changed the sketch:

- **model-the-domain.** Claim phase union and `reduceTurnCutter` instead of more booleans and hook branches.
- **type-system-discipline.** Illegal chrome and check states cannot be named.
- **boundary-discipline.** Gemini/WS JSON is not a page type.
- **foundational-thinking.** Cutter state and Claim id are the structures. The hook bodies follow.
- **experience-first.** Gesture-tied mic, sentence-timed cards, honest Offline copy, client pad so the first word of a turn is not silent to Gemini.
- **subtract-before-you-add.** Delete `beginListening`, the redundant GET, exported `segments`, and the three-bag join before adding warmup.
- **separate-before-serializing-shared-state.** Fact-checks stay concurrent. Gemini's one-generation-at-a-time rule is honored by an immediate ack, not a fact-check mutex.
- **make-operations-idempotent.** Warmup singleton, `takePendingSession` match, `shouldCheckClaim` on text, ack even when ingest is a duplicate.
- **encode-lessons-in-structure.** Dropped pre-speech PCM becomes `TurnGate`, not a comment on the worklet.
- **redesign-from-first-principles.** LiveConnect is a machine that was always meant to overlap, not a patched `useEffect` after navigate.
- **migrate-callers-then-delete-legacy-apis.** `ClaimCard({ claim, result, isChecking })` does not remain beside `ClaimCard({ claim })`.

## Synthesis decision

(parent fills this)

## Tradeoffs accepted

- We accept Gemini's serial `report_claim` generations in exchange for not inventing local claims. Cards stagger as each ack+generation finishes, not as a true parallel detector.
- We accept a punctuation-and-pause cutter in exchange for no second model. Rapid unpunctuated speech still waits for `speech_end` or the fallback tick.
- We accept POST after mic grant in exchange for not burning `started_at` on a denied permission. WS does not overlap the permission dialog.
- We accept a ~300ms client PCM pad in exchange for not opening a fake turn to get a server pad (there is none).
- We accept deleting live `segments` from the hook API in exchange for one less unused transcript store. TurnCutter keeps a short buffer internally.
- We accept a split receive/send loop on `live_ws` in exchange for `activity_end` and `tool_response` not sitting behind a slow audio send. Client order is preserved. We do not reorder audio after a cut.

## Alternatives considered

- **Transcript-fabricated claims.** Page would show cards without `report_claim`. Hides Gemini latency, exposes a fake Claim to every caller, and fights the assigned shape. Lost.
- **Keep `beginListening` and 2.5s as the primary cut.** Small public API, but the page still sees batched cards and empty opening turns. The complexity it hides is the wrong policy. Lost.
- **Block the next `activity_end` until `tool_response`.** Callers would not see it, but cards would wait a full generation per sentence. `NO_INTERRUPTION` already protects the in-flight call. Lost.
- **Ack after fact-check.** Same sequential Live trap, with search in the loop. Forbidden by grounding. Lost.
- **Separate startMic / startWs / startSilero modules.** Looks parallel. The page would orchestrate bits the connect machine should own. Shallow, temporal. Lost.

## Open questions and risks

- Does `inputTranscription` actually emit `.!?` often enough that sentence cuts fire before `speech_end`?
- Should `hasSentenceBoundary` ignore abbreviations (`Dr.`, `U.S.`), or is over-cutting rarer than under-cutting?
- If Gemini puts two `report_claim` calls in one `toolCall`, do we ack both in one `tool_response` and ingest both ids?
- If BEGIN POSTs in parallel with the permission dialog, how do we abandon the Session so an anonymous Account does not consume its one trial on Deny?
- Does a 2.5s fallback still batch three fast sentences when transcription has no punctuation, and if yes, is a longer fallback better or worse?

## Next implementation step

Write failing tests for `reduceTurnCutter` (silence must not open a turn, sentence punct and `speech_end` must, fallback only while `speaking`) and delete `beginListening` so the 2.5s timer cannot fire on the opening silence.
