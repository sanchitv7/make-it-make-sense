import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sessionSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "live-session.ts"),
  "utf8",
);
const sileroSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "silero-vad.ts"),
  "utf8",
);

describe("live-session VAD wiring", () => {
  it("imports Silero client VAD", () => {
    expect(sessionSource).toContain('from "@/lib/silero-vad"');
    expect(sessionSource).toMatch(/createSileroVad/);
  });

  it("sends activity_start / activity_end from Silero events", () => {
    expect(sessionSource).toMatch(/activity_start/);
    expect(sessionSource).toMatch(/activity_end/);
    expect(sessionSource).toMatch(/onSileroEvent/);
  });

  it("sends session_id with the auth message for trial enforcement", () => {
    expect(sessionSource).toMatch(/session_id: this\.sessionId/);
    expect(sessionSource).toMatch(/TRIAL_EXPIRED_DETAIL/);
  });

  it("does not start a timer or server VAD fallback", () => {
    expect(sessionSource).not.toMatch(/backupFlush/);
    expect(sessionSource).not.toMatch(/startBackupFlush/);
    expect(sessionSource).not.toMatch(/server.?VAD/i);
  });

  it("does not open a turn with beginListening", () => {
    expect(sessionSource).not.toMatch(/beginListening/);
    expect(sileroSource).not.toMatch(/beginListening/);
  });
});
