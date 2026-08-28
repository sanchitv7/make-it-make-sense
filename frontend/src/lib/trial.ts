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
