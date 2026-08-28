import type { User } from "@supabase/supabase-js";

/** True when the signed-in Auth user is an anonymous trial Account. */
export function isAnonymousAccount(user: User | null | undefined): boolean {
  return Boolean(user?.is_anonymous);
}

/** True when the signed-in Auth user is a permanent (email) Account. */
export function isPermanentAccount(user: User | null | undefined): boolean {
  return Boolean(user) && !user?.is_anonymous;
}
