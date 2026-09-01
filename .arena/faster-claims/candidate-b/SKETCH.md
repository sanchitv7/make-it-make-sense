# Sentence turns, Gemini-only claims

Candidate B. Gemini Live is the only Claim producer. Cards appear only on `report_claim`. Transcript text drives turn cuts, never a DetectedClaim.

## Usage

Begin Listening should feel like the mic is already on. A spoken sentence should become a Verifying card as soon as Gemini calls `report_claim` for that sentence, while `/api/fact-check` still runs. Three claim-sentences in a row should yield three staggered cards.

### 1. BEGIN click (ContextSetup)

The click is the user gesture. Start mic capture and Silero asset load in that stack. Do not call `getUserMedia` from a session-page `useEffect`.

```ts
async function handleStart() {
  const warmup = beginLiveWarmup(); // getUserMedia + vad-web import, same click
  const stream = await warmup.stream;
  const res = await apiFetch("/api/session", accessToken, {
    method: "POST",
    body: JSON.stringify({ context_preset: selected, context_detail: contextDetail || null }),
  });
  const { session_id, started_at } = (await res.json()) as CreateSessionResponse;
  stashPendingSession({ sessionId: session_id, startedAt: started_at, warmup });
  router.push(`/session/${session_id}?${params}`);
}
```

If the mic is denied, do not POST. The trial clock must not start for a listen that never had a mic.

### 2. Session page

Skip `GET /api/session` on the fresh BEGIN path. The POST body already proved ownership and returned `started_at`. Reload of `/session/:id` still GETs (ended Session, trial remaining).

```ts
const pending = takePendingSession(sessionId);
const { claims, ingestClaim, verifyingCount } = useClaims({
  sessionId,
  preset,
  speakerInfo: contextDetail,
  accessToken,
});
const { phase, start, stop, pause, resume } = useGeminiLive({
  preset,
  accessToken,
  sessionId,
  warmup: pending?.warmup ?? null,
  onClaim: ingestClaim,
  onTrialExpired: () => void finishToSummary(),
});

useEffect(() => {
  if (!accessToken || startedRef.current) return;
  startedRef.current = true;
  if (pending) {
    setStartedAt(pending.startedAt);
    start();
    return;
  }
  // reload path only
  void loadSessionThenStart();
}, [accessToken, start]);
```

Chrome reads `phase`, not a boolean. Empty feed copy is not "Listening…" while `offline`.

```ts
<TopBar phase={phase} claims={claims} ... />
<VerdictFeed phase={phase} claims={claims} />
```

`ClaimCard` takes one `Claim`. Verifying skeleton stays as it is today.

### 3. Inside the Live hook (not a caller, the other consumer)

TurnCutter owns `activity_start` / `activity_end`. Silero speech_end and transcript punctuation are inputs. The 2.5s max-speech timer is a fallback only, and it never runs during silence.

```ts
// WS onmessage, after parseLiveMessage
if (msg.kind === "setupComplete") {
  void attachPreparedAudio(ws);
  return;
}
if (msg.kind === "transcript") {
  const { commands } = reduceTurnCutter(cutterRef.current, {
    kind: "transcript",
    text: msg.text,
    atMs: now(),
  });
  cutterRef.current = commands.next;
  dispatchTurnCommands(ws, commands);
  return;
}
if (msg.kind === "toolCall") {
  // Native-audio next generation waits on tool_response. Ack first.
  sendToolAck(ws, msg.functionCallId);
  const claim = claimFromToolArgs(msg.args);
  if (claim) onClaimRef.current(claim);
}
```

Silero callback:

```ts
onEvent: (event) => {
  const { commands } = reduceTurnCutter(cutterRef.current, {
    kind: "silero",
    event,
    atMs: now(),
  });
  cutterRef.current = commands.next;
  dispatchTurnCommands(ws, commands);
};
```

`useClaims.ingestClaim` inserts `{ phase: "verifying" }` by `id` and fires `POST /api/fact-check` without awaiting it. Join the HTTP result onto that same `id`. Never `verdicts.find(v => v.claim_text === claim.claim_text)`.

## Types

```ts
type ClaimId = string & { readonly __brand: "ClaimId" };

type ClaimBase = {
  id: ClaimId;
  claim_text: string;
  timestamp_seconds: number;
  context?: string;
};

type Claim =
  | (ClaimBase & { phase: "verifying" })
  | (ClaimBase & {
      phase: "resolved";
      verdict: Verdict;
      verdict_summary: string;
      source_name: string | null;
      source_url: string | null;
    });

type LivePhase =
  | { status: "connecting" }
  | { status: "live" }
  | { status: "paused" }
  | { status: "offline" };

type LiveWarmup = {
  stream: Promise<MediaStream>;
  sileroModule: Promise<SileroModule>;
};

type PendingSession = {
  sessionId: string;
  startedAt: string;
  warmup: LiveWarmup;
};

type CreateSessionResponse = {
  session_id: string;
  started_at: string;
};

type LiveMessage =
  | { kind: "authOk" }
  | { kind: "setupComplete" }
  | { kind: "transcript"; text: string }
  | { kind: "turnComplete" }
  | { kind: "toolCall"; functionCallId: string; args: unknown }
  | { kind: "trialExpired" };

type CutterInput =
  | { kind: "silero"; event: "speech_start" | "speech_end"; atMs: number }
  | { kind: "transcript"; text: string; atMs: number }
  | { kind: "tick"; atMs: number };

type TurnCommand =
  | { type: "activity_start" }
  | { type: "activity_end" };

type CutterState = {
  turn: "open" | "closed";
  speaking: boolean;
  speechStartedAtMs: number | null;
  transcriptSinceCut: string;
};

type TurnGate = {
  open: boolean;
  // Why: custom VAD has no server pre-speech pad. PCM while closed is dropped.
  pending: Int16Array[];
};

type ConnectBits = {
  mic: MediaStream | null;
  silero: SileroVadHandle | null;
  gemini: "down" | "setup";
};
```

`DetectedClaim` is deleted. The verifying `Claim` is what Live emits. `FactCheckResult` stays the HTTP JSON shape and is parsed at `useClaims`, not passed to cards.

Illegal combinations that must not compile: `isChecking` plus a result, a result with no Claim, "Listening…" copy on `offline`.

## Signatures

### `frontend/src/lib/live-warmup.ts`

```ts
export function beginLiveWarmup(): LiveWarmup {
  throw new Error("not implemented");
  // Same click tick: getUserMedia(MIC_CONSTRAINTS) + import("@ricky0123/vad-web").
  // Second call returns the same handle (Strict Mode, double click).
}

export function stashPendingSession(pending: PendingSession): void {
  throw new Error("not implemented");
}

export function takePendingSession(sessionId: string): PendingSession | null {
  throw new Error("not implemented");
  // Match sessionId; otherwise null so a reload falls through to GET.
}
```

### `frontend/src/lib/turn-cutter.ts`

Pure. The Live hook is the only owner. Silero does not send Gemini activity by itself.

```ts
export const INITIAL_CUTTER: CutterState = {
  turn: "closed",
  speaking: false,
  speechStartedAtMs: null,
  transcriptSinceCut: "",
};

export function reduceTurnCutter(
  state: CutterState,
  input: CutterInput,
  maxOpenTurnMs: number = 2500,
): { next: CutterState; commands: TurnCommand[] } {
  throw new Error("not implemented");
  // TODO speech_start while closed -> activity_start, turn open, speaking true.
  // TODO do not open a turn from Silero start() or from a synthetic beginListening.
  // TODO speech_end -> activity_end, turn closed, speaking false (pause cut).
  // TODO transcript: append; if sentence boundary (.!? then space/end), activity_end
  //      then activity_start while still speaking (sentence cut).
  // TODO tick: maybeFlushLongSpeech only when speaking && turn open. Fallback, not primary.
  // TODO never emit activity_start unless speaking is true from Silero.
}

export function hasSentenceBoundary(buffer: string): boolean {
  throw new Error("not implemented");
}

export function dispatchTurnCommands(ws: WebSocket, commands: TurnCommand[]): void {
  throw new Error("not implemented");
  // Send in order, immediately. Do not wait for tool_response or fact-check.
}

export function pushPcm(gate: TurnGate, chunk: Int16Array): Int16Array[] {
  throw new Error("not implemented");
  // If gate.open, return [..pending, chunk] and clear pending.
  // If closed, append to pending (cap ~300ms) and return [].
}

export function openGate(gate: TurnGate): { gate: TurnGate; flush: Int16Array[] } {
  throw new Error("not implemented");
}

export function closeGate(gate: TurnGate): TurnGate {
  throw new Error("not implemented");
}
```

Worklet `onmessage` only `ws.send`s audio returned by `pushPcm`. After `activity_start`, flush pending then mark open.

### `frontend/src/lib/silero-vad.ts`

```ts
export async function createSileroVad(options: CreateSileroVadOptions): Promise<SileroVadHandle> {
  throw new Error("not implemented");
  // start() calls micVad.start() only. No beginListening, no speech_start on start.
  // Flush interval deleted. TurnCutter tick owns the fallback.
}

export function beginListening(nowMs: number): never {
  throw new Error("not implemented");
  // Delete this export and its tests. It marks speaking during silence so the
  // 2.5s flush fires empty turns.
}
```

Keep `maybeFlushLongSpeech` as a pure helper if TurnCutter wants it. Call it only after real `speech_start`.

### `frontend/src/lib/live-message.ts`

```ts
export function parseLiveMessage(raw: unknown): LiveMessage | null {
  throw new Error("not implemented");
}

export function claimFromToolArgs(args: unknown, id: ClaimId = newClaimId()): Claim | null {
  throw new Error("not implemented");
  // Validating parse at the WS boundary. phase is always "verifying".
}

export function sendToolAck(ws: WebSocket, functionCallId: string): void {
  throw new Error("not implemented");
  // { type: "tool_response", functionResponses: [{ id, name: "report_claim", response: { status: "ok" } }] }
  // Must run before ingestClaim. Must not await fetch.
}

export function newClaimId(): ClaimId {
  throw new Error("not implemented");
}
```

### `frontend/src/lib/live-phase.ts`

```ts
export function livePhase(bits: ConnectBits, flags: { stopped: boolean; paused: boolean }): LivePhase {
  throw new Error("not implemented");
  // live only when mic && silero && gemini === "setup" && !paused && !stopped.
  // connecting while any bit is still pending and !stopped.
  // paused when flags.paused && bits otherwise live.
  // offline otherwise.
}

export function emptyFeedCopy(phase: LivePhase): string {
  throw new Error("not implemented");
  switch (phase.status) {
    case "connecting":
      return "Connecting…";
    case "live":
      return "Listening for factual claims…";
    case "paused":
      return "Paused";
    case "offline":
      return "Offline";
    default: {
      const _n: never = phase;
      return _n;
    }
  }
}
```

`LIVE` in the top bar is `phase.status === "live"`. `CONNECTING` is a first-class badge. `OFFLINE` is the rest. Do not map `setupComplete` alone to LIVE.

### `frontend/src/hooks/use-gemini-live.ts`

```ts
export function useGeminiLive(options: {
  preset: ContextPreset;
  onClaim: (claim: Claim) => void;
  accessToken: string | null;
  sessionId: string;
  warmup: LiveWarmup | null;
  onTrialExpired?: () => void;
}): {
  phase: LivePhase;
  start: () => Promise<void>;
  stop: () => void;
  pause: () => void;
  resume: () => Promise<void>;
} {
  throw new Error("not implemented");
}
```

`start()` parallelizes:

1. Await `warmup.stream` (already in flight from BEGIN), or `getUserMedia` on resume.
2. Open `/ws/live`, auth, wait for `setupComplete` (Gemini connect).
3. Await `warmup.sileroModule`, `createSileroVad({ stream, onEvent })`, AudioWorklet.

Go `live` when all three are ready. Do not send PCM or activity until then. Do not export `segments`. Input transcription feeds TurnCutter only.

On `toolCall`: `sendToolAck` then `onClaim`. Fact-check is not in this hook.

Reconnect keeps the same machine. `stopped` false plus `onclose` retries `connecting`. Duplicate `report_claim` text is `useClaims`'s problem.

### `frontend/src/hooks/use-claims.ts`

Replaces `use-fact-check.ts` (delete that module in the same wave).

```ts
export function useClaims(options: {
  sessionId: string;
  preset: ContextPreset;
  speakerInfo?: string;
  accessToken: string | null;
}): {
  claims: Claim[];
  ingestClaim: (claim: Claim) => void;
  verifyingCount: number;
} {
  throw new Error("not implemented");
  // Store: Claim[] in insert order, keyed in a Map<ClaimId, index> for updates.
  // ingestClaim: if shouldCheckClaim(seen, claim_text) is false, return.
  //   else append verifying Claim, fire POST /api/fact-check (no await, no mutex).
  //   on JSON: map that ClaimId to phase "resolved" (or UNVERIFIED on catch).
  // Join by id closed over in the promise. Ignore result.claim_text for matching.
}

export function verdictCounts(claims: Claim[]): Record<Verdict, number> {
  throw new Error("not implemented");
}
```

`endSessionCleanup` waits on `verifyingCount === 0`, not a `Set`.

### UI

```ts
export function ClaimCard({ claim }: { claim: Claim }): JSX.Element {
  throw new Error("not implemented");
}

export function VerdictFeed({ phase, claims }: { phase: LivePhase; claims: Claim[] }): JSX.Element {
  throw new Error("not implemented");
}

export function TopBar({
  phase,
  claims,
  ...
}: {
  phase: LivePhase;
  claims: Claim[];
  /* pause/resume/stop/signOut/titleClick unchanged */
}): JSX.Element {
  throw new Error("not implemented");
  // Count strip when claims.length > 0, including verifying.
  // LIVE / CONNECTING / PAUSED / OFFLINE from phase.status.
}
```

### Backend

```python
class CreateSessionResponse(BaseModel):
    session_id: str
    started_at: datetime

def create_session(...) -> tuple[str, datetime]:
    raise NotImplementedError
    # Return insert row id and started_at. Do not add a second round trip.

async def browser_to_gemini():
    raise NotImplementedError
    # TODO one receive task that always reads the browser WS into an ordered queue.
    # TODO one send task that preserves client order to Gemini.
    # Why: a slow send_realtime_input(audio) in a single loop delays activity_end
    # and tool_response, which delays the next native-audio generation.
```

Do not put `/api/fact-check` on the Live tool path. JWT gates stay. `NO_INTERRUPTION` and `TURN_INCLUDES_ALL_INPUT` stay. Prompts stay clause-level intent. They do not cut turns.

## Module map

```
ContextSetup.handleStart
  -> beginLiveWarmup (mic + Silero import)
  -> POST /api/session -> { session_id, started_at }
  -> stashPendingSession
  -> navigate /session/:id

Session page
  -> takePendingSession | GET (reload only)
  -> useGeminiLive (TurnCutter, TurnGate, parseLiveMessage, LivePhase)
  -> useClaims (Claim[] by id, fan-out POST /api/fact-check)
  -> TopBar / VerdictFeed / ClaimCard (Claim, LivePhase)

useGeminiLive
  -> /ws/live (JWT) -> live.connect
  -> Silero events + transcript -> reduceTurnCutter -> activity_*
  -> toolCall -> sendToolAck -> onClaim(Claim verifying)

backend live_ws
  -> receive queue + send task (order preserved)
  -> send_tool_response only for the immediate {status:ok}
```

Call chain for a card: `toolCall` → `sendToolAck` → `ingestClaim` → `ClaimCard`. Three files. Fact-check returns later into the same row.

Call chain for a sentence cut: Silero or transcript → `reduceTurnCutter` → `activity_end` → Gemini infers → `report_claim`. Prompt text is not in that chain.

## Invariants

1. No Claim without a `report_claim` tool call. Transcript is cutter input only.
2. `tool_response` is sent before `ingestClaim`. Fact-check never blocks it. Gemini still generates one Live function-call turn at a time.
3. TurnCutter does not wait on `tool_response` before the next `activity_end`. `NO_INTERRUPTION` keeps the in-flight generation. `TURN_INCLUDES_ALL_INPUT` holds later PCM for the next turn.
4. No `activity_start` until real Silero `speech_start`. Delete `beginListening`.
5. No PCM on the WS while the turn is closed. Gate and flush ~300ms.
6. `live` chrome means mic + Silero + Gemini setup. `setupComplete` alone is `connecting` or stays `connecting` until audio is attached.
7. One `Claim` record per `ClaimId`. Verdict attaches by id.
8. Duplicate `claim_text` in one Session is a no-op ingest. Ack still happens.
9. Silero remains the only VAD. TurnCutter is turn policy, not a second detector and not server-VAD.
