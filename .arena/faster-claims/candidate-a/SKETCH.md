# Claim lifecycle and listen start

A spoken sentence becomes a Claim card before Gemini `report_claim`. Begin Listening starts the mic on the click. The session page talks to a LiveSession, not to WebSocket or VAD types.

## What you import

```ts
import { beginListenWarmup, holdListenWarmup, takeListenWarmup } from "@/lib/listen-warmup";
import { useLiveSession } from "@/hooks/use-live-session";
import type { Claim } from "@/types/claim";
```

`useGeminiLive` and `useFactCheck` are not part of the page API. Wire messages, Silero events, and `toolCall` stay inside `useLiveSession`.

## Call site 1. Begin Listening click

`ContextSetup` must call `getUserMedia` in the click stack. POST `/api/session` overlaps Silero asset load, not mic permission.

```ts
async function handleStart() {
	if (!selected || !accessToken) return;
	const warmup = await beginListenWarmup();
	if (warmup.kind === "denied") {
		setIsLoading(false);
		return;
	}
	holdListenWarmup(warmup);
	try {
		const res = await apiFetch("/api/session", accessToken, {
			method: "POST",
			body: JSON.stringify({
				context_preset: selected,
				context_detail: contextDetail || null,
			}),
		});
		if (!res.ok) {
			warmup.dispose();
			throw new Error("Failed to create session");
		}
		const { session_id } = await res.json();
		router.push(`/session/${session_id}?${params}`);
	} catch (err) {
		warmup.dispose();
		setIsLoading(false);
	}
}
```

Do not POST if the mic is denied. Anonymous trial `started_at` is the insert at POST. The click is when the Account meant to listen. Silero WASM may still be loading during navigate.

## Call site 2. Session page

The page loads the Session row, then connects the already-warmed LiveSession. It does not append to `claims[]` or call `checkClaim`.

```tsx
export default function SessionPage() {
	const warmup = takeListenWarmup();
	const live = useLiveSession({
		sessionId,
		preset,
		accessToken,
		warmup,
		onTrialExpired: () => {
			void finishToSummary();
		},
	});

	useEffect(() => {
		if (!accessToken || startedRef.current) return;
		startedRef.current = true;
		void (async () => {
			const session = await loadSession(sessionId, accessToken);
			setStartedAt(session.started_at);
			if (session.ended_at) {
				router.replace(isAnonymous ? "/" : `/summary/${sessionId}`);
				return;
			}
			live.connect();
		})();
	}, [accessToken, sessionId]);

	return (
		<>
			<TopBar
				ready={live.ready}
				claims={live.claims}
				onPause={live.pause}
				onResume={live.resume}
				onStop={() => void handleStop()}
			/>
			<VerdictFeed claims={live.claims} />
		</>
	);
}
```

`live.claims` is the one list the feed and the top bar read. Counts appear when the first heard card mounts, not when the first Verdict returns.

`ready.status === "listening"` is LIVE. `"connecting"` is not OFFLINE. Empty copy follows `ready`, not a boolean `isConnected`.

## Call site 3. Feed and card

```tsx
export function VerdictFeed({ claims }: { claims: Claim[] }) {
	if (claims.length === 0) {
		return <p>Listening for factual claims…</p>;
	}
	return [...claims].reverse().map((claim) => (
		<ClaimCard key={claim.id} claim={claim} />
	));
}

export function ClaimCard({ claim }: { claim: Claim }) {
	switch (claim.phase) {
		case "heard":
			return <HeardBody claim={claim} />;
		case "checking":
			return <VerifyingBody claim={claim} />;
		case "verdicted":
			return <VerdictBody claim={claim} />;
		default: {
			const _exhaustive: never = claim;
			return _exhaustive;
		}
	}
}
```

Heard reuses the existing enter animation and quote. It does not show “Verifying…”. Checking is the existing skeleton. The same `claim.id` stays through promote so the card does not remount.

# Types

```ts
export type ClaimId = string & { readonly __brand: "ClaimId" };
export type TurnId = number & { readonly __brand: "TurnId" };
export type ClaimTextKey = string & { readonly __brand: "ClaimTextKey" };

export type Verdict = "TRUE" | "FALSE" | "MISLEADING" | "UNVERIFIED";

export type HeardClaim = {
	phase: "heard";
	id: ClaimId;
	claim_text: string;
	textKey: ClaimTextKey;
	timestamp_seconds: number;
	turnId: TurnId;
	heardAtMs: number;
};

export type CheckingClaim = {
	phase: "checking";
	id: ClaimId;
	claim_text: string;
	textKey: ClaimTextKey;
	timestamp_seconds: number;
	context?: string;
};

export type VerdictedClaim = {
	phase: "verdicted";
	id: ClaimId;
	claim_text: string;
	textKey: ClaimTextKey;
	timestamp_seconds: number;
	context?: string;
	verdict: Verdict;
	verdict_summary: string;
	source_name: string | null;
	source_url: string | null;
};

export type Claim = HeardClaim | CheckingClaim | VerdictedClaim;

export type ListenReady =
	| { status: "offline" }
	| { status: "connecting" }
	| { status: "listening" }
	| { status: "paused" };

export type ListenWarmup =
	| { kind: "denied" }
	| {
			kind: "ready";
			stream: MediaStream;
			sileroAssets: Promise<void>;
			dispose: () => void;
	  };

export type ClaimAction =
	| {
			type: "hear";
			id: ClaimId;
			claim_text: string;
			timestamp_seconds: number;
			turnId: TurnId;
			nowMs: number;
	  }
	| {
			type: "promote";
			reportText: string;
			context?: string;
			timestamp_seconds: number;
	  }
	| {
			type: "verdict";
			id: ClaimId;
			verdict: Verdict;
			verdict_summary: string;
			source_name: string | null;
			source_url: string | null;
	  }
	| { type: "retract"; id: ClaimId }
	| { type: "retractUnconfirmed"; turnId: TurnId; nowMs: number };

export type PromoteEffect = "fact-check" | "none";

export type ReduceResult = {
	claims: Claim[];
	effect: PromoteEffect;
	promotedId: ClaimId | null;
};
```

Invariants the union encodes:

- A Claim never has a Verdict in `heard` or `checking`.
- Checking has no `isChecking` flag. The phase is the flag.
- Retracted heard Claims are absent from the array. There is no `retracted` phase on the page.
- `textKey` is the dedupe identity. The UI key is `id`.

Wire types (`toolCall`, `inputTranscription`, `SileroVadEvent`) do not appear here.

# Signatures

```ts
export function newClaimId(): ClaimId {
	throw new Error("not implemented");
}

export function claimTextKey(claimText: string): ClaimTextKey {
	throw new Error("not implemented");
}

export function reduceClaims(claims: Claim[], action: ClaimAction): ReduceResult {
	throw new Error("not implemented");
}

export type TranscriptTail = {
	buffer: string;
	turnId: TurnId;
};

export type HearPull = {
	sentences: string[];
	next: TranscriptTail;
};

export function pullCompletedSentences(tail: TranscriptTail, chunk: string): HearPull {
	throw new Error("not implemented");
}

export function pullRemainderOnSpeechEnd(tail: TranscriptTail): HearPull {
	throw new Error("not implemented");
}

export async function beginListenWarmup(): Promise<ListenWarmup> {
	// Awaits getUserMedia only. Silero import stays on sileroAssets so POST can overlap it.
	throw new Error("not implemented");
}

export function holdListenWarmup(warmup: Extract<ListenWarmup, { kind: "ready" }>): void {
	throw new Error("not implemented");
}

export function takeListenWarmup(): Extract<ListenWarmup, { kind: "ready" }> | null {
	throw new Error("not implemented");
}

export class PcmPadBuffer {
	push(frame: Int16Array): void {
		throw new Error("not implemented");
	}

	takeLast(ms: number): Int16Array {
		throw new Error("not implemented");
	}

	takeAll(): Int16Array {
		throw new Error("not implemented");
	}
}

export type UseLiveSessionArgs = {
	sessionId: string;
	preset: ContextPreset;
	accessToken: string | null;
	warmup: Extract<ListenWarmup, { kind: "ready" }> | null;
	onTrialExpired?: () => void;
};

export type LiveSession = {
	ready: ListenReady;
	claims: Claim[];
	connect: () => void;
	stop: () => void;
	pause: () => void;
	resume: () => Promise<void>;
};

export function useLiveSession(args: UseLiveSessionArgs): LiveSession {
	throw new Error("not implemented");
}
```

## Reducer rules

`hear`

- Drop if `claim_text` is shorter than 12 characters after trim.
- Drop if `textKey` already exists in any phase.
- Append a `HeardClaim`. No HTTP.

`promote`

- Ack of `report_claim` is not this function. The hook sends `{status:ok}` first, then dispatches `promote`.
- Match the best unmatched `heard` by `textKey` equality, then by containment of the normalized strings.
- On match, keep `id`, move to `checking`, set `effect: "fact-check"`.
- If the key is already `checking` or `verdicted`, `effect: "none"`.
- If no heard match, insert a new `CheckingClaim` and fact-check. Gemini can extract a Claim the splitter missed.

`verdict`

- Only from `checking`. Same `id`. Errors become `UNVERIFIED`.

`retractUnconfirmed`

- Remove `heard` rows for that `turnId` whose `heardAtMs` is older than the confirmation window (8s, measured from `nowMs`).
- Do not touch `checking` or `verdicted`.

Fact-check fetches fan out per `ClaimId`. They never share a mutex. They never write to the Live socket.

## LiveSession behavior

1. `connect` adopts `warmup.stream`. Pause then resume may call `getUserMedia` again. First connect does not.
2. Await `warmup.sileroAssets` in parallel with WebSocket auth and Gemini `live.connect`. `ready` is `connecting` until `setupComplete` and VAD `start` both succeed.
3. Do not emit `activity_start` at VAD start. Delete `beginListening()` as a turn opener. First `activity_start` is a real Silero `speech_start`.
4. PCM always `push`es into `PcmPadBuffer`, capped at 2s. After `setupComplete`, if Silero is already in speech, send `activity_start` then `takeAll()`. Otherwise wait for the next `speech_start`, then `activity_start` then `takeLast(300)`. Gemini drops PCM before `activity_start`.
5. Do not send `activity_start` again immediately after `speech_end`. The next start is the next real `speech_start`. Empty 2.5s flushes during initial silence go away because `speaking` is false until speech.
6. Keep the 2.5s max-speech flush only while `speaking` is true. That still ends a long turn so `report_claim` can run. Cards do not wait on that flush.
7. On each `inputTranscription` delta, `pullCompletedSentences` and dispatch `hear`. On Silero `speech_end`, `pullRemainderOnSpeechEnd` for unpunctuated leftovers.
8. On `report_claim`, send `tool_response` `{status:ok}` before any React work. Then `promote`. Then `POST /api/fact-check` if the reducer asked. Native-audio tools are sequential. The next generation waits on that ack. Fact-check must not sit in that wait.
9. On `turnComplete`, start the confirmation window for that `turnId`. Dispatch `retractUnconfirmed` when it fires.
10. Reconnect keeps `claims`. It does not replay transcript. Strict Mode `connect` is idempotent.

## Proxy loop

`browser_to_gemini` in `backend/main.py` is one serial coroutine today. A slow `send_realtime_input` delays `activity_end` and `tool_response`.

```python
async def browser_to_gemini() -> None:
	# TODO: split incoming messages. activity_start, activity_end, and tool_response
	# await immediately. audio frames queue and send only when no control wait is in flight.
	raise NotImplementedError
```

Do not fold `POST /api/fact-check` into this loop. It stays HTTP from the browser after promote.

## Silero

`createSileroVad` `start()` loads and runs MicVAD. It does not call `beginListening`. `applySpeechStart` runs on `onSpeechStart` only. `maybeFlushLongSpeech` stays, gated on real `speaking`.

# Module map

| Module | Owns |
| --- | --- |
| `frontend/src/types/claim.ts` | `Claim` union, `ListenReady`, `ClaimAction` |
| `frontend/src/lib/claim-machine.ts` | `reduceClaims`, `claimTextKey` |
| `frontend/src/lib/hear-sentences.ts` | transcript tail, sentence and speech-end pulls |
| `frontend/src/lib/listen-warmup.ts` | click-time mic, Silero import, hold/take across navigate |
| `frontend/src/lib/pcm-pad.ts` | pre-`activity_start` PCM |
| `frontend/src/hooks/use-live-session.ts` | LiveSession. Parses Gemini and WS. Owns VAD, ack, promote, fact-check fan-out, retract timer |
| `frontend/src/lib/silero-vad.ts` | Silero only. No empty-turn opener |
| `frontend/src/components/claim-card.tsx` | switch on `claim.phase` |
| `frontend/src/components/verdict-feed.tsx` | `Claim[]` |
| `frontend/src/components/top-bar.tsx` | `ListenReady` plus `Claim[]` counts |
| `frontend/src/components/context-setup.tsx` | warmup then overlapping POST |
| `frontend/src/app/session/[id]/page.tsx` | Session row, trial clock, LiveSession |
| `backend/main.py` | control-before-audio drain in `live_ws` |

Delete as page-facing API (fold into the modules above): `useGeminiLive` return value, `useFactCheck`, the `claims` / `checkingIds` / `verdicts` bags, `DetectedClaim` as the live card type.

Leave in place: JWT `/ws/live` and `/api/fact-check`, DB insert on verdict, ADR 0003 `started_at` at session insert, `prompts.py` wording (it cannot override turn-gated inference), Silero as the only VAD.

`TranscriptPanel` stays dead. Transcript chunks become Claims through `hear`, not through a second panel.
