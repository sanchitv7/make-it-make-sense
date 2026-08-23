/**
 * Regression: client Silero activity signaling must stay unwired until it
 * reliably sends activity_start/end. With Gemini auto-VAD disabled and no
 * client signals, claims stop being detected in production.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const hookSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "use-gemini-live.ts"),
  "utf8",
);

describe("use-gemini-live VAD wiring", () => {
  it("does not import Silero client VAD", () => {
    expect(hookSource).not.toMatch(/silero-vad/);
    expect(hookSource).not.toMatch(/createSileroVad/);
  });

  it("does not send client activity_start / activity_end", () => {
    expect(hookSource).not.toMatch(/activity_start/);
    expect(hookSource).not.toMatch(/activity_end/);
  });
});
