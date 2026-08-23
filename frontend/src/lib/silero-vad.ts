/** Silero speech-activity events mapped to Gemini activity signals. */
export type SileroVadEvent = "speech_start" | "speech_end";

export interface SpeechFlushState {
  speaking: boolean;
  speechStartedAtMs: number | null;
}

export const DEFAULT_MAX_SPEECH_MS = 8000;

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
    positiveSpeechThreshold: 0.4,
    negativeSpeechThreshold: 0.25,
    redemptionMs: 400,
    minSpeechMs: 250,
    preSpeechPadMs: 300,
    baseAssetPath: "/vad/",
    onnxWASMBasePath: "/vad/",
    startOnLoad: false,
    getStream: async () => stream,
    pauseStream: async () => {
      /* App owns track lifecycle — do not stop shared tracks. */
    },
    resumeStream: async () => stream,
    onSpeechStart: () => {
      flushState = applySpeechStart(flushState, now());
      emit("speech_start");
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
      await micVad.start();
      startFlushTimer();
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
