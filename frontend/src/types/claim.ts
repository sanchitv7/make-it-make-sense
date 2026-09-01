import type { Verdict } from "@/types";

export type ClaimId = string & { readonly __brand: "ClaimId" };
export type TurnId = number & { readonly __brand: "TurnId" };
export type ClaimTextKey = string & { readonly __brand: "ClaimTextKey" };

export type HeardClaim = {
  phase: "heard";
  id: ClaimId;
  claim_text: string;
  textKey: ClaimTextKey;
  timestamp_seconds: number;
  turnId: TurnId;
  heardAtMs: number;
};

export type CheckingClaim = {
  phase: "checking";
  id: ClaimId;
  claim_text: string;
  textKey: ClaimTextKey;
  timestamp_seconds: number;
  context?: string;
};

export type VerdictedClaim = {
  phase: "verdicted";
  id: ClaimId;
  claim_text: string;
  textKey: ClaimTextKey;
  timestamp_seconds: number;
  context?: string;
  verdict: Verdict;
  verdict_summary: string;
  source_name: string | null;
  source_url: string | null;
};

export type Claim = HeardClaim | CheckingClaim | VerdictedClaim;

export type ListenReady =
  { status: "offline" } | { status: "connecting" } | { status: "listening" } | { status: "paused" };

export type ClaimAction =
  | {
      type: "hear";
      id: ClaimId;
      claim_text: string;
      timestamp_seconds: number;
      turnId: TurnId;
      nowMs: number;
    }
  | {
      type: "promote";
      reportText: string;
      context?: string;
      timestamp_seconds: number;
    }
  | {
      type: "verdict";
      id: ClaimId;
      verdict: Verdict;
      verdict_summary: string;
      source_name: string | null;
      source_url: string | null;
    }
  | { type: "retract"; id: ClaimId }
  | { type: "retractUnconfirmed"; turnId: TurnId; nowMs: number };

export type PromoteEffect = "fact-check" | "none";

export type ReduceResult = {
  claims: Claim[];
  effect: PromoteEffect;
  promotedId: ClaimId | null;
};
