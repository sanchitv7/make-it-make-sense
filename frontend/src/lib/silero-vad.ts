/** Silero speech-activity events mapped to Gemini activity signals. */
export type SileroVadEvent = "speech_start" | "speech_end";

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
 * emit a forced turn flush (end then start) and reset the speech clock.
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
    events: ["speech_end", "speech_start"],
    next: { speaking: true, speechStartedAtMs: nowMs },
  };
}

export function applySpeechStart(state: SpeechFlushState, nowMs: number): SpeechFlushState {
  return { speaking: true, speechStartedAtMs: nowMs };
}

export function applySpeechEnd(): SpeechFlushState {
  return { speaking: false, speechStartedAtMs: null };
}

/** Open a turn as soon as Silero starts listening — do not wait for onSpeechStart. */
export function beginListening(nowMs: number): { event: SileroVadEvent; state: SpeechFlushState } {
  return {
    event: "speech_start",
    state: applySpeechStart({ speaking: false, speechStartedAtMs: null }, nowMs),
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
 * Emits speech_start / speech_end for Gemini activity signals.
 *
 * Dynamic import: @ricky0123/vad-web pulls ONNX/WASM and must not load at SSR.
 */
export async function createSileroVad(options: CreateSileroVadOptions): Promise<SileroVadHandle> {
  const { MicVAD } = await import("@ricky0123/vad-web");
  const maxSpeechMs = options.maxSpeechMs ?? DEFAULT_MAX_SPEECH_MS;
  const now = options.now ?? (() => Date.now());

  let flushState: SpeechFlushState = { speaking: false, speechStartedAtMs: null };
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
      const { events, next } = maybeFlushLongSpeech(flushState, now(), maxSpeechMs);
      flushState = next;
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
      const alreadySpeaking = flushState.speaking;
      flushState = applySpeechStart(flushState, now());
      if (!alreadySpeaking) {
        emit("speech_start");
      }
    },
    onSpeechEnd: () => {
      flushState = applySpeechEnd();
      emit("speech_end");
    },
    onVADMisfire: () => {
      // Short blip — if we already signaled start, close the turn.
      if (flushState.speaking) {
        flushState = applySpeechEnd();
        emit("speech_end");
      }
    },
  });

  return {
    start: async () => {
      const opened = beginListening(now());
      flushState = opened.state;
      emit(opened.event);
      startFlushTimer();
      await micVad.start();
    },
    pause: async () => {
      clearFlushTimer();
      if (flushState.speaking) {
        flushState = applySpeechEnd();
        emit("speech_end");
      }
      await micVad.pause();
    },
    destroy: async () => {
      clearFlushTimer();
      if (flushState.speaking) {
        flushState = applySpeechEnd();
        emit("speech_end");
      }
      await micVad.destroy();
    },
  };
}
