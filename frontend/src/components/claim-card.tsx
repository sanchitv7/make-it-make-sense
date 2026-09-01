"use client";

import type { Claim } from "@/types/claim";
import type { Verdict } from "@/types";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, AlertTriangle, HelpCircle, ExternalLink, Quote } from "lucide-react";

const VERDICT_CONFIG: Record<
  Verdict,
  { color: string; bg: string; icon: React.ReactNode; label: string; className: string }
> = {
  TRUE: {
    color: "var(--accent-green)",
    bg: "rgba(52,211,153,0.15)",
    icon: <CheckCircle size={16} strokeWidth={2} />,
    label: "TRUE",
    className: "verdict-true",
  },
  FALSE: {
    color: "#B91C1C",
    bg: "rgba(185,28,28,0.1)",
    icon: <XCircle size={16} strokeWidth={2} />,
    label: "FALSE",
    className: "verdict-false",
  },
  MISLEADING: {
    color: "var(--accent-amber)",
    bg: "rgba(251,191,36,0.15)",
    icon: <AlertTriangle size={16} strokeWidth={2} />,
    label: "MISLEADING",
    className: "verdict-misleading",
  },
  UNVERIFIED: {
    color: "var(--accent-zinc)",
    bg: "rgba(107,114,128,0.15)",
    icon: <HelpCircle size={16} strokeWidth={2} />,
    label: "UNVERIFIED",
    className: "verdict-unverified",
  },
};

const formatTimestamp = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

function accentFor(claim: Claim): string {
  switch (claim.phase) {
    case "heard":
      return "var(--border-active)";
    case "checking":
      return "var(--accent-blue)";
    case "verdicted":
      return VERDICT_CONFIG[claim.verdict].color;
    default: {
      const _exhaustive: never = claim;
      return _exhaustive;
    }
  }
}

function ClaimQuote({ claim }: { claim: Claim }) {
  return (
    <>
      <div className="flex items-start justify-between">
        <span
          className="pointer-events-none select-none"
          style={{ color: "var(--accent-gold)", opacity: 0.4 }}
        >
          <Quote size={32} strokeWidth={1.5} style={{ transform: "scaleX(-1)" }} />
        </span>
        <div
          className="font-[family:var(--font-mono)] text-[var(--text-muted)]"
          style={{ fontSize: "0.65rem" }}
        >
          {formatTimestamp(claim.timestamp_seconds)}
        </div>
      </div>
      <p
        className="font-[family:var(--font-display)] text-[var(--text-primary)]"
        style={{
          fontStyle: "italic",
          fontSize: "clamp(1.1rem, 3.5vw, 1.45rem)",
          lineHeight: 1.6,
        }}
      >
        &#x201C;{claim.claim_text}&#x201D;
      </p>
    </>
  );
}

function CheckingBody() {
  return (
    <motion.div
      key="checking"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col gap-2"
    >
      {[100, 85, 60].map((widthPct, i) => (
        <motion.div
          key={i}
          animate={{ opacity: [0.25, 0.6, 0.25] }}
          transition={{
            repeat: Infinity,
            duration: 1.6,
            delay: i * 0.15,
            ease: "easeInOut",
          }}
          style={{
            height: "8px",
            width: `${widthPct}%`,
            backgroundColor: "var(--border-active)",
            borderRadius: 0,
          }}
        />
      ))}
      <div className="mt-3 flex items-center gap-2.5">
        <motion.span
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
          style={{
            width: 9,
            height: 9,
            borderRadius: "50%",
            backgroundColor: "var(--accent-red)",
            display: "inline-block",
            flexShrink: 0,
          }}
        />
        <motion.span
          className="font-[family:var(--font-mono)] tracking-widest uppercase"
          animate={{ backgroundPosition: ["200% center", "-200% center"] }}
          transition={{ repeat: Infinity, duration: 2.4, ease: "linear" }}
          style={{
            fontSize: "0.9rem",
            background:
              "linear-gradient(90deg, var(--text-muted) 20%, var(--accent-gold) 50%, var(--text-muted) 80%)",
            backgroundSize: "200% auto",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            backgroundPosition: "200% center",
          }}
        >
          Verifying…
        </motion.span>
      </div>
    </motion.div>
  );
}

function VerdictBody({ claim }: { claim: Extract<Claim, { phase: "verdicted" }> }) {
  const config = VERDICT_CONFIG[claim.verdict];
  return (
    <motion.div
      key="result"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-2"
    >
      {claim.verdict_summary ? (
        <p
          className="font-[family:var(--font-body)] text-[var(--text-secondary)]"
          style={{ fontSize: "1rem", lineHeight: 1.65 }}
        >
          {claim.verdict_summary}
        </p>
      ) : null}
      <div className="mt-1 flex items-center justify-between gap-4">
        {claim.source_name ? (
          <a
            href={claim.source_url || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-[family:var(--font-mono)] underline-offset-2 hover:underline"
            style={{ color: "var(--accent-blue)", fontSize: "0.8rem" }}
          >
            <ExternalLink size={14} strokeWidth={2} />
            {claim.source_name}
          </a>
        ) : (
          <span />
        )}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className={`inline-flex items-center gap-2 px-3 py-1.5 font-[family:var(--font-mono)] font-bold uppercase ${config.className}`}
          style={{ borderRadius: 0, fontSize: "0.8rem", letterSpacing: "0.15em" }}
        >
          {config.icon}
          {config.label}
        </motion.div>
      </div>
    </motion.div>
  );
}

function PhaseBody({ claim }: { claim: Claim }) {
  switch (claim.phase) {
    case "heard":
      return null;
    case "checking":
      return <CheckingBody />;
    case "verdicted":
      return <VerdictBody claim={claim} />;
    default: {
      const _exhaustive: never = claim;
      return _exhaustive;
    }
  }
}

export function ClaimCard({ claim }: { claim: Claim }) {
  const accentColor = accentFor(claim);

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="relative w-full"
    >
      <div
        className="relative overflow-hidden"
        style={{
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 0,
          padding:
            "clamp(16px, 4vw, 28px) clamp(16px, 4vw, 28px) clamp(16px, 4vw, 28px) clamp(24px, 5vw, 40px)",
          boxShadow: "var(--card-shadow)",
        }}
      >
        <motion.div
          animate={{ backgroundColor: accentColor }}
          transition={{ duration: 0.4 }}
          className="absolute top-0 bottom-0 left-0"
          style={{ width: "3px" }}
        />
        <div className="relative flex flex-col gap-4" style={{ zIndex: 1 }}>
          <ClaimQuote claim={claim} />
          <AnimatePresence mode="wait">
            <PhaseBody claim={claim} />
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
