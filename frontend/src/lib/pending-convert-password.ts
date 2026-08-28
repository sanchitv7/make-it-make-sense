/** Short-lived stash while an Anonymous Account confirms email (same browser, any tab).
 *  localStorage (not sessionStorage) so the confirmation link's new tab can finish conversion.
 */
const PENDING_CONVERT_PASSWORD_KEY = "mims.pending_convert_password";
export const PENDING_CONVERT_PASSWORD_MAX_AGE_MS = 60 * 60 * 1000;

type Stash = {
  password: string;
  storedAt: number;
};

function storage(): Storage | null {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export function stashPendingConvertPassword(password: string): void {
  const store = storage();
  if (!store) return;
  const payload: Stash = { password, storedAt: Date.now() };
  try {
    store.setItem(PENDING_CONVERT_PASSWORD_KEY, JSON.stringify(payload));
  } catch {
    // Quota / private mode
  }
}

export function takePendingConvertPassword(now = Date.now()): string | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(PENDING_CONVERT_PASSWORD_KEY);
    if (!raw) return null;
    store.removeItem(PENDING_CONVERT_PASSWORD_KEY);
    const parsed = JSON.parse(raw) as Stash;
    if (typeof parsed.password !== "string" || typeof parsed.storedAt !== "number") {
      return null;
    }
    if (now - parsed.storedAt > PENDING_CONVERT_PASSWORD_MAX_AGE_MS) {
      return null;
    }
    return parsed.password;
  } catch {
    return null;
  }
}

export function clearPendingConvertPassword(): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(PENDING_CONVERT_PASSWORD_KEY);
  } catch {
    // ignore
  }
}
