/**
 * One-time tab pass so an Anonymous Account can open The Verdict right after
 * the trial ends. Returning visits (or pasted summary URLs) must not freeload
 * that history — convert to a permanent Account first.
 */
const TRIAL_VERDICT_ACCESS_KEY = "mims.trial_verdict_access";

type Pass = {
  sessionId: string;
};

function storage(): Storage | null {
  try {
    return globalThis.sessionStorage;
  } catch {
    return null;
  }
}

export function markTrialVerdictAccess(sessionId: string): void {
  const store = storage();
  if (!store || !sessionId) return;
  const payload: Pass = { sessionId };
  try {
    store.setItem(TRIAL_VERDICT_ACCESS_KEY, JSON.stringify(payload));
  } catch {
    // Quota / private mode
  }
}

export function hasTrialVerdictAccess(sessionId: string): boolean {
  const store = storage();
  if (!store || !sessionId) return false;
  try {
    const raw = store.getItem(TRIAL_VERDICT_ACCESS_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Pass;
    return parsed.sessionId === sessionId;
  } catch {
    return false;
  }
}

export function clearTrialVerdictAccess(): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(TRIAL_VERDICT_ACCESS_KEY);
  } catch {
    // ignore
  }
}
