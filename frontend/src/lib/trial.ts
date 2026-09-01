/** Keep in sync with backend/trial.py. */
export const TRIAL_DURATION_SECONDS = 60;
export const TRIAL_USED_DETAIL = "trial_used";
export const TRIAL_EXPIRED_DETAIL = "trial_expired";
export const TRIAL_CUE_OPENING_SECONDS = 5;
export const TRIAL_CUE_LAST_SECONDS = 15;

export function trialRemainingSeconds(startedAt: string, nowMs: number = Date.now()): number {
  const start = Date.parse(startedAt);
  if (Number.isNaN(start)) return 0;
  const elapsed = (nowMs - start) / 1000;
  return Math.max(0, TRIAL_DURATION_SECONDS - elapsed);
}

export type TrialClock = { readonly startedAt: string };

export function trialClockForLive(input: {
  isAnonymous: boolean;
  startedAt: string | null;
}): TrialClock | undefined {
  if (!input.isAnonymous || input.startedAt === null) return undefined;
  return { startedAt: input.startedAt };
}

export type TrialPreviewCue =
  | { kind: "none" }
  | { kind: "opening-label" }
  | { kind: "last-seconds"; remainingWholeSeconds: number };

export function trialPreviewCue(startedAt: string, nowMs: number = Date.now()): TrialPreviewCue {
  const remaining = trialRemainingSeconds(startedAt, nowMs);
  if (remaining <= 0) return { kind: "none" };
  const remainingWholeSeconds = Math.ceil(remaining);
  if (remainingWholeSeconds <= TRIAL_CUE_LAST_SECONDS) {
    return { kind: "last-seconds", remainingWholeSeconds };
  }
  const elapsedSeconds = TRIAL_DURATION_SECONDS - remaining;
  if (elapsedSeconds < TRIAL_CUE_OPENING_SECONDS) return { kind: "opening-label" };
  return { kind: "none" };
}

export function trialPreviewCueCopy(cue: TrialPreviewCue): string | null {
  switch (cue.kind) {
    case "none":
      return null;
    case "opening-label":
      return "One-minute preview";
    case "last-seconds":
      return `${cue.remainingWholeSeconds}s left`;
    default: {
      const _exhaustive: never = cue;
      return _exhaustive;
    }
  }
}

export function isTrialUsedDetail(detail: unknown): boolean {
  return detail === TRIAL_USED_DETAIL;
}

export type BeginPreviewAction =
  | { kind: "listen" }
  | { kind: "open-trial-used" }
  | { kind: "wait" }
  | { kind: "create-anonymous" };

export function beginPreviewAction(input: {
  authLoading: boolean;
  hasAccount: boolean;
  isAnonymous: boolean;
  trialUsed: boolean | null;
}): BeginPreviewAction {
  if (input.hasAccount || (input.isAnonymous && input.trialUsed === false)) {
    return { kind: "listen" };
  }
  if (input.isAnonymous && input.trialUsed) {
    return { kind: "open-trial-used" };
  }
  if (input.authLoading || (input.isAnonymous && input.trialUsed === null)) {
    return { kind: "wait" };
  }
  return { kind: "create-anonymous" };
}

export type AnonymousSessionLoadAction = { kind: "home" } | { kind: "listen" };

export function anonymousSessionLoadAction(input: {
  endedAt: string | null;
  remainingSeconds: number;
}): AnonymousSessionLoadAction {
  if (input.endedAt || input.remainingSeconds <= 0) return { kind: "home" };
  return { kind: "listen" };
}
