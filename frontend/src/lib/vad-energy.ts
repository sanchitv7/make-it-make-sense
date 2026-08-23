export interface EnergyVadConfig {
  /** RMS (0–1) above which speech onset is considered. */
  startThreshold: number;
  /** RMS below which speech offset is considered (hysteresis). */
  endThreshold: number;
  /** Milliseconds above startThreshold before speech_start. */
  startConfirmMs: number;
  /** Milliseconds below endThreshold before speech_end. */
  endConfirmMs: number;
  /** Force a turn flush after this much continuous speech. */
  maxSpeechMs: number;
  sampleRate: number;
}

export type VadEvent = "speech_start" | "speech_end";

export const DEFAULT_ENERGY_VAD_CONFIG: EnergyVadConfig = {
  startThreshold: 0.015,
  endThreshold: 0.009,
  startConfirmMs: 90,
  endConfirmMs: 300,
  maxSpeechMs: 8000,
  sampleRate: 16000,
};

/** Energy-based VAD with dual-threshold hysteresis for streaming PCM frames. */
export class EnergyVad {
  private speaking = false;
  private aboveStartMs = 0;
  private belowEndMs = 0;
  private speechStartMs = 0;
  private totalMs = 0;

  constructor(private readonly config: EnergyVadConfig) {}

  processFrame(rms: number, frameMs: number): VadEvent[] {
    const events: VadEvent[] = [];
    this.totalMs += frameMs;

    if (!this.speaking) {
      if (rms >= this.config.startThreshold) {
        this.aboveStartMs += frameMs;
        if (this.aboveStartMs >= this.config.startConfirmMs) {
          this.speaking = true;
          this.speechStartMs = this.totalMs;
          this.belowEndMs = 0;
          events.push("speech_start");
        }
      } else {
        this.aboveStartMs = 0;
      }
      return events;
    }

    const speechDurationMs = this.totalMs - this.speechStartMs;
    if (speechDurationMs >= this.config.maxSpeechMs) {
      events.push("speech_end", "speech_start");
      this.speechStartMs = this.totalMs;
      this.belowEndMs = 0;
      return events;
    }

    if (rms <= this.config.endThreshold) {
      this.belowEndMs += frameMs;
      if (this.belowEndMs >= this.config.endConfirmMs) {
        this.speaking = false;
        this.aboveStartMs = 0;
        this.belowEndMs = 0;
        events.push("speech_end");
      }
    } else {
      this.belowEndMs = 0;
    }

    return events;
  }

  reset(): void {
    this.speaking = false;
    this.aboveStartMs = 0;
    this.belowEndMs = 0;
    this.speechStartMs = 0;
    this.totalMs = 0;
  }

  get isSpeaking(): boolean {
    return this.speaking;
  }
}
