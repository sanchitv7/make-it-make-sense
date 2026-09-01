const SAMPLE_RATE = 16_000;
const MAX_MS = 2_000;

export class PcmPadBuffer {
  private samples = new Int16Array(0);
  private readonly maxSamples: number;

  constructor(maxMs: number = MAX_MS, sampleRate: number = SAMPLE_RATE) {
    this.maxSamples = Math.floor((sampleRate * maxMs) / 1000);
  }

  push(frame: Int16Array): void {
    const combined = new Int16Array(this.samples.length + frame.length);
    combined.set(this.samples);
    combined.set(frame, this.samples.length);
    this.samples =
      combined.length > this.maxSamples
        ? combined.slice(combined.length - this.maxSamples)
        : combined;
  }

  takeLast(ms: number, sampleRate: number = SAMPLE_RATE): Int16Array {
    const n = Math.min(this.samples.length, Math.floor((sampleRate * ms) / 1000));
    return this.samples.slice(this.samples.length - n);
  }

  takeAll(): Int16Array {
    const all = this.samples;
    this.samples = new Int16Array(0);
    return all;
  }
}
