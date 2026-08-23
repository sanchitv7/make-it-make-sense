import { describe, expect, it } from "vitest";
import {
  applySpeechEnd,
  applySpeechStart,
  maybeFlushLongSpeech,
  type SpeechFlushState,
} from "@/lib/silero-vad";

describe("maybeFlushLongSpeech", () => {
  it("does nothing when not speaking", () => {
    const state: SpeechFlushState = { speaking: false, speechStartedAtMs: null };
    expect(maybeFlushLongSpeech(state, 10_000, 8000)).toEqual({ events: [], next: state });
  });

  it("does not flush before max speech duration", () => {
    const state = applySpeechStart({ speaking: false, speechStartedAtMs: null }, 1000);
    expect(maybeFlushLongSpeech(state, 5000, 8000)).toEqual({ events: [], next: state });
  });

  it("flushes with end then start after max speech duration", () => {
    const state = applySpeechStart({ speaking: false, speechStartedAtMs: null }, 1000);
    const result = maybeFlushLongSpeech(state, 1000 + 8000, 8000);
    expect(result.events).toEqual(["speech_end", "speech_start"]);
    expect(result.next).toEqual({ speaking: true, speechStartedAtMs: 9000 });
  });
});

describe("applySpeechStart / applySpeechEnd", () => {
  it("tracks speaking state", () => {
    const started = applySpeechStart({ speaking: false, speechStartedAtMs: null }, 42);
    expect(started).toEqual({ speaking: true, speechStartedAtMs: 42 });
    expect(applySpeechEnd()).toEqual({ speaking: false, speechStartedAtMs: null });
  });
});
