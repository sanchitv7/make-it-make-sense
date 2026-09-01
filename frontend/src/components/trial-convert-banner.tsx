"use client";

import { motion } from "framer-motion";
import { CREATE_ACCOUNT_CTA } from "@/lib/auth-copy";

export function TrialConvertBanner({ onCreateAccount }: { onCreateAccount: () => void }) {
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
      <button
        type="button"
        onClick={onCreateAccount}
        className="mt-4 h-14 w-full cursor-pointer bg-[var(--accent-red)] text-xs font-[family:var(--font-mono)] tracking-widest text-white uppercase"
        style={{ borderRadius: 0 }}
      >
        {CREATE_ACCOUNT_CTA}
      </button>
    </motion.div>
  );
}
