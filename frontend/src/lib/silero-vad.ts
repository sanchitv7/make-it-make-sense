/**
 * Silero speech-activity events.
 * speech_start / speech_end map to Gemini activity signals.
 * turn_flush cuts a long continuous turn without treating it as a real pause.
 */
export type SileroVadEvent = "speech_start" | "speech_end" | "turn_flush";

/** Events that map 1:1 to Gemini activity_start / activity_end. */
export type GeminiActivityEvent = "speech_start" | "speech_end";

export interface SpeechFlushState {
  speaking: boolean;
  speechStartedAtMs: number | null;
}

/** Force a turn during continuous speech so report_claim can fire without a pause. */
export const DEFAULT_MAX_SPEECH_MS = 2500;

export const SILERO_POSITIVE_SPEECH_THRESHOLD = 0.3;
export const SILERO_NEGATIVE_SPEECH_THRESHOLD = 0.15;
export const SILERO_REDEMPTION_MS = 250;
export const SILERO_MIN_SPEECH_MS = 250;
export const SILERO_PRE_SPEECH_PAD_MS = 300;

/**
 * Pure helper: if speech has been continuous longer than maxSpeechMs,
 * emit turn_flush and reset the speech clock. Does not emit speech_end —
 * callers must cut the Gemini turn without painting an unfinished remainder.
 */
export function maybeFlushLongSpeech(
  state: SpeechFlushState,
  nowMs: number,
  maxSpeechMs: number = DEFAULT_MAX_SPEECH_MS,
): { events: SileroVadEvent[]; next: SpeechFlushState } {
  if (!state.speaking || state.speechStartedAtMs == null) {
    return { events: [], next: state };
  }
  if (nowMs - state.speechStartedAtMs < maxSpeechMs) {
    return { events: [], next: state };
  }
  return {
    events: ["turn_flush"],
    next: { speaking: true, speechStartedAtMs: nowMs },
  };
}

export function applySpeechStart(state: SpeechFlushState, nowMs: number): SpeechFlushState {
  return { speaking: true, speechStartedAtMs: nowMs };
}

export function applySpeechEnd(): SpeechFlushState {
  return { speaking: false, speechStartedAtMs: null };
}

export function beginListening(nowMs: number): { event: SileroVadEvent; state: SpeechFlushState } {
  return {
    event: "speech_start",
    state: applySpeechStart({ speaking: false, speechStartedAtMs: null }, nowMs),
  };
}

export type VadTurnState = {
  flush: SpeechFlushState;
  confirmedSpeech: boolean;
};

export function applyVadMisfire(state: VadTurnState): {
  events: SileroVadEvent[];
  next: VadTurnState;
} {
  if (!state.confirmedSpeech || !state.flush.speaking) {
    return { events: [], next: state };
  }
  return {
    events: ["speech_end"],
    next: { flush: applySpeechEnd(), confirmedSpeech: false },
  };
}

export interface SileroVadHandle {
  start: () => Promise<void>;
  pause: () => Promise<void>;
  destroy: () => Promise<void>;
}

export interface CreateSileroVadOptions {
  stream: MediaStream;
  onEvent: (event: SileroVadEvent) => void;
  maxSpeechMs?: number;
  /** Injected for tests; defaults to Date.now. */
  now?: () => number;
}

/**
 * Start Silero MicVAD on an existing mic stream (does not open a second mic).
 * Emits speech_start / speech_end / turn_flush for Gemini activity signals.
 *
 * Dynamic import: @ricky0123/vad-web pulls ONNX/WASM and must not load at SSR.
 */
export async function createSileroVad(options: CreateSileroVadOptions): Promise<SileroVadHandle> {
  const { MicVAD } = await import("@ricky0123/vad-web");
  const maxSpeechMs = options.maxSpeechMs ?? DEFAULT_MAX_SPEECH_MS;
  const now = options.now ?? (() => Date.now());

  let turn: VadTurnState = {
    flush: { speaking: false, speechStartedAtMs: null },
    confirmedSpeech: false,
  };
  let flushTimer: ReturnType<typeof setInterval> | null = null;

  const emit = (event: SileroVadEvent) => {
    options.onEvent(event);
  };

  const clearFlushTimer = () => {
    if (flushTimer != null) {
      clearInterval(flushTimer);
      flushTimer = null;
    }
  };

  const startFlushTimer = () => {
    clearFlushTimer();
    flushTimer = setInterval(() => {
      const { events, next } = maybeFlushLongSpeech(turn.flush, now(), maxSpeechMs);
      turn = { ...turn, flush: next };
      for (const event of events) emit(event);
    }, 500);
  };

  const stream = options.stream;

  const micVad = await MicVAD.new({
    model: "v5",
    positiveSpeechThreshold: SILERO_POSITIVE_SPEECH_THRESHOLD,
    negativeSpeechThreshold: SILERO_NEGATIVE_SPEECH_THRESHOLD,
    redemptionMs: SILERO_REDEMPTION_MS,
    minSpeechMs: SILERO_MIN_SPEECH_MS,
    preSpeechPadMs: SILERO_PRE_SPEECH_PAD_MS,
    baseAssetPath: "/vad/",
    onnxWASMBasePath: "/vad/",
    startOnLoad: false,
    getStream: async () => stream,
    pauseStream: async () => {
      /* App owns track lifecycle — do not stop shared tracks. */
    },
    resumeStream: async () => stream,
    onSpeechStart: () => {
      const alreadySpeaking = turn.flush.speaking;
      turn = {
        flush: applySpeechStart(turn.flush, now()),
        confirmedSpeech: true,
      };
      if (!alreadySpeaking) {
        emit("speech_start");
      }
    },
    onSpeechEnd: () => {
      turn = { flush: applySpeechEnd(), confirmedSpeech: false };
      emit("speech_end");
    },
    onVADMisfire: () => {
      const result = applyVadMisfire(turn);
      turn = result.next;
      for (const event of result.events) emit(event);
    },
  });

  return {
    start: async () => {
      const opened = beginListening(now());
      turn = { flush: opened.state, confirmedSpeech: false };
      emit(opened.event);
      startFlushTimer();
      await micVad.start();
    },
    pause: async () => {
      clearFlushTimer();
      if (turn.flush.speaking) {
        turn = { flush: applySpeechEnd(), confirmedSpeech: false };
        emit("speech_end");
      }
      await micVad.pause();
    },
    destroy: async () => {
      clearFlushTimer();
      if (turn.flush.speaking) {
        turn = { flush: applySpeechEnd(), confirmedSpeech: false };
        emit("speech_end");
      }
      await micVad.destroy();
    },
  };
}
