"use client";

import type { DetectedClaim, FactCheckResult } from "@/types";
import { ClaimCard } from "./claim-card";

interface VerdictFeedProps {
  claims: DetectedClaim[];
  verdicts: FactCheckResult[];
  checkingIds: Set<string>;
}

export function VerdictFeed({ claims, verdicts, checkingIds }: VerdictFeedProps) {
  if (claims.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full rounded-xl border p-8"
        style={{
          background: "var(--bg-card)",
          borderColor: "var(--border-subtle)",
        }}
      >
        <div className="text-3xl mb-3 opacity-30">◎</div>
        <p
          className="text-sm text-center font-mono"
          style={{ color: "var(--text-muted)" }}
        >
          Claims will appear here as they&apos;re detected.
        </p>
      </div>
    );
  }

  const reversed = [...claims].reverse();

  return (
    <div className="flex flex-col gap-3 overflow-y-auto h-full pr-1">
      {reversed.map((claim) => {
        const result = verdicts.find((v) => v.claim_text === claim.claim_text);
        const isChecking = checkingIds.has(claim.id);
        return (
          <ClaimCard
            key={claim.id}
            claim={claim}
            result={result}
            isChecking={isChecking}
          />
        );
      })}
    </div>
  );
}
