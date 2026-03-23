"use client";

import type { DetectedClaim, FactCheckResult, Verdict } from "@/types";

interface ClaimCardProps {
  claim: DetectedClaim;
  result?: FactCheckResult;
  isChecking: boolean;
}

const VERDICT_CONFIG: Record<Verdict, { icon: string; label: string; color: string; glow: string }> = {
  TRUE:       { icon: "✓", label: "True",       color: "var(--accent-green)", glow: "var(--glow-green)" },
  FALSE:      { icon: "✗", label: "False",      color: "var(--accent-red)",   glow: "var(--glow-red)"   },
  MISLEADING: { icon: "⚠", label: "Misleading", color: "var(--accent-amber)", glow: "var(--glow-amber)" },
  UNVERIFIED: { icon: "?", label: "Unverified", color: "var(--accent-zinc)",  glow: "rgba(113,113,122,0.1)" },
};

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function ClaimCard({ claim, result, isChecking }: ClaimCardProps) {
  const cfg = result ? VERDICT_CONFIG[result.verdict] : null;

  // Left accent bar color
  const accentColor = cfg
    ? cfg.color
    : isChecking
    ? "var(--accent-blue)"
    : "var(--border-active)";

  return (
    <div
      className="animate-slide-in-up"
      style={{
        position: "relative",
        borderRadius: "12px",
        border: "1px solid var(--border-subtle)",
        background: "var(--bg-card)",
        padding: "16px 16px 16px 20px",
        overflow: "clip",
        transition: "border-color 0.5s ease",
      }}
    >
      {/* Left accent bar */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: "4px",
          background: accentColor,
          borderRadius: "12px 0 0 12px",
          transition: "background 0.5s ease",
          animation: isChecking && !result
            ? "accent-pulse 2s ease-in-out infinite"
            : "none",
        }}
      />

      {/* Header row: verdict badge (when resolved) + timestamp */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: cfg ? "space-between" : "flex-end",
          marginBottom: "10px",
          minHeight: "22px",
        }}
      >
        {cfg && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              padding: "3px 10px",
              borderRadius: "6px",
              fontSize: "0.7rem",
              fontWeight: 700,
              fontFamily: "var(--font-mono), monospace",
              letterSpacing: "0.06em",
              color: cfg.color,
              background: cfg.glow,
              border: `1px solid ${cfg.color}44`,
              animation: "fade-in 0.3s ease forwards",
            }}
          >
            <span>{cfg.icon}</span>
            {cfg.label}
          </span>
        )}

        <span
          style={{
            fontSize: "0.68rem",
            fontFamily: "var(--font-mono), monospace",
            color: "var(--text-muted)",
          }}
        >
          {formatTimestamp(claim.timestamp_seconds)}
        </span>
      </div>

      {/* Claim quote */}
      <p
        style={{
          fontSize: "0.95rem",
          fontWeight: 500,
          lineHeight: 1.5,
          color: "var(--text-primary)",
          marginBottom: isChecking || result ? "12px" : 0,
        }}
      >
        &ldquo;{claim.claim_text}&rdquo;
      </p>

      {/* Phase 2: shimmer skeleton */}
      {isChecking && !result && (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div className="shimmer-line" style={{ height: "10px", width: "92%" }} />
          <div className="shimmer-line" style={{ height: "10px", width: "70%" }} />
        </div>
      )}

      {/* Phase 3: verdict rationale + source */}
      {result && (
        <div style={{ animation: "fade-in 0.4s ease forwards" }}>
          <p
            style={{
              fontSize: "0.82rem",
              lineHeight: 1.55,
              color: "var(--text-secondary)",
              marginBottom: result.source_url ? "10px" : 0,
            }}
          >
            {result.verdict_summary}
          </p>

          {result.source_url && (
            <a
              href={result.source_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                fontSize: "0.72rem",
                fontFamily: "var(--font-mono), monospace",
                color: "var(--accent-blue)",
                textDecoration: "none",
                padding: "4px 0",
              }}
            >
              <span>↗</span>
              {result.source_name || "Source"}
            </a>
          )}
        </div>
      )}

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes accent-pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
