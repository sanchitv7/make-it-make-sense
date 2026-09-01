import { v4 as uuidv4 } from "uuid";
import type {
  CheckingClaim,
  Claim,
  ClaimAction,
  ClaimId,
  ClaimTextKey,
  HeardClaim,
  ReduceResult,
} from "@/types/claim";
import { isEnglishClaimText } from "@/lib/claim-language";

export const UNCONFIRMED_HEARD_MS = 8_000;

const MIN_HEARD_CHARS = 12;

export function newClaimId(): ClaimId {
  return uuidv4() as ClaimId;
}

export function claimTextKey(claimText: string): ClaimTextKey {
  return claimText.trim().toLowerCase().replace(/\s+/g, " ") as ClaimTextKey;
}

function none(claims: Claim[]): ReduceResult {
  return { claims, effect: "none", promotedId: null };
}

function hasTextKey(claims: Claim[], key: ClaimTextKey): boolean {
  return claims.some((claim) => claim.textKey === key);
}

function findHeardMatch(claims: Claim[], reportKey: ClaimTextKey): HeardClaim | undefined {
  const heardClaims = claims.filter((claim): claim is HeardClaim => claim.phase === "heard");
  const exact = heardClaims.find((claim) => claim.textKey === reportKey);
  if (exact) return exact;
  if (reportKey.length === 0) return undefined;

  let best: HeardClaim | undefined;
  for (const claim of heardClaims) {
    if (!claim.textKey.includes(reportKey) && !reportKey.includes(claim.textKey)) continue;
    if (!best || claim.textKey.length > best.textKey.length) best = claim;
  }
  return best;
}

function toChecking(
  base: {
    id: ClaimId;
    timestamp_seconds: number;
    context?: string;
  },
  reportText: string,
  textKey: ClaimTextKey,
): CheckingClaim {
  return {
    phase: "checking",
    id: base.id,
    claim_text: reportText,
    textKey,
    timestamp_seconds: base.timestamp_seconds,
    context: base.context,
  };
}

export function reduceClaims(claims: Claim[], action: ClaimAction): ReduceResult {
  switch (action.type) {
    case "hear": {
      const trimmed = action.claim_text.trim();
      if (trimmed.length < MIN_HEARD_CHARS) return none(claims);
      if (!isEnglishClaimText(trimmed)) return none(claims);
      const textKey = claimTextKey(trimmed);
      if (hasTextKey(claims, textKey)) return none(claims);
      const next: HeardClaim = {
        phase: "heard",
        id: action.id,
        claim_text: trimmed,
        textKey,
        timestamp_seconds: action.timestamp_seconds,
        turnId: action.turnId,
        heardAtMs: action.nowMs,
      };
      return { claims: [...claims, next], effect: "none", promotedId: null };
    }
    case "promote": {
      if (!isEnglishClaimText(action.reportText)) return none(claims);
      const textKey = claimTextKey(action.reportText);
      const heard = findHeardMatch(claims, textKey);
      if (heard) {
        const checking = toChecking(
          {
            id: heard.id,
            timestamp_seconds: heard.timestamp_seconds,
            context: action.context,
          },
          action.reportText,
          textKey,
        );
        return {
          claims: claims.map((claim) => (claim.id === heard.id ? checking : claim)),
          effect: "fact-check",
          promotedId: heard.id,
        };
      }
      const already = claims.find((claim) => claim.phase !== "heard" && claim.textKey === textKey);
      if (already) return none(claims);
      const id = newClaimId();
      const checking = toChecking(
        {
          id,
          timestamp_seconds: action.timestamp_seconds,
          context: action.context,
        },
        action.reportText,
        textKey,
      );
      return { claims: [...claims, checking], effect: "fact-check", promotedId: id };
    }
    case "verdict": {
      const current = claims.find((claim) => claim.id === action.id);
      if (!current || current.phase !== "checking") return none(claims);
      const verdicted: Claim = {
        phase: "verdicted",
        id: current.id,
        claim_text: current.claim_text,
        textKey: current.textKey,
        timestamp_seconds: current.timestamp_seconds,
        context: current.context,
        verdict: action.verdict,
        verdict_summary: action.verdict_summary,
        source_name: action.source_name,
        source_url: action.source_url,
      };
      return {
        claims: claims.map((claim) => (claim.id === action.id ? verdicted : claim)),
        effect: "none",
        promotedId: null,
      };
    }
    case "retract":
      return none(claims.filter((claim) => claim.id !== action.id));
    case "retractUnconfirmed":
      return none(
        claims.filter((claim) => {
          if (claim.phase !== "heard") return true;
          if (claim.turnId !== action.turnId) return true;
          return action.nowMs - claim.heardAtMs < UNCONFIRMED_HEARD_MS;
        }),
      );
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}
