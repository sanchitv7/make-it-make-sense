"use client";

import { useEffect, useRef, useState } from "react";
import type { Verdict } from "@/types";
import type { TranscriptSegment } from "@/hooks/use-gemini-live";

interface ClaimVerdict {
  claimId: string;
  verdict: Verdict | "CHECKING";
}

interface TranscriptPanelProps {
  segments: TranscriptSegment[];
  claimVerdicts: ClaimVerdict[];
  isConnected: boolean;
  isPaused: boolean;
}

const VERDICT_CONFIG: Record<string, {
  color: string;
  glow: string;
  bg: string;
  label: string;
  icon: string;
}> = {
  TRUE:       { color: "#22c55e", glow: "rgba(34,197,94,0.2)",   bg: "rgba(34,197,94,0.06)",   label: "VERIFIED",    icon: "✓" },
  FALSE:      { color: "#ef4444", glow: "rgba(239,68,68,0.2)",   bg: "rgba(239,68,68,0.06)",   label: "FALSE",       icon: "✗" },
  MISLEADING: { color: "#f59e0b", glow: "rgba(245,158,11,0.2)",  bg: "rgba(245,158,11,0.06)",  label: "MISLEADING",  icon: "⚠" },
  UNVERIFIED: { color: "#71717a", glow: "rgba(113,113,122,0.15)", bg: "rgba(113,113,122,0.05)", label: "UNVERIFIED",  icon: "?" },
  CHECKING:   { color: "#3b82f6", glow: "rgba(59,130,246,0.2)",  bg: "rgba(59,130,246,0.06)",  label: "CHECKING",    icon: "…" },
};

function ClaimBadge({ verdict }: { verdict: Verdict | "CHECKING" }) {
  const cfg = VERDICT_CONFIG[verdict] ?? VERDICT_CONFIG.CHECKING;
  const isChecking = verdict === "CHECKING";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "3px",
        fontSize: "0.6rem",
        fontFamily: "var(--font-mono), monospace",
        fontWeight: 700,
        letterSpacing: "0.08em",
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.color}33`,
        borderRadius: "3px",
        padding: "1px 5px",
        verticalAlign: "middle",
        marginLeft: "4px",
        position: "relative",
        top: "-1px",
        transition: "all 0.4s ease",
        animation: isChecking ? "badge-pulse 1.5s ease-in-out infinite" : "badge-appear 0.3s ease forwards",
      }}
    >
      <span style={{ opacity: isChecking ? undefined : 1 }}>{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}

function ClaimSegment({
  seg,
  verdict,
}: {
  seg: TranscriptSegment & { type: "claim" };
  verdict: Verdict | "CHECKING";
}) {
  const [mounted, setMounted] = useState(false);
  const cfg = VERDICT_CONFIG[verdict] ?? VERDICT_CONFIG.CHECKING;

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  // Re-key the span when verdict resolves to replay the appear animation
  const resolvedKey = verdict !== "CHECKING" ? verdict : "checking";

  return (
    <span
      key={resolvedKey}
      style={{
        display: "inline",
        background: mounted ? cfg.bg : "transparent",
        borderBottom: `2px solid ${mounted ? cfg.color : "transparent"}`,
        borderRadius: "2px 2px 0 0",
        padding: "2px 2px 1px",
        transition: "background 0.5s ease, border-color 0.5s ease",
        cursor: "default",
        animation: verdict !== "CHECKING" && mounted ? "verdict-flash 0.5s ease" : "none",
      }}
    >
      {seg.text}
      <ClaimBadge verdict={verdict} />
    </span>
  );
}

export function TranscriptPanel({
  segments,
  claimVerdicts,
  isConnected,
  isPaused,
}: TranscriptPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  useEffect(() => {
    if (isAtBottomRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [segments]);

  const verdictMap = new Map(claimVerdicts.map((cv) => [cv.claimId, cv.verdict]));
  const isEmpty = segments.length === 0;
  const claimCount = segments.filter((s) => s.type === "claim").length;

  return (
    <>
      <style>{`
        @keyframes badge-pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        @keyframes badge-appear {
          from { opacity: 0; transform: scale(0.8); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes cursor-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes scan-line {
          0%   { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
        @keyframes text-in {
          from { opacity: 0; filter: blur(4px); }
          to   { opacity: 1; filter: blur(0); }
        }
        @keyframes verdict-flash {
          0%   { box-shadow: 0 0 0 0 currentColor; }
          40%  { box-shadow: 0 0 16px 4px currentColor; }
          100% { box-shadow: 0 0 0 0 currentColor; }
        }
        @keyframes status-breathe {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); }
          50% { box-shadow: 0 0 0 4px rgba(239,68,68,0); }
        }
        .transcript-text span[data-new] {
          animation: text-in 0.2s ease forwards;
        }
      `}</style>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          borderRadius: "16px",
          border: "1px solid var(--border-subtle)",
          background: "var(--bg-card)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Subtle scan line when live */}
        {isConnected && !isPaused && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              zIndex: 0,
              overflow: "hidden",
              borderRadius: "16px",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                height: "1px",
                background: "linear-gradient(90deg, transparent, rgba(59,130,246,0.15), transparent)",
                animation: "scan-line 4s linear infinite",
              }}
            />
          </div>
        )}

        {/* Header */}
        <div
          style={{
            padding: "14px 20px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
            position: "relative",
            zIndex: 1,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {/* Live indicator */}
            <div style={{ position: "relative", width: "8px", height: "8px" }}>
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: isPaused
                    ? "var(--accent-amber)"
                    : isConnected
                    ? "var(--accent-red)"
                    : "var(--text-muted)",
                  animation: isConnected && !isPaused ? "status-breathe 2s ease infinite" : "none",
                }}
              />
            </div>
            <span
              style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: "0.7rem",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--text-secondary)",
              }}
            >
              {isPaused ? "Paused" : isConnected ? "Live Transcript" : "Transcript"}
            </span>
          </div>

          {/* Claim counter */}
          {claimCount > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontFamily: "var(--font-mono), monospace",
                fontSize: "0.65rem",
                color: "var(--text-muted)",
                letterSpacing: "0.06em",
              }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.2" />
                <circle cx="5" cy="5" r="1.5" fill="currentColor" />
              </svg>
              {claimCount} claim{claimCount !== 1 ? "s" : ""} flagged
            </div>
          )}
        </div>

        {/* Transcript body */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "28px 28px 24px",
            position: "relative",
            zIndex: 1,
          }}
        >
          {isEmpty ? (
            <div
              style={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "16px",
              }}
            >
              {/* Waveform idle animation */}
              <div style={{ display: "flex", alignItems: "center", gap: "3px", height: "24px" }}>
                {[0.4, 0.7, 1, 0.6, 0.9, 0.5, 0.8, 0.4, 0.7, 1, 0.6].map((h, i) => (
                  <div
                    key={i}
                    style={{
                      width: "2px",
                      height: `${h * 24}px`,
                      borderRadius: "1px",
                      background: isConnected && !isPaused
                        ? "var(--accent-blue)"
                        : "var(--border-active)",
                      opacity: isConnected && !isPaused ? 1 : 0.4,
                      animation: isConnected && !isPaused
                        ? `badge-pulse ${0.8 + i * 0.1}s ease-in-out ${i * 0.07}s infinite`
                        : "none",
                    }}
                  />
                ))}
              </div>
              <span
                style={{
                  fontFamily: "var(--font-mono), monospace",
                  fontSize: "0.72rem",
                  letterSpacing: "0.1em",
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                }}
              >
                {isPaused ? "Microphone paused" : isConnected ? "Listening for speech…" : "Waiting for connection…"}
              </span>
            </div>
          ) : (
            <div
              className="transcript-text"
              style={{
                fontSize: "1rem",
                lineHeight: "2",
                color: "var(--text-primary)",
                letterSpacing: "0.01em",
                fontWeight: 400,
              }}
            >
              {segments.map((seg) => {
                if (seg.type === "text") {
                  return (
                    <span key={seg.id} style={{ color: "var(--text-primary)" }}>
                      {seg.text}
                    </span>
                  );
                }

                const verdict = verdictMap.get(seg.claimId) ?? "CHECKING";
                return (
                  <ClaimSegment key={seg.id} seg={seg} verdict={verdict} />
                );
              })}

              {/* Live cursor */}
              {isConnected && !isPaused && (
                <span
                  style={{
                    display: "inline-block",
                    width: "2px",
                    height: "1em",
                    background: "var(--accent-blue)",
                    marginLeft: "2px",
                    verticalAlign: "text-bottom",
                    borderRadius: "1px",
                    animation: "cursor-blink 1s step-end infinite",
                  }}
                />
              )}

              {isPaused && (
                <span
                  style={{
                    display: "inline-block",
                    width: "8px",
                    height: "1em",
                    marginLeft: "4px",
                    verticalAlign: "text-bottom",
                    borderRadius: "1px",
                    background: "var(--accent-amber)",
                    opacity: 0.6,
                  }}
                />
              )}
            </div>
          )}
        </div>

        {/* Bottom status strip */}
        {!isEmpty && (
          <div
            style={{
              borderTop: "1px solid var(--border-subtle)",
              padding: "8px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", gap: "12px" }}>
              {Object.entries(VERDICT_CONFIG)
                .filter(([k]) => k !== "CHECKING")
                .map(([verdict, cfg]) => {
                  const count = claimVerdicts.filter(
                    (cv) => cv.verdict === verdict
                  ).length;
                  if (count === 0) return null;
                  return (
                    <span
                      key={verdict}
                      style={{
                        fontFamily: "var(--font-mono), monospace",
                        fontSize: "0.6rem",
                        letterSpacing: "0.08em",
                        color: cfg.color,
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <span>{cfg.icon}</span>
                      <span>{count} {cfg.label}</span>
                    </span>
                  );
                })}
            </div>
            <span
              style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: "0.6rem",
                color: "var(--text-muted)",
                letterSpacing: "0.06em",
              }}
            >
              {segments.reduce((acc, s) => acc + s.text.length, 0).toLocaleString()} chars
            </span>
          </div>
        )}
      </div>
    </>
  );
}
