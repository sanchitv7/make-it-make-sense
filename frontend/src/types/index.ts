export type ContextPreset = "political" | "news" | "earnings" | "podcast";

export type Verdict = "TRUE" | "FALSE" | "MISLEADING" | "UNVERIFIED";

export interface ContextPresetOption {
  key: ContextPreset;
  emoji: string;
  title: string;
  description: string;
}

export interface DetectedClaim {
  id: string;
  claim_text: string;
  timestamp_seconds: number;
}

export interface FactCheckResult {
  claim_text: string;
  timestamp_seconds: number;
  verdict: Verdict;
  verdict_summary: string;
  source_name: string | null;
  source_url: string | null;
}

export interface SessionRow {
  id: string;
  context_preset: string;
  context_detail: string | null;
  started_at: string;
  ended_at: string | null;
}

export interface ClaimRow {
  id: string;
  session_id: string;
  claim_text: string;
  timestamp_seconds: number;
  verdict: Verdict;
  verdict_summary: string | null;
  source_name: string | null;
  source_url: string | null;
  created_at: string;
}

export interface SessionDetailResponse {
  id: string;
  context_preset: string;
  context_detail: string | null;
  started_at: string;
  ended_at: string | null;
  claims: ClaimRow[];
}
