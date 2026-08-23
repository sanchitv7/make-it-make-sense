import { describe, expect, it } from "vitest";
import { DEFAULT_ENERGY_VAD_CONFIG, EnergyVad } from "@/lib/vad-energy";

describe("EnergyVad", () => {
  it("emits speech_start after sustained energy above threshold", () => {
    const vad = new EnergyVad(DEFAULT_ENERGY_VAD_CONFIG);
    const events = vad.processFrame(0.05, DEFAULT_ENERGY_VAD_CONFIG.startConfirmMs);
    expect(events).toEqual(["speech_start"]);
    expect(vad.isSpeaking).toBe(true);
  });

  it("does not emit speech_start before confirmation window elapses", () => {
    const vad = new EnergyVad(DEFAULT_ENERGY_VAD_CONFIG);
    const partialMs = DEFAULT_ENERGY_VAD_CONFIG.startConfirmMs - 10;
    expect(vad.processFrame(0.05, partialMs)).toEqual([]);
    expect(vad.isSpeaking).toBe(false);
  });

  it("emits speech_end after sustained energy below end threshold", () => {
    const vad = new EnergyVad(DEFAULT_ENERGY_VAD_CONFIG);
    vad.processFrame(0.05, DEFAULT_ENERGY_VAD_CONFIG.startConfirmMs);
    expect(vad.processFrame(0.001, DEFAULT_ENERGY_VAD_CONFIG.endConfirmMs)).toEqual(["speech_end"]);
    expect(vad.isSpeaking).toBe(false);
  });

  it("uses hysteresis so mid-level energy does not flip state", () => {
    const vad = new EnergyVad(DEFAULT_ENERGY_VAD_CONFIG);
    vad.processFrame(0.05, DEFAULT_ENERGY_VAD_CONFIG.startConfirmMs);
    const mid =
      (DEFAULT_ENERGY_VAD_CONFIG.startThreshold + DEFAULT_ENERGY_VAD_CONFIG.endThreshold) / 2;
    expect(vad.processFrame(mid, 500)).toEqual([]);
    expect(vad.isSpeaking).toBe(true);
  });

  it("flushes long uninterrupted speech with end then start", () => {
    const vad = new EnergyVad({
      ...DEFAULT_ENERGY_VAD_CONFIG,
      maxSpeechMs: 1000,
    });
    vad.processFrame(0.05, DEFAULT_ENERGY_VAD_CONFIG.startConfirmMs);
    expect(vad.processFrame(0.05, 1000)).toEqual(["speech_end", "speech_start"]);
    expect(vad.isSpeaking).toBe(true);
  });

  it("reset clears speaking state", () => {
    const vad = new EnergyVad(DEFAULT_ENERGY_VAD_CONFIG);
    vad.processFrame(0.05, DEFAULT_ENERGY_VAD_CONFIG.startConfirmMs);
    vad.reset();
    expect(vad.isSpeaking).toBe(false);
  });
});
