import { describe, expect, it } from "vitest";
import {
  interpretListenStartError,
  MIC_UNUSABLE_COPY,
  MicDeniedError,
  TrialUsedError,
} from "@/lib/listen-preflight";

describe("interpretListenStartError", () => {
  it("maps MicDeniedError to mic-unusable", () => {
    expect(interpretListenStartError(new MicDeniedError())).toEqual({
      kind: "mic-unusable",
      message: MIC_UNUSABLE_COPY,
    });
  });

  it("maps TrialUsedError to trial-used", () => {
    expect(interpretListenStartError(new TrialUsedError())).toEqual({ kind: "trial-used" });
  });

  it("maps other errors to failed", () => {
    expect(interpretListenStartError(new Error("boom"))).toEqual({ kind: "failed" });
  });
});

describe("MicDeniedError", () => {
  it("uses the unusable-microphone copy", () => {
    expect(new MicDeniedError().message).toBe(MIC_UNUSABLE_COPY);
    expect(MIC_UNUSABLE_COPY).toBe(
      "Can't use the microphone. Allow access in the browser, and check that a microphone is connected.",
    );
  });
});
