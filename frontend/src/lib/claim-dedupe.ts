/**
 * Pure helpers for claim fact-check flow.
 */

/**
 * Record a claim text as seen. Returns true if this is the first time
 * the claim text has been observed (should proceed to fact-check).
 */
export function shouldCheckClaim(seen: Set<string>, claimText: string): boolean {
  if (seen.has(claimText)) {
    return false;
  }
  seen.add(claimText);
  return true;
}
