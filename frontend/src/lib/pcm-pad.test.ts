import { describe, expect, it } from "vitest";
import { PcmPadBuffer } from "@/lib/pcm-pad";

describe("PcmPadBuffer", () => {
  it("returns the last N milliseconds of samples", () => {
    const pad = new PcmPadBuffer(2_000, 16_000);
    pad.push(Int16Array.from({ length: 16_000 }, (_, i) => i));
    const last = pad.takeLast(300, 16_000);
    expect(last.length).toBe(4_800);
    expect(last[0]).toBe(16_000 - 4_800);
  });

  it("caps stored audio at 2 seconds", () => {
    const pad = new PcmPadBuffer(2_000, 16_000);
    pad.push(new Int16Array(20_000).fill(1));
    pad.push(new Int16Array(20_000).fill(2));
    const all = pad.takeAll();
    expect(all.length).toBe(32_000);
    expect(all[0]).toBe(1);
    expect(all[all.length - 1]).toBe(2);
  });
});
