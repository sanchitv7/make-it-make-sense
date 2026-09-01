# Rationale. ListenPreflight as the product object

## Problem

Begin Listening feels slow because the click only POSTs a Session and navigates. Mic, JWT WebSocket, Gemini `live.connect()`, AudioWorklet, and Silero WASM all start in a `useEffect` on the session page. The top bar says OFFLINE, then LIVE meaning `setupComplete`, while the copy already says Listening. The anonymous trial clock (`started_at`, ADR 0003) includes that whole handshake.

Cards already insert on `report_claim`. Search is not the gate. Three bags (`claims[]`, `checkingIds`, `verdicts`) joined by `claim_text` vs `claim.id` still make the first card feel like a verdict event. Gemini Live with auto-VAD off only infers after `activity_end`. Native-audio function calling is sequential. The next `report_claim` waits on `tool_response`. `beginListening` marks `speaking: true` with no speech, so the 2.5s flush spends the first silence on an empty turn. PCM before the first `activity_start` is dropped. `prompts.py` cannot override any of that.

The non-obvious part is ownership. The live pipe has to exist before `/session/:id` mounts, without starting the trial before listen intent, and without putting fact-check on the Live tool loop.

## Usage (caller's view)

Context setup calls `ListenPreflight.arm` on the BEGIN LISTENING click, then `router.push`. The session page calls `ListenPreflight.adopt(sessionId)` and subscribes to domain `Claim` values. Fact-check is a separate `POST /api/fact-check` that settles a ClaimBoard. Callers never send `tool_response`, never call `getUserMedia` from an effect, and never join a verdict onto a claim by text. Full call sites live in `SKETCH.md`.

## Shape

Three structures.

**ListenPreflight** is a module slot (`empty` | `arming` | `held`). `arm` runs in the click. Mic grant first, then `POST /api/session` (clock starts), then `/ws/live` in parallel with navigation. `adopt` does not consume the slot, so Strict Mode remount reconnects to the same pipe. Cold load of the session URL still `LiveSession.connect`s. This is redesign-from-first-principles. If Begin Listening had always meant "start hearing," the pipe would not be a child of the session route.

**LiveSession** is the deep module. Callers see `status`, `subscribeClaim`, pause, resume, stop. Behind that, JWT auth, first-turn PCM ring, Silero, control-priority send, immediate `{status:ok}` ack, reconnect. Wire types stay in `parseLiveMessage` (boundary-discipline). `PipeStatus` is a union. `listening` means worklet plus Silero, not `setupComplete` (type-system-discipline, experience-first).

Turns follow real Silero `speech_start` / `speech_end`. `beginListening` is deleted, not gated (encode-lessons-in-structure). The 2.5s flush remains only while actually speaking, so a monologue still yields a turn. It is not how a session opens. After `activity_end`, do not synthesize `activity_start`. Empty open turns were the silence-flush bug.

**ClaimBoard** is `Map<ClaimId, Claim>` plus `idByText`. `Claim` is `verifying | settled`. The first `report_claim` is a visible card. Top bar `totalClaims` is `board.size`. Duplicate text, reconnect, and double ingest converge on the first id (make-operations-idempotent). `checkClaim` fans out. The board merges at the read boundary (separate-before-serializing-shared-state). Fact-check is not in the ack path. Gemini's sequential tool loop only waits on the immediate ack.

Interface depth. Context setup learns one function, `arm`. The session page learns `adopt` plus a board. Complexity that used to be a serial handshake across click, navigate, middleware, GET, `useEffect`, WS, Gemini, worklet, and WASM sits behind those two.

Laziness. No second detector. No TurnCutter. Transcript still does not mint Claims. `use-gemini-live` is deleted in the same wave, not wrapped. `useFactCheck` loses the UI bags.

## Synthesis decision

(parent fills this)

## Tradeoffs accepted

- We accept that three claim-sentences in one breath still wait for `speech_end` (or the secondary long-speech flush) in exchange for not pretending the prompt can cut turns. Cards then stagger because each `report_claim` is acked immediately, not because we detect mid-utterance.
- We accept a module singleton across the route instead of a React provider, in exchange for the pipe existing before the session component. Tests talk to `ListenPreflight` without a layout.
- We accept a ~300ms client PCM ring for the first `activity_start` in exchange for not inventing a server pre-speech pad Gemini does not have.
- We accept keeping the 2.5s flush as a secondary cutter during real speech in exchange for not waiting for a pause in a long monologue.
- We accept opening `/ws/live` only after POST, in exchange for a `session_id` the trial watchdog already requires. Mic and Silero preload still overlap the POST.
- We accept dropping `TranscriptPanel` from the session UI in exchange for one feed. Empty state until the first tool call is the honest UI.

## Alternatives considered

- **Optimistic transcript cards.** Mint a Claim from `inputTranscription` and upgrade it when `report_claim` arrives. Hides the turn-gate from the user by lying. Callers would juggle two sources and a match-by-text problem the board is supposed to kill. Rejected. Transcripts are not Claims.
- **TurnCutter as the headline.** End a turn at every clause so Gemini infers mid-speech. That fights `activity_end`-gated inference with a new VAD policy, and it is easy to recreate empty-turn flushes. Secondary long-speech flush is enough. Rejected as the lead idea.
- **Keep `useGeminiLive` on the session page, start mic in the click, pass the `MediaStream` through navigation.** Smaller diff. The page still boots OFFLINE, still waits on WS plus Gemini plus Silero after paint, and still needs an effect to `start()`. The handshake stays temporally decomposed across the route. Rejected because the live session would not exist before the route.
- **Ack after fact-check.** Would make sequential Live tools wait on Google Search. Rejected. The client already acks `{status:ok}` immediately. Keep that as a type-level rule, not a comment.

## Open questions and risks

- Should `prompts.py` stop asking for clause-level reports, now that we treat that line as non-operative? Honesty vs a prompt that might still bias what Gemini packs into one turn.
- How long should `arm` wait on Silero preload before navigating? Navigate on POST always, and let `warming` cover a late WASM load?
- If `adopt` finds a held pipe for a different `sessionId` (back button, abandoned arm), do we `stop` the orphan immediately or leak until `dropIfUnused`?
- Does control-priority on the backend interact badly with a large in-flight `send_realtime_input` that has already started? The SDK is still one writer.
- First-claim clip. Is 300ms of client pad enough on far-field speaker audio, or do we still lose the opening of the first sentence?

## Next implementation step

Delete `beginListening` and the post-`speech_end` synthetic `activity_start`, then implement `ListenPreflight.arm` so the click owns `getUserMedia` plus POST and holds a connecting `LiveSession` for `adopt`.
