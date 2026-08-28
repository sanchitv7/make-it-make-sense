import { describe, expect, it } from "vitest";
import {
  isTrialUsedDetail,
  trialRemainingSeconds,
  TRIAL_DURATION_SECONDS,
  TRIAL_USED_DETAIL,
} from "@/lib/trial";

describe("trialRemainingSeconds", () => {
  it("returns the full duration at start", () => {
    const start = "2026-08-28T12:00:00.000Z";
    const now = Date.parse(start);
    expect(trialRemainingSeconds(start, now)).toBe(TRIAL_DURATION_SECONDS);
  });

  it("decreases with wall-clock time", () => {
    const start = "2026-08-28T12:00:00.000Z";
    const now = Date.parse(start) + 12_500;
    expect(trialRemainingSeconds(start, now)).toBe(TRIAL_DURATION_SECONDS - 12.5);
  });

  it("clamps at zero after the trial ends", () => {
    const start = "2026-08-28T12:00:00.000Z";
    const now = Date.parse(start) + (TRIAL_DURATION_SECONDS + 5) * 1000;
    expect(trialRemainingSeconds(start, now)).toBe(0);
  });
});

describe("isTrialUsedDetail", () => {
  it("matches the backend trial_used detail", () => {
    expect(isTrialUsedDetail(TRIAL_USED_DETAIL)).toBe(true);
    expect(isTrialUsedDetail("nope")).toBe(false);
  });
});
