export function isEnglishClaimText(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;
  if (/<\s*noise\s*>/i.test(trimmed)) return false;

  const letters = trimmed.replace(/[^\p{L}]/gu, "");
  if (letters.length === 0) return false;

  const latinCount = (letters.match(/\p{Script=Latin}/gu) ?? []).length;
  return latinCount / letters.length >= 0.8;
}

const OPENING_QUOTE = /^[\s"'“‘«]+/;
const TERMINAL_PUNCT = /[.!?]["')\]”’»]*$/;

export function isCompleteHeardText(text: string): boolean {
  const trimmed = text.trim();
  if (!isEnglishClaimText(trimmed)) return false;
  if (!TERMINAL_PUNCT.test(trimmed)) return false;
  const body = trimmed.replace(OPENING_QUOTE, "");
  const first = body[0];
  if (!first) return false;
  return /\p{Lu}/u.test(first) && /\p{Script=Latin}/u.test(first);
}
