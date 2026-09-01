/**
 * Gate claim text for the English-first listen path.
 * Rejects STT noise tags and transcripts that are not mostly Latin script.
 */
export function isEnglishClaimText(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;
  if (/<\s*noise\s*>/i.test(trimmed)) return false;

  const letters = trimmed.replace(/[^\p{L}]/gu, "");
  if (letters.length === 0) return false;

  const latinCount = (letters.match(/\p{Script=Latin}/gu) ?? []).length;
  return latinCount / letters.length >= 0.8;
}
