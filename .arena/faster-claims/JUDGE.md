# Arena verdict. Faster listen and claim cards

Base is candidate A. C almost wins on start. B does not win cards.

## Scores

| Criterion | A | B | C |
| --- | --- | --- | --- |
| 1. Start on the click | 2 | 2 | 3 |
| 2. Cards at sentence time | 3 | 1 | 1 |
| 3. Typed Claim lifecycle | 3 | 3 | 3 |
| 4. Protocol honesty | 3 | 3 | 3 |
| 5. Small public surface | 3 | 2 | 2 |
| 6. Idempotent listen | 2 | 2 | 3 |
| Total | 16 | 13 | 15 |

0 is fail. 3 fully meets.

### 1. Start on the click

All three put `getUserMedia` in the BEGIN LISTENING click and refuse POST if the mic is denied. Trial `started_at` does not start on Deny. Connecting vs listening chrome is a union, not `setupComplete` mapped to LIVE.

C is the only one that opens `/ws/live` during `router.push`. `ListenPreflight.arm` holds a connecting `LiveSession` before the session route exists. That is the overlap the handshake needs.

A and B still connect after the session page mounts. A also GETs the Session row on the fresh BEGIN path. B skips that GET, which is better, and still waits on WS plus Gemini after paint. Click-time mic is not a finished start.

### 2. Cards at sentence time

The user asked for three rapid claim-sentences to become three staggered cards while `/api/fact-check` runs. A design that still waits on Gemini `report_claim` after a whole breath scores at most 1, even if turns cut sooner.

A is the only design that paints during the turn. `inputTranscription` plus a local sentence pull creates `HeardClaim` rows. `report_claim` promotes the same `ClaimId` to `checking` and then fact-check fans out. Heard is not the Verifying skeleton. That is an honest phase, not a fake check. Cards still appear at sentence time.

B still waits on `report_claim` to mint a Claim. `TurnCutter` ends the turn at punctuation so Gemini may infer sooner. Native-audio generations stay serial. Unpunctuated speech still ends on `speech_end` or the 2.5s fallback, which is a whole breath. The rubric's cap applies. Faster turns are not sentence-time cards.

C states the same cap as a tradeoff. Three sentences in one breath wait for `speech_end`. Immediate `{status:ok}` only staggers Gemini's later generations. That is today's card path with a better ack.

### 3. Typed Claim lifecycle

All three replace `claims` plus `checkingIds` plus `verdicts` with one id-keyed discriminated `Claim`. Illegal `isChecking` plus a detached Verdict does not compile. Exhaustive card switches are in all three sketches.

A's extra `heard` phase is the one that can name a card before `report_claim`. B and C cannot add that card without breaking their "no Claim without a tool call" rule.

### 4. Protocol honesty

All three keep Silero as the only VAD, ack `{status:ok}` before React or HTTP, keep fact-check off the Live tool loop, delete `beginListening`, and pad PCM until the first real `activity_start`. No server-VAD.

`TurnCutter` in B is turn policy, not a second detector. It does not fail this criterion. It also does not rescue criterion 2.

### 5. Small public surface

A's session page talks to `useLiveSession` (`ready`, `claims`, `connect`, `stop`, `pause`, `resume`) plus a warmup take. WS, VAD, tool acks, sentence pull, and fact-check fan-out stay inside that hook. That is a deep module.

B's page wires `useGeminiLive` to `useClaims.ingestClaim` and branches pending vs GET vs `start()`. Two stores, one callback glue.

C's page subscribes, `ingest`s, `checkClaim`s, and `settle`s. The caller coordinates several methods to complete one Claim operation. `ListenPreflight.arm` is deep for start. The session page is a kit for the claim path.

### 6. Idempotent listen

C's `arm` is idempotent for an in-flight intent. `adopt` does not consume the slot, so a Strict Mode remount reattaches the same pipe. That is the remount story A and B lack.

A claims Strict Mode `connect` is idempotent, then `takeListenWarmup` likely consumes the stream. A second mount with a null warmup can call `getUserMedia` again. Duplicate `textKey` and failed search to `UNVERIFIED` are specified.

B's warmup handle is a singleton on a second call, which A should copy. `takePendingSession` still looks consume-once. Duplicate text is a no-op ingest with ack still sent.

C does not say a failed search becomes `UNVERIFIED`. A verifying row could sit forever. Graft A's error rule onto C's slot if you take the slot.

## Recommended base

Candidate A.

Criterion 2 is the product ask. A is the only sketch that meets it. Heard cards from the transcript are a local split, not a second LLM, which matches the laziness constraint in GROUNDING.md.

The session page inherits one list and one ready union. A maintainer extends Claim by adding a phase on that union, not by joining another bag. When start quality is close, that smaller page API is the one you can change without breaking handshake invariants.

C would be the base if this arena were only Begin Listening. It is not. C's own rationale admits three sentences in one breath still wait for `speech_end`. That fails the card criterion on purpose.

B's Claim union is clean and its cutter is real. Gemini-only paint still makes the card wait on tool-call generation. Do not pick that as the lifecycle.

Principles that decided the base:

- Experience First. Sentence-time cards over C's better handshake.
- Model the Domain. Keep `heard | checking | verdicted`. B and C cannot name a pre-tool-call card.
- Type System Discipline. One id through promote. Retract is absence, not a fourth UI phase.
- Minimize Reader Load. One hook on the page beats C's subscribe-ingest-fetch-settle glue.
- Laziness Protocol. Local sentence pull, not a second model, and not TurnCutter stacked on that pull.

## Grafts

From B, into A.

1. Skip GET on the fresh BEGIN path. Stash `sessionId` and `started_at` with the warmup, as `stashPendingSession` / `takePendingSession` do. Reload still GETs. A's session page should not wait on a second Session fetch after it just created the row.
2. Warmup singleton. `beginLiveWarmup` returns the same handle on a second call (double click, Strict Mode on ContextSetup). A's `beginListenWarmup` does not say this.

From C, into A.

1. Non-consuming adopt plus WS during navigate. Replace consume-once `takeListenWarmup` with C's `empty | arming | held` slot. Open `/ws/live` in `arm`, before or during `router.push`. Remount reattaches. Do not rebuild the pipe in a session-page `useEffect`.
2. Client control-priority send. A already drains control before audio in `browser_to_gemini`. Also queue on the client, as C does, so `activity_end` and `tool_response` are not stuck behind worklet PCM on the browser side. Drop oldest audio if the queue backs up.

Fold those in as if start had always been a held pipe. Do not bolt C's slot onto A's post-GET `live.connect()`.

## Rejections

- B as base. Cards still wait on `report_claim`. TurnCutter is a faster turn, not a card at sentence time.
- C as base. Same card miss, plus the session page orchestrates ClaimBoard and HTTP.
- B's `TurnCutter` as the Claim producer, and as a second sentence splitter on top of A's `pullCompletedSentences`. One pull owns sentence boundaries. Gemini still confirms via `promote`. A later punctuation `activity_end` can be a follow-up if heard cards sit in `heard` too long. It is not this graft.
- C's invariant that transcript chunks never create a Claim. That invariant is why C scores 1 on cards.
- C keeping `useFactCheck` as a third HTTP module while the page calls `settle`. Fact-check fan-out belongs with the Claim writer, which in the base is the live hook.
- B exporting `sendToolAck(ws: WebSocket)`, `dispatchTurnCommands(ws)`, and `LiveMessage` from `lib/`. Parse and ack stay inside the live module.
- Optimistic empty cards with no quote. A's rationale already rejected this. A card with no `claim_text` waits on the same Gemini gate.
- Server-VAD, timer-VAD, a second LLM detector, and ack-after-fact-check. All three candidates rejected these. Keep that consensus.
- A's 8s retract window as a frozen number. Keep retract of unconfirmed `heard` rows. Measure the window against sequential `report_claim` stacks before coding 8.

## Red flags

No candidate is organized as load / validate / save folders. Temporal decomposition is clean on all three.

**A, information leakage (warn, not reject).** `promote` matches `heard` to `report_claim` by `textKey` then by containment. Transcript pull and Gemini tool args share a sameness policy. That policy lives in `reduceClaims` today. If matching leaks into the page or the card, you are back to joining on `claim_text`. Keep the match inside the reducer. Do not export it.

**B, information leakage.** `sendToolAck` and `dispatchTurnCommands` take a `WebSocket`. Wire types on a lib signature. The hook should own the socket. `parseLiveMessage` as a public `lib/live-message.ts` export invites the page to depend on Gemini JSON.

**C, shallow module.** The session page coordinates `subscribeClaim`, `board.ingest`, `checkClaim`, and `board.settle` to complete one Claim. Callers learn the pipeline. A's hook hides that pipeline. Prefer that.

**C, pass-through.** `useLiveSession` is documented as not a second owner of the pipe. `useClaimBoard` wraps `ClaimBoard` with the same methods. Keep one React adapter if it is the subscription. Do not keep two wrappers plus page glue.

**B, near miss on shallow.** The page does not orchestrate VAD or acks. It does orchestrate two hooks. That is why B scores 2 on criterion 5, not 3.

## Convergence

All three delete `beginListening`, ack Live tools immediately, keep fact-check on HTTP, keep Silero as the only VAD, pad PCM before the first `activity_start`, and replace the three UI bags with a phased `Claim`. Start-on-click plus no POST on Deny is also unanimous.

The fight is when a Claim is born, and whether the live pipe exists before `/session/:id`. Take A's birth rule. Take C's pipe slot. Leave B's cutter on the shelf unless heard cards stall on unpunctuated speech.
