/** First listening preview for an anonymous Account. Keep in sync with backend/trial.py. */
export const TRIAL_DURATION_SECONDS = 60;
export const TRIAL_USED_DETAIL = "trial_used";
export const TRIAL_EXPIRED_DETAIL = "trial_expired";

export function trialRemainingSeconds(startedAt: string, nowMs: number = Date.now()): number {
  const start = Date.parse(startedAt);
  if (Number.isNaN(start)) return 0;
  const elapsed = (nowMs - start) / 1000;
  return Math.max(0, TRIAL_DURATION_SECONDS - elapsed);
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
