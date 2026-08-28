export type ContextPreset = "political" | "news" | "general" | "podcast";

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
  context?: string;
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
  title: string | null;
  blurb: string | null;
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
  title: string | null;
  blurb: string | null;
  started_at: string;
  ended_at: string | null;
  claims: ClaimRow[];
}

export interface VerdictCounts {
  TRUE: number;
  FALSE: number;
  MISLEADING: number;
  UNVERIFIED: number;
}

export interface SessionCard {
  id: string;
  title: string | null;
  blurb: string | null;
  context_preset: string;
  context_detail: string | null;
  started_at: string;
  ended_at: string | null;
  claim_count: number;
  verdict_counts: VerdictCounts;
}

export interface SessionListResponse {
  sessions: SessionCard[];
}

export interface AccountStatus {
  is_anonymous: boolean;
  trial_used: boolean;
  trial_duration_seconds: number;
}
