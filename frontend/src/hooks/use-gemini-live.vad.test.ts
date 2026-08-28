/**
 * Regression: Silero is the only VAD. Every Gemini turn must come from
 * Silero activity_start / activity_end. No timer VAD and no server-VAD fallback.
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
  it("imports Silero client VAD", () => {
    expect(hookSource).toContain('from "@/lib/silero-vad"');
    expect(hookSource).toMatch(/createSileroVad/);
  });

  it("sends activity_start / activity_end from Silero events", () => {
    expect(hookSource).toMatch(/activity_start/);
    expect(hookSource).toMatch(/activity_end/);
    expect(hookSource).toMatch(/onSileroEvent/);
  });

  it("sends session_id with the auth message for trial enforcement", () => {
    expect(hookSource).toMatch(/session_id: sessionIdRef\.current/);
    expect(hookSource).toMatch(/TRIAL_EXPIRED_DETAIL/);
  });

  it("does not start a timer or server VAD fallback", () => {
    expect(hookSource).not.toMatch(/backupFlush/);
    expect(hookSource).not.toMatch(/startBackupFlush/);
    expect(hookSource).not.toMatch(/server.?VAD/i);
  });
});
