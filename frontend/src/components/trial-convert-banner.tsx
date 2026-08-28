"use client";

import { motion } from "framer-motion";

/** Short convert prompt on The Verdict — the footer button is the only CTA. */
export function TrialConvertBanner() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-10 border border-[var(--border-subtle)] bg-[var(--bg-card)] px-5 py-5"
    >
      <p className="text-[10px] font-[family:var(--font-mono)] tracking-[0.2em] text-[var(--text-muted)] uppercase">
        Keep this session
      </p>
      <p className="mt-2 text-xl leading-snug font-[family:var(--font-display)] text-[var(--text-primary)] italic">
        Listen longer. Share the verdict.
      </p>
    </motion.div>
  );
}
