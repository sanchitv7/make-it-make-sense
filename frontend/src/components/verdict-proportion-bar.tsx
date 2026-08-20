"use client";

import { motion } from "framer-motion";
import type { Verdict } from "@/types";
import { VERDICT_CONFIG, VERDICT_ORDER } from "@/lib/verdict-config";

interface VerdictProportionBarProps {
  counts: Record<Verdict, number>;
  total: number;
  /** Compact bar for session cards (no count legend). */
  compact?: boolean;
}

export function VerdictProportionBar({
  counts,
  total,
  compact = false,
}: VerdictProportionBarProps) {
  if (total <= 0) return null;

  return (
    <div>
      <div className={`flex w-full overflow-hidden bg-[var(--bg-card)] ${compact ? "h-2" : "h-4"}`}>
        {VERDICT_ORDER.map((v) => {
          const count = counts[v];
          if (count === 0) return null;
          return (
            <motion.div
              key={v}
              initial={{ width: 0 }}
              animate={{ width: `${(count / total) * 100}%` }}
              transition={{ duration: compact ? 0.6 : 1, ease: [0.22, 1, 0.36, 1] }}
              className="h-full flex-shrink-0"
              style={{ backgroundColor: VERDICT_CONFIG[v].color }}
            />
          );
        })}
      </div>
      {!compact && (
        <div className="mt-5 flex flex-wrap gap-6">
          {VERDICT_ORDER.map((v) => {
            const count = counts[v];
            if (count === 0) return null;
            return (
              <div
                key={v}
                className="flex flex-col gap-0.5"
                style={{
                  borderLeft: `3px solid ${VERDICT_CONFIG[v].color}`,
                  paddingLeft: "12px",
                }}
              >
                <span
                  className="leading-none font-[family:var(--font-display)]"
                  style={{ fontSize: "2rem", color: VERDICT_CONFIG[v].color }}
                >
                  {count}
                </span>
                <span
                  className="font-[family:var(--font-mono)] tracking-widest text-[var(--text-muted)] uppercase"
                  style={{ fontSize: "0.8rem" }}
                >
                  {v}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
