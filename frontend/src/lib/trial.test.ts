import { describe, expect, it } from "vitest";
import {
  anonymousSessionLoadAction,
  beginPreviewAction,
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

describe("beginPreviewAction", () => {
  it("waits while Auth is still restoring, instead of minting a new Anonymous Account", () => {
    expect(
      beginPreviewAction({
        authLoading: true,
        hasAccount: false,
        isAnonymous: false,
        trialUsed: null,
      }),
    ).toEqual({ kind: "wait" });
  });

  it("mints an Anonymous Account once restore has found no user", () => {
    expect(
      beginPreviewAction({
        authLoading: false,
        hasAccount: false,
        isAnonymous: false,
        trialUsed: null,
      }),
    ).toEqual({ kind: "create-anonymous" });
  });

  it("waits while an Anonymous Account's trial_used flag is still loading", () => {
    expect(
      beginPreviewAction({
        authLoading: false,
        hasAccount: false,
        isAnonymous: true,
        trialUsed: null,
      }),
    ).toEqual({ kind: "wait" });
  });

  it("opens convert when the preview is already used", () => {
    expect(
      beginPreviewAction({
        authLoading: false,
        hasAccount: false,
        isAnonymous: true,
        trialUsed: true,
      }),
    ).toEqual({ kind: "open-trial-used" });
  });

  it("starts setup when the Anonymous Account still has a preview", () => {
    expect(
      beginPreviewAction({
        authLoading: false,
        hasAccount: false,
        isAnonymous: true,
        trialUsed: false,
      }),
    ).toEqual({ kind: "listen" });
  });

  it("starts setup for a permanent Account", () => {
    expect(
      beginPreviewAction({
        authLoading: false,
        hasAccount: true,
        isAnonymous: false,
        trialUsed: false,
      }),
    ).toEqual({ kind: "listen" });
  });
});

describe("anonymousSessionLoadAction", () => {
  it("sends an ended Session home instead of reopening The Verdict", () => {
    expect(
      anonymousSessionLoadAction({
        endedAt: "2026-08-28T12:01:00.000Z",
        remainingSeconds: 0,
      }),
    ).toEqual({ kind: "home" });
  });

  it("sends an expired open Session home instead of granting a new Verdict pass", () => {
    expect(
      anonymousSessionLoadAction({
        endedAt: null,
        remainingSeconds: 0,
      }),
    ).toEqual({ kind: "home" });
  });

  it("resumes leftover listen time on an open Session", () => {
    expect(
      anonymousSessionLoadAction({
        endedAt: null,
        remainingSeconds: 12,
      }),
    ).toEqual({ kind: "listen" });
  });
});
