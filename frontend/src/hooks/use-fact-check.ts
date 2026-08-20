"use client";

import { useState, useCallback, useRef } from "react";
import { shouldCheckClaim } from "@/lib/claim-dedupe";
import type { DetectedClaim, FactCheckResult, ContextPreset } from "@/types";
import { apiFetch } from "@/lib/api";

interface UseFactCheckOptions {
  sessionId: string;
  preset: ContextPreset;
  speakerInfo?: string;
  accessToken: string | null;
}

interface UseFactCheckReturn {
  verdicts: FactCheckResult[];
  checkingIds: Set<string>;
  checkClaim: (claim: DetectedClaim) => void;
}

export function useFactCheck({
  sessionId,
  preset,
  speakerInfo,
  accessToken,
}: UseFactCheckOptions): UseFactCheckReturn {
  const [verdicts, setVerdicts] = useState<FactCheckResult[]>([]);
  const [checkingIds, setCheckingIds] = useState<Set<string>>(new Set());
  const checkedRef = useRef<Set<string>>(new Set());

  const checkClaim = useCallback(
    (claim: DetectedClaim) => {
      if (!shouldCheckClaim(checkedRef.current, claim.claim_text)) return;
      if (!accessToken) {
        console.error("Fact-check skipped: not signed in");
        return;
      }

      setCheckingIds((prev) => new Set(prev).add(claim.id));

      apiFetch("/api/fact-check", accessToken, {
        method: "POST",
        body: JSON.stringify({
          claim_text: claim.claim_text,
          timestamp_seconds: claim.timestamp_seconds,
          session_id: sessionId,
          preset: preset,
          speaker_info: speakerInfo ?? null,
          claim_context: claim.context ?? null,
        }),
      })
        .then((res) => {
          if (!res.ok) throw new Error("Fact-check failed");
          return res.json();
        })
        .then((result: FactCheckResult) => {
          setVerdicts((prev) => [...prev, result]);
          setCheckingIds((prev) => {
            const next = new Set(prev);
            next.delete(claim.id);
            return next;
          });
        })
        .catch((err) => {
          console.error("Fact-check error:", err);
          // Add as unverified
          setVerdicts((prev) => [
            ...prev,
            {
              claim_text: claim.claim_text,
              timestamp_seconds: claim.timestamp_seconds,
              verdict: "UNVERIFIED",
              verdict_summary: "Failed to fact-check this claim",
              source_name: null,
              source_url: null,
            },
          ]);
          setCheckingIds((prev) => {
            const next = new Set(prev);
            next.delete(claim.id);
            return next;
          });
        });
    },
    [sessionId, preset, speakerInfo, accessToken],
  );

  return { verdicts, checkingIds, checkClaim };
}
