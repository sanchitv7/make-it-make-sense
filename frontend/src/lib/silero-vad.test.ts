import { describe, expect, it } from "vitest";
import {
  applySpeechEnd,
  applySpeechStart,
  beginListening,
  DEFAULT_MAX_SPEECH_MS,
  maybeFlushLongSpeech,
  SILERO_MIN_SPEECH_MS,
  SILERO_NEGATIVE_SPEECH_THRESHOLD,
  SILERO_POSITIVE_SPEECH_THRESHOLD,
  SILERO_PRE_SPEECH_PAD_MS,
  SILERO_REDEMPTION_MS,
  type SpeechFlushState,
} from "@/lib/silero-vad";

describe("Silero tunings", () => {
  it("uses far-field thresholds and a 2.5s max-speech flush", () => {
    expect(SILERO_POSITIVE_SPEECH_THRESHOLD).toBe(0.3);
    expect(SILERO_NEGATIVE_SPEECH_THRESHOLD).toBe(0.15);
    expect(SILERO_REDEMPTION_MS).toBe(250);
    expect(SILERO_MIN_SPEECH_MS).toBe(250);
    expect(SILERO_PRE_SPEECH_PAD_MS).toBe(300);
    expect(DEFAULT_MAX_SPEECH_MS).toBe(2500);
  });
});

describe("beginListening", () => {
  it("opens a turn immediately when Silero starts", () => {
    expect(beginListening(1000)).toEqual({
      event: "speech_start",
      state: { speaking: true, speechStartedAtMs: 1000 },
    });
  });
});

describe("maybeFlushLongSpeech", () => {
  it("does nothing when not speaking", () => {
    const state: SpeechFlushState = { speaking: false, speechStartedAtMs: null };
    expect(maybeFlushLongSpeech(state, 10_000)).toEqual({ events: [], next: state });
  });

  it("does not flush before max speech duration", () => {
    const state = applySpeechStart({ speaking: false, speechStartedAtMs: null }, 1000);
    expect(maybeFlushLongSpeech(state, 1000 + 2499)).toEqual({ events: [], next: state });
  });

  it("flushes with end then start after max speech duration", () => {
    const state = applySpeechStart({ speaking: false, speechStartedAtMs: null }, 1000);
    const result = maybeFlushLongSpeech(state, 1000 + DEFAULT_MAX_SPEECH_MS);
    expect(result.events).toEqual(["speech_end", "speech_start"]);
    expect(result.next).toEqual({ speaking: true, speechStartedAtMs: 3500 });
  });
});

describe("applySpeechStart / applySpeechEnd", () => {
  it("tracks speaking state", () => {
    const started = applySpeechStart({ speaking: false, speechStartedAtMs: null }, 42);
    expect(started).toEqual({ speaking: true, speechStartedAtMs: 42 });
    expect(applySpeechEnd()).toEqual({ speaking: false, speechStartedAtMs: null });
  });
});
