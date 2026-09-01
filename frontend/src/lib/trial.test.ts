import { describe, expect, it } from "vitest";
import {
  anonymousSessionLoadAction,
  beginPreviewAction,
  isTrialUsedDetail,
  trialClockForLive,
  trialPreviewCue,
  trialPreviewCueCopy,
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

describe("trialClockForLive", () => {
  const startedAt = "2026-08-28T12:00:00.000Z";

  it("is none for a permanent Account", () => {
    expect(trialClockForLive({ isAnonymous: false, startedAt })).toBeUndefined();
  });

  it("is none when startedAt is missing", () => {
    expect(trialClockForLive({ isAnonymous: true, startedAt: null })).toBeUndefined();
  });
});

describe("trialPreviewCue", () => {
  const startedAt = "2026-08-28T12:00:00.000Z";
  const startMs = Date.parse(startedAt);

  it("shows the opening label in the first five seconds", () => {
    expect(trialPreviewCue(startedAt, startMs + 4_999)).toEqual({ kind: "opening-label" });
  });

  it("is none in the middle of the preview", () => {
    expect(trialPreviewCue(startedAt, startMs + 20_000)).toEqual({ kind: "none" });
  });

  it("ceils remaining whole seconds in the last 15s", () => {
    expect(trialPreviewCue(startedAt, startMs + (TRIAL_DURATION_SECONDS - 14.2) * 1000)).toEqual({
      kind: "last-seconds",
      remainingWholeSeconds: 15,
    });
  });

  it("is none when remaining is 0", () => {
    expect(trialPreviewCue(startedAt, startMs + TRIAL_DURATION_SECONDS * 1000)).toEqual({
      kind: "none",
    });
  });
});

describe("trialPreviewCueCopy", () => {
  it("returns null for none", () => {
    expect(trialPreviewCueCopy({ kind: "none" })).toBeNull();
  });

  it("labels the opening of the one-minute preview", () => {
    expect(trialPreviewCueCopy({ kind: "opening-label" })).toBe("One-minute preview");
  });

  it("shows remaining whole seconds", () => {
    expect(trialPreviewCueCopy({ kind: "last-seconds", remainingWholeSeconds: 7 })).toBe("7s left");
  });
});
