"use client";

import { useEffect, useState } from "react";
import type { Verdict } from "@/types";

interface TopBarProps {
  isConnected: boolean;
  isPaused: boolean;
  verdictCounts: Record<Verdict, number>;
  totalClaims: number;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

export function TopBar({
  isConnected,
  isPaused,
  verdictCounts,
  totalClaims,
  onPause,
  onResume,
  onStop,
}: TopBarProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isConnected || isPaused) return;
    const base = Date.now() - elapsed * 1000;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - base) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isConnected, isPaused]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timeStr = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

  const hasVerdicts =
    verdictCounts.TRUE > 0 ||
    verdictCounts.FALSE > 0 ||
    verdictCounts.MISLEADING > 0 ||
    verdictCounts.UNVERIFIED > 0;

  return (
    <div
      className="rounded-xl border mb-3"
      style={{
        background: "var(--bg-card)",
        borderColor: "var(--border-subtle)",
      }}
    >
      {/* Row 1: status + timer + buttons */}
      <div className="flex items-center justify-between px-4 py-3">
        {/* Left: connection dot + status + timer */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${isConnected ? "animate-pulse" : ""}`}
              style={{
                background: isConnected
                  ? "var(--accent-green)"
                  : "var(--accent-red)",
              }}
            />
            <span
              className="text-xs font-mono uppercase tracking-wider"
              style={{ color: "var(--text-secondary)" }}
            >
              {!isConnected ? "Disconnected" : isPaused ? "Paused" : "Live"}
            </span>
          </div>
          <span className="text-sm font-mono font-semibold">{timeStr}</span>
        </div>

        {/* Right: pause + stop buttons */}
        <div className="flex items-center gap-2">
          {isConnected && (
            <button
              onClick={isPaused ? onResume : onPause}
              className="flex items-center justify-center px-5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer hover:brightness-110"
              style={{
                minHeight: "44px",
                background: isPaused ? "var(--glow-green)" : "rgba(59,130,246,0.1)",
                color: isPaused ? "var(--accent-green)" : "var(--accent-blue)",
                border: `1px solid ${isPaused ? "rgba(34,197,94,0.3)" : "rgba(59,130,246,0.3)"}`,
              }}
            >
              {isPaused ? "Resume" : "Pause"}
            </button>
          )}
          <button
            onClick={onStop}
            className="flex items-center justify-center px-5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer hover:brightness-110"
            style={{
              minHeight: "44px",
              background: "var(--glow-red)",
              color: "var(--accent-red)",
              border: "1px solid rgba(239,68,68,0.3)",
            }}
          >
            Stop
          </button>
        </div>
      </div>

      {/* Row 2: verdict pills (only when there are verdicts) */}
      {hasVerdicts && (
        <div
          className="flex items-center gap-2 px-4 pb-3 flex-wrap"
          style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "10px" }}
        >
          <span
            className="text-xs font-mono"
            style={{ color: "var(--text-muted)" }}
          >
            {totalClaims} claim{totalClaims !== 1 ? "s" : ""}
          </span>
          {verdictCounts.TRUE > 0 && (
            <span className="verdict-true text-xs px-2 py-0.5 rounded border font-mono">
              {verdictCounts.TRUE} ✓ True
            </span>
          )}
          {verdictCounts.FALSE > 0 && (
            <span className="verdict-false text-xs px-2 py-0.5 rounded border font-mono">
              {verdictCounts.FALSE} ✗ False
            </span>
          )}
          {verdictCounts.MISLEADING > 0 && (
            <span className="verdict-misleading text-xs px-2 py-0.5 rounded border font-mono">
              {verdictCounts.MISLEADING} ⚠ Misleading
            </span>
          )}
          {verdictCounts.UNVERIFIED > 0 && (
            <span className="verdict-unverified text-xs px-2 py-0.5 rounded border font-mono">
              {verdictCounts.UNVERIFIED} ? Unverified
            </span>
          )}
        </div>
      )}
    </div>
  );
}
