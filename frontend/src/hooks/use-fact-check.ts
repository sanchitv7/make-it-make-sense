"use client";

import { useState, useCallback, useRef } from "react";
import type { DetectedClaim, FactCheckResult, ContextPreset } from "@/types";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface UseFactCheckOptions {
  sessionId: string;
  preset: ContextPreset;
  speakerInfo?: string;
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
}: UseFactCheckOptions): UseFactCheckReturn {
  const [verdicts, setVerdicts] = useState<FactCheckResult[]>([]);
  const [checkingIds, setCheckingIds] = useState<Set<string>>(new Set());
  const checkedRef = useRef<Set<string>>(new Set());

  const checkClaim = useCallback(
    (claim: DetectedClaim) => {
      // Deduplicate
      if (checkedRef.current.has(claim.claim_text)) return;
      checkedRef.current.add(claim.claim_text);

      setCheckingIds((prev) => new Set(prev).add(claim.id));

      fetch(`${BACKEND_URL}/api/fact-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claim_text: claim.claim_text,
          timestamp_seconds: claim.timestamp_seconds,
          session_id: sessionId,
          preset: preset,
          speaker_info: speakerInfo ?? null,
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
    [sessionId, preset, speakerInfo]
  );

  return { verdicts, checkingIds, checkClaim };
}
