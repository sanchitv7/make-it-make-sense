/** First listening preview for an anonymous Account. Keep in sync with backend/trial.py. */
export const TRIAL_DURATION_SECONDS = 30;
export const TRIAL_USED_DETAIL = "trial_used";
export const TRIAL_EXPIRED_DETAIL = "trial_expired";

export function trialRemainingSeconds(startedAt: string, nowMs: number = Date.now()): number {
  const start = Date.parse(startedAt);
  if (Number.isNaN(start)) return 0;
  const elapsed = (nowMs - start) / 1000;
  return Math.max(0, TRIAL_DURATION_SECONDS - elapsed);
}

export function formatTrialCountdown(remaining: number): string {
  const total = Math.max(0, Math.ceil(remaining));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function isTrialUsedDetail(detail: unknown): boolean {
  return detail === TRIAL_USED_DETAIL;
}
