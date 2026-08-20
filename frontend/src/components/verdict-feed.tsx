"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { DetectedClaim, FactCheckResult } from "@/types";
import { ClaimCard } from "@/components/claim-card";

interface VerdictFeedProps {
  claims: DetectedClaim[];
  verdicts: FactCheckResult[];
  checkingIds: Set<string>;
}

export function VerdictFeed({ claims, verdicts, checkingIds }: VerdictFeedProps) {
  if (claims.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2 }}
        className="flex flex-col items-start justify-center gap-5 py-12 select-none"
      >
        <div
          className="h-[1px] w-full"
          style={{ background: "linear-gradient(to right, var(--border-active), transparent)" }}
        />
        <p
          className="font-[family:var(--font-display)]"
          style={{
            fontSize: "clamp(1.5rem, 3vw, 2.2rem)",
            color: "var(--text-primary)",
            opacity: 0.15,
            fontStyle: "italic",
            lineHeight: 1.3,
          }}
        >
          Listening for factual claims…
        </p>
        <div
          className="h-[1px] w-16"
          style={{ backgroundColor: "var(--accent-gold)", opacity: 0.3 }}
        />
      </motion.div>
    );
  }

  const reversed = [...claims].reverse();

  return (
    <div className="flex flex-col space-y-8">
      <AnimatePresence mode="popLayout">
        {reversed.map((claim) => {
          const result = verdicts.find((v) => v.claim_text === claim.claim_text);
          const isChecking = checkingIds.has(claim.id);
          return (
            <motion.div key={claim.id} layout>
              <ClaimCard claim={claim} result={result} isChecking={isChecking} />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
