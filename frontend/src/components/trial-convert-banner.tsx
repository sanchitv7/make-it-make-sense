"use client";

import { motion } from "framer-motion";

interface TrialConvertBannerProps {
  onCreateAccount: () => void;
}

export function TrialConvertBanner({ onCreateAccount }: TrialConvertBannerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-10 flex flex-col gap-4 border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-sm leading-relaxed font-[family:var(--font-body)] text-[var(--text-secondary)]">
        Preview done. Create an account to keep this session, listen past 30 seconds, and copy a
        shareable link.
      </p>
      <button
        type="button"
        onClick={onCreateAccount}
        className="h-11 shrink-0 cursor-pointer px-4 text-xs font-[family:var(--font-display)] font-bold tracking-[0.12em] text-white uppercase"
        style={{ backgroundColor: "var(--accent-red)" }}
      >
        Create account
      </button>
    </motion.div>
  );
}
