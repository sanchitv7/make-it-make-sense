# ListenPreflight: the live session exists before the route

Gemini stays the claim detector. The session page owns a ClaimBoard. The distinctive object is ListenPreflight. BEGIN LISTENING starts the live pipe on the click. The session route inherits that pipe instead of booting from OFFLINE.

## Usage

BEGIN LISTENING is the listen intent. The click acquires the mic, kicks Silero preload, creates the Session (trial `started_at` starts here), and opens `/ws/live` while the router is still moving. The session page does not call `getUserMedia`. It adopts the held `LiveSession`.

Refresh of `/session/:id` has no held pipe. That path cold-connects, same as today.

Transcript chunks never become Claims. The empty feed lasts until the first `report_claim`.

### Call site 1. Context setup (the gesture)

```ts
// frontend/src/components/context-setup.tsx
async function handleStart() {
  if (!selected || !accessToken) return
  setIsLoading(true)
  try {
    const { sessionId } = await ListenPreflight.arm({
      preset: selected,
      contextDetail,
      accessToken,
    })
    const params = new URLSearchParams({ preset: selected })
    if (contextDetail) params.set("context", contextDetail)
    router.push(`/session/${sessionId}?${params.toString()}`)
  } catch (err) {
    if (isTrialUsed(err)) onTrialUsed?.()
    setIsLoading(false)
  }
}
```

`arm` must run inside the click. `getUserMedia` needs that gesture. Do not POST the Session before the mic grant. A denied mic must not burn the anonymous trial.

### Call site 2. Session page (inherit, then subscribe)

```ts
// frontend/src/app/session/[id]/page.tsx
const live = useLiveSession({
  sessionId,
  preset,
  accessToken,
  onTrialExpired: () => void finishToSummary(),
})
const board = useClaimBoard()

useEffect(() => {
  return live.subscribeClaim((claim) => {
    const accepted = board.ingest(claim)
    if (accepted) void settleLater(accepted)
  })
}, [live, board])

async function settleLater(claim: Claim) {
  const result = await checkClaim(claim)
  board.settle(claim.id, result)
}

// TopBar
<TopBar
  pipe={live.status}           // warming | listening | paused | offline
  totalClaims={board.size}     // first card, not first verdict
  verdictCounts={board.verdictCounts}
/>

<VerdictFeed claims={board.newestFirst()} />
```

`useLiveSession` calls `ListenPreflight.adopt(sessionId)` first. A matching held pipe is reused. `null` means cold `LiveSession.connect`. The page never sees WS frames, `tool_response`, or Silero.

### Call site 3. LiveSession internals (ack is not fact-check)

```ts
// inside LiveSession message handler. not a public API.
const event = parseLiveMessage(raw)
if (event.type === "claim") {
  this.sendControl({
    type: "tool_response",
    functionResponses: [{
      id: event.toolCallId,
      name: "report_claim",
      response: { status: "ok" },
    }],
  })
  this.emitClaim(event.claim)
}
```

`checkClaim` is not in this function. Native-audio Live will not start the next `report_claim` until this ack is on the wire. A slow fact-check in this loop would serialize search behind Gemini's detector.

## Types

```ts
// frontend/src/types/index.ts  (replace DetectedClaim for live UI)

export type ClaimId = string & { readonly __brand: "ClaimId" }

export type Claim =
  | {
      phase: "verifying"
      id: ClaimId
      claim_text: string
      timestamp_seconds: number
      context?: string
    }
  | {
      phase: "settled"
      id: ClaimId
      claim_text: string
      timestamp_seconds: number
      context?: string
      verdict: Verdict
      verdict_summary: string
      source_name: string | null
      source_url: string | null
    }

export type PipeStatus =
  | { kind: "offline" }
  | { kind: "warming" }
  | { kind: "listening" }
  | { kind: "paused" }

export type ListenIntent = {
  preset: ContextPreset
  contextDetail: string
  accessToken: string
}
```

`verifying` is the card the user sees at `report_claim`. `settled` holds the Verdict on the same object. `isChecking` plus a detached result cannot be built.

`warming` is mic held, WS connecting, or Silero not started. `listening` is worklet plus Silero running. LIVE in the top bar maps to `listening`. OFFLINE maps to `offline`. Do not treat Gemini `setupComplete` as "the user is being heard." `setupComplete` is one step inside `warming`.

```ts
// frontend/src/lib/claim-board.ts

export type ClaimBoard = {
  byId: Map<ClaimId, Claim>
  idByText: Map<string, ClaimId>
}

export function emptyBoard(): ClaimBoard {
  return { byId: new Map(), idByText: new Map() }
}

export function ingest(board: ClaimBoard, claim: Claim): { board: ClaimBoard; accepted: Claim | null } {
  throw new Error("not implemented")
}

export function settle(
  board: ClaimBoard,
  id: ClaimId,
  result: Pick<Claim & { phase: "settled" }, "verdict" | "verdict_summary" | "source_name" | "source_url">,
): ClaimBoard {
  throw new Error("not implemented")
}

export function newestFirst(board: ClaimBoard): Claim[] {
  throw new Error("not implemented")
}

export function verdictCounts(board: ClaimBoard): Record<Verdict, number> {
  throw new Error("not implemented")
}
```

`ingest` keys the map by `id`. Duplicate `claim_text` (reconnect, repeated tool call) returns `{ accepted: null }` and keeps the first `ClaimId`. `settle` is a no-op if the id is missing or already `settled`. Map insertion order is the render order. `idByText` exists because duplicate-text lookup is a required path, not a later index.

```ts
// frontend/src/lib/listen-preflight.ts

type PreflightSlot =
  | { kind: "empty" }
  | { kind: "arming"; intent: ListenIntent; promise: Promise<LiveSession> }
  | { kind: "held"; session: LiveSession }

let slot: PreflightSlot = { kind: "empty" }

export const ListenPreflight = {
  arm(intent: ListenIntent): Promise<{ sessionId: string }> {
    throw new Error("not implemented")
  },
  adopt(sessionId: string): LiveSession | null {
    throw new Error("not implemented")
  },
  dropIfUnused(sessionId: string): void {
    throw new Error("not implemented")
  },
}
```

`arm` is idempotent for the same in-flight intent (double click, Strict Mode). It does not consume on `adopt`. Remounting the session page must reattach to the same pipe.

`arm` sequence, overlapped, not serial:

1. `getUserMedia` (gesture). On deny, leave `slot` empty and throw. No POST.
2. Start Silero module and `/vad/` asset preload. Do not `MicVAD.start` yet.
3. `POST /api/session`. `started_at` is listen intent. Trial clock starts. On 403 trial-used, stop the mic tracks and throw.
4. `LiveSession.connect({ sessionId, stream, intent })`. Opens `/ws/live` now, before or during `router.push`.
5. Resolve `{ sessionId }` as soon as POST returns. Do not wait for `setupComplete`.

```ts
// frontend/src/lib/live-session.ts

export type LiveSessionOpts = {
  sessionId: string
  preset: ContextPreset
  accessToken: string
  stream?: MediaStream
  onTrialExpired?: () => void
}

export class LiveSession {
  readonly sessionId: string
  readonly status: PipeStatus

  static connect(opts: LiveSessionOpts): LiveSession {
    throw new Error("not implemented")
  }

  subscribeClaim(fn: (claim: Claim) => void): () => void {
    throw new Error("not implemented")
  }

  subscribeStatus(fn: (status: PipeStatus) => void): () => void {
    throw new Error("not implemented")
  }

  pause(): void {
    throw new Error("not implemented")
  }
  resume(): Promise<void> {
    throw new Error("not implemented")
  }
  stop(): void {
    throw new Error("not implemented")
  }
}
```

React wrapper. External store, not a second owner of the pipe.

```ts
// frontend/src/hooks/use-live-session.ts
export function useLiveSession(opts: LiveSessionOpts): LiveSession {
  throw new Error("not implemented")
}

// frontend/src/hooks/use-claim-board.ts
export function useClaimBoard(): {
  ingest: (claim: Claim) => Claim | null
  settle: (id: ClaimId, result: Parameters<typeof settle>[2]) => void
  newestFirst: () => Claim[]
  size: number
  verdictCounts: Record<Verdict, number>
} {
  throw new Error("not implemented")
}
```

`useFactCheck` keeps the HTTP call and `shouldCheckClaim`. It drops `checkingIds` and `verdicts`. Those live on ClaimBoard.

## LiveSession internals (not public)

Parse at this boundary. Session page code never imports wire shapes.

```ts
type LiveEvent =
  | { type: "auth_ok" }
  | { type: "setup_complete" }
  | { type: "transcript"; text: string }
  | { type: "turn_complete" }
  | { type: "claim"; toolCallId: string; claim: Claim }
  | { type: "trial_expired" }
  | { type: "ignored" }

function parseLiveMessage(raw: unknown): LiveEvent {
  throw new Error("not implemented")
}
```

`transcript` updates an internal buffer only if you still want it for debugging. It does not call `ingest`. Empty VerdictFeed until the first `claim` event.

### Turns

Delete `beginListening`. Silero `start()` must not emit `speech_start` and must not set `speaking: true`.

Turns follow real Silero events only.

- `onSpeechStart` -> `activity_start` (once per closed turn)
- `onSpeechEnd` / misfire while speaking -> `activity_end`
- Do not send `activity_start` immediately after `activity_end`. An open turn during silence is how the 2.5s flush currently fires on nothing.

`maybeFlushLongSpeech` stays as a secondary cutter for a long monologue. It runs only while `speaking` is true from a real `onSpeechStart`. Primary boundary is `speech_end` (~250ms redemption). The 2.5s cap is not how listening begins.

Prompt text in `prompts.py` asks for clause-level `report_claim`. Live with auto-VAD off infers only after `activity_end`. Do not add a second detector. Do not add a TurnCutter module. Cards stagger after the turn because each `report_claim` is acked immediately and Gemini's next generation can start. Three sentences in one breath still wait for `speech_end`. That is the protocol.

`NO_INTERRUPTION` plus `TURN_INCLUDES_ALL_INPUT` stay as they are. A new turn does not abort in-flight generation. After `activity_end`, keep streaming PCM so the next turn has the audio between utterances.

### First-turn audio

Custom VAD has no server pre-speech pad. PCM sent before the first `activity_start` of the Session is dropped.

Hold ~300ms of worklet PCM in a ring (`SILERO_PRE_SPEECH_PAD_MS`). Do not send it until the first `activity_start`. Then dump the ring and stream live. After that first start, send continuously, including between turns.

### Control-priority send

`browser_to_gemini` is one serial `await` loop. A piled-up `send_realtime_input(audio)` delays `activity_end` and `tool_response`. Gemini only infers after `activity_end`. The next `report_claim` waits on the ack.

Client `LiveSession` send queue. Control frames (`activity_start`, `activity_end`, `tool_response`, `stop`) go before audio. Drop oldest audio if the queue is backed up.

Backend `browser_to_gemini`. Same rule. When both audio and control are pending, send control first. Do not split Gemini's SDK session into two writers.

```python
# backend/main.py  (browser_to_gemini)
# TODO: incoming buffer; dequeue activity_* / tool_response / stop before audio
```

## Module map

| Module | Owns | Does not own |
|---|---|---|
| `frontend/src/lib/listen-preflight.ts` | Slot across the route change. `arm` / `adopt`. Mic grant before POST. | ClaimBoard. WS frame parse. |
| `frontend/src/lib/live-session.ts` | JWT WS, worklet, Silero, first-turn pad, control-priority send, immediate `tool_response`, reconnect, `PipeStatus`. | Fact-check HTTP. Session create. |
| `frontend/src/lib/claim-board.ts` | Id-keyed Claim map, text dedupe, settle, counts. | Gemini. Fetch. |
| `frontend/src/lib/silero-vad.ts` | Real start/end events. Secondary long-speech flush. | Synthetic open-turn. |
| `frontend/src/hooks/use-live-session.ts` | React subscription to a `LiveSession`. Adopt or cold connect. | Pipe construction policy. |
| `frontend/src/hooks/use-claim-board.ts` | React state around `ClaimBoard`. | |
| `frontend/src/hooks/use-fact-check.ts` | `POST /api/fact-check` only. | UI bags. |
| `frontend/src/components/context-setup.tsx` | Gesture -> `arm` -> navigate. | `start()` on the session page. |
| `frontend/src/app/session/[id]/page.tsx` | Adopt, ClaimBoard, fan-out `checkClaim`, trial end. | Wire protocol. |
| `frontend/src/components/claim-card.tsx` | Render one `Claim`. Reuse enter + Verifying. | `isChecking` boolean. |
| `frontend/src/components/verdict-feed.tsx` | `Claim[]`. Empty copy only when `listening` and `size === 0`. | Three-bag join on `claim_text`. |
| `backend/main.py` | Control-priority in `browser_to_gemini`. Unchanged JWT `/ws/live` and `/api/fact-check`. | Fact-check inside the Live tool loop. |
| `backend/live_config.py` | Unchanged. Auto-VAD off, `NO_INTERRUPTION`, `TURN_INCLUDES_ALL_INPUT`. | |
| `backend/prompts.py` | Still the detector prompt. Not a turn protocol. | |

Delete `use-gemini-live.ts` in the same wave as the session page migration. Point the VAD source test at `live-session.ts`.

Call chain for a heard claim, three files.

1. `live-session.ts` parses, acks, emits `Claim`
2. `page.tsx` ingests and fires `checkClaim`
3. `claim-board.ts` settles. `ClaimCard` reads the union.

## Invariants

- Trial `started_at` is the POST inside `arm`, after mic grant, after the user clicked BEGIN LISTENING. Warmup that never connects (mic deny, POST 403) does not create a Session.
- `adopt` plus Strict Mode remount does not `stop()` the pipe. `stop` is pause/end/unmount-after-end only.
- `tool_response` is sent before `subscribeClaim` observers run, and those observers must not be awaited.
- Concurrent `checkClaim` calls fan out. No mutex around the board writes beyond one React `setState` updater.
- Silero is the only VAD. No timer-VAD, no server-VAD.

## Deliberately not

- Transcript sentences as Claims, or resurrecting `TranscriptPanel` as the feed.
- A TurnCutter / sentence-boundary module as the way cards appear "at clause time." The protocol does not do that. Speech_end (plus optional long-speech flush) is the turn.
- A second LLM detector.
- `beginListening` or any `speaking: true` before `onSpeechStart`.
- Waiting on fact-check to ack Live tools.
- Opening `/ws/live` before `POST /api/session` (auth needs `session_id` for the trial watchdog).
- Moving `LiveSession` into React context "above" the route. The slot is a module so the pipe exists before the session component exists.
- Server-side pre-speech pad. Compensated once, client-side, for the first `activity_start`.
