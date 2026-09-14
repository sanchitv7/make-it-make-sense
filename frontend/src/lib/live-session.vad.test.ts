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
    expect(sessionSource).toMatch(/await vad\.start\(\)/);
    expect(sessionSource).toMatch(/sendActivity\("speech_start"\)/);
    expect(sileroSource).not.toMatch(/beginListening/);
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

  it("cuts Gemini on completed transcript sentences without painting heard cards", () => {
    expect(sessionSource).toMatch(/pullCompletedSentences/);
    expect(sessionSource).toMatch(/type: "promote"/);
    expect(sessionSource).not.toMatch(/hearSentences/);
    expect(sessionSource).not.toMatch(/type: "hear"/);
    expect(sessionSource).not.toMatch(/retractUnconfirmed/);
    expect(sessionSource).not.toMatch(/lastEndedTurnId/);
    const transcript = sessionSource.slice(
      sessionSource.indexOf("private onTranscript"),
      sessionSource.indexOf("private onReportClaim"),
    );
    expect(transcript).toMatch(/pullCompletedSentences/);
    expect(transcript).toMatch(/cutGeminiTurn/);
    expect(transcript).not.toMatch(/hearSentences/);
    expect(transcript).not.toMatch(/type: "hear"/);
    expect(transcript).not.toMatch(/retractUnconfirmed/);
    expect(sessionSource).not.toMatch(/throw new Error\("Fact-check failed"\)/);
    const sileroHandler = sessionSource.slice(
      sessionSource.indexOf("private onSileroEvent"),
      sessionSource.indexOf("private onTranscript"),
    );
    expect(sileroHandler).not.toMatch(/hearSentences/);
    expect(sileroHandler).not.toMatch(/pullRemainderOnSpeechEnd/);
    expect(sileroHandler).not.toMatch(/type: "hear"/);
  });

  it("resumes AudioContext after the async WS handshake so the worklet can emit PCM", () => {
    expect(sessionSource).toMatch(/audioCtx\.resume\(/);
  });

  it("warms Silero before setup_complete so Connecting is not Gemini then ONNX in series", () => {
    expect(sessionSource).toMatch(/warmSilero/);
    const connectStart = sessionSource.indexOf("private async doConnect");
    const connectEnd = sessionSource.indexOf("private handleEvent");
    const connectBody = sessionSource.slice(connectStart, connectEnd);
    expect(connectBody).toMatch(/warmSilero/);
    expect(sessionSource.indexOf("warmSilero")).toBeLessThan(
      sessionSource.indexOf('case "setup_complete"'),
    );
  });

  it("resumes AudioContext after setup_complete so the worklet is not left suspended", () => {
    expect(sessionSource).toMatch(/audioCtx\.resume\(\)/);
  });
});
