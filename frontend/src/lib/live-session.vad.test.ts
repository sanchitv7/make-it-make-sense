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

  it("opens a Gemini turn when Silero starts instead of waiting for onSpeechStart", () => {
    expect(sileroSource).toMatch(/beginListening/);
    expect(sessionSource).toMatch(/activity_start/);
  });

  it("reopens the Gemini turn after speech_end so audio keeps flowing", () => {
    const start = sessionSource.indexOf('case "speech_end"');
    const end = sessionSource.indexOf('case "turn_flush"');
    const handler = sessionSource.slice(start, end);
    expect(handler.length).toBeGreaterThan(0);
    expect(handler).toMatch(/sendActivity\("speech_end"\)/);
    expect(handler).toMatch(/sendActivity\("speech_start"\)/);
  });

  it("cuts a forced turn_flush without painting the unfinished transcript remainder", () => {
    const start = sessionSource.indexOf('case "turn_flush"');
    const end = sessionSource.indexOf("private onTranscript");
    const handler = sessionSource.slice(start, end);
    expect(handler.length).toBeGreaterThan(0);
    expect(handler).toMatch(/cutGeminiTurn/);
    expect(sessionSource).toMatch(
      /private cutGeminiTurn[\s\S]*sendActivity\("speech_end"\)[\s\S]*sendActivity\("speech_start"\)/,
    );
    expect(handler).not.toMatch(/pullRemainderOnSpeechEnd/);
    expect(handler).not.toMatch(/hearSentences/);
  });

  it("paints heard cards from completed transcript sentences, then promotes on report_claim", () => {
    expect(sessionSource).toMatch(/hearSentences/);
    expect(sessionSource).toMatch(/type: "hear"/);
    expect(sessionSource).toMatch(/pullCompletedSentences/);
    expect(sessionSource).toMatch(/retractUnconfirmed/);
    expect(sessionSource).toMatch(/type: "promote"/);
    const transcript = sessionSource.slice(
      sessionSource.indexOf("private onTranscript"),
      sessionSource.indexOf("private onTurnComplete"),
    );
    expect(transcript).toMatch(/hearSentences/);
    expect(sessionSource).not.toMatch(/throw new Error\("Fact-check failed"\)/);
  });

  it("resumes AudioContext after the async WS handshake so the worklet can emit PCM", () => {
    expect(sessionSource).toMatch(/audioCtx\.resume\(/);
  });
});
