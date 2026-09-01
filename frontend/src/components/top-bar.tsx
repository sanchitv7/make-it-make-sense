"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BrandTitle } from "@/components/brand-title";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  HelpCircle,
  Square,
  Play,
  Pause,
  Radio,
} from "lucide-react";
import type { Claim, ListenReady } from "@/types/claim";
import type { Verdict } from "@/types";
import { ListeningIndicator } from "@/components/listening-indicator";
import { AccountChip } from "@/components/account-chip";
import { useAuth } from "@/components/auth-provider";
import { accountFullNameFromMetadata } from "@/lib/account-display-name";
import { headerAuthControlClassName } from "@/lib/header-auth-control";
import { trialPreviewCueCopy, type TrialPreviewCue } from "@/lib/trial";

interface TopBarProps {
  ready: ListenReady;
  claims: Claim[];
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onSignOut: () => void;
  onTitleClick: () => void;
  trialCue?: TrialPreviewCue;
  accountFullName?: string;
}

function AccountChrome({ fullName, onSignOut }: { fullName: string; onSignOut: () => void }) {
  return (
    <div className="flex shrink-0 items-center gap-3">
      <AccountChip fullName={fullName} />
      <button type="button" onClick={onSignOut} className={headerAuthControlClassName}>
        Sign out
      </button>
    </div>
  );
}

function formatElapsed(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return [hrs, mins, secs].map((v) => v.toString().padStart(2, "0")).join(":");
}

function ElapsedTime({ elapsed }: { elapsed: number }) {
  return (
    <span className="inline-block w-[5.5ch] text-xs font-[family:var(--font-mono)] font-bold text-[var(--text-primary)] tabular-nums md:text-sm">
      {formatElapsed(elapsed)}
    </span>
  );
}

function LiveBadge({ ready }: { ready: ListenReady }) {
  switch (ready.status) {
    case "offline":
      return (
        <span className="text-xs font-bold tracking-widest text-[var(--text-muted)] uppercase">
          OFFLINE
        </span>
      );
    case "connecting":
      return (
        <span className="text-xs font-bold tracking-widest text-[var(--text-secondary)] uppercase">
          CONNECTING
        </span>
      );
    case "listening":
      return (
        <div className="flex items-center gap-1.5 text-xs font-bold md:text-sm">
          <Radio size={12} className="animate-pulse text-[#B91C1C]" />
          <span className="text-[#B91C1C]">LIVE</span>
        </div>
      );
    case "paused":
      return (
        <div className="flex items-center gap-1.5 text-xs font-bold md:text-sm">
          <Radio size={12} className="text-[var(--accent-amber)]" />
          <span className="text-[var(--accent-amber)]">PAUSED</span>
        </div>
      );
    default: {
      const _exhaustive: never = ready;
      return _exhaustive;
    }
  }
}

function LiveStatus({
  ready,
  elapsed,
  trialCue,
}: {
  ready: ListenReady;
  elapsed: number;
  trialCue?: TrialPreviewCue;
}) {
  const cueCopy = trialPreviewCueCopy(trialCue ?? { kind: "none" });
  return (
    <div className="flex items-center gap-3 font-[family:var(--font-mono)] tabular-nums">
      <LiveBadge ready={ready} />
      {ready.status !== "offline" ? (
        <span className="border-l border-[var(--border-subtle)] pl-3">
          <ElapsedTime elapsed={elapsed} />
          {cueCopy ? (
            <span className="ml-2 text-xs font-bold text-[var(--text-muted)] md:text-sm">
              {cueCopy}
            </span>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}

function SessionControls({
  ready,
  onPause,
  onResume,
  onStop,
}: {
  ready: ListenReady;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}) {
  const paused = ready.status === "paused";
  const canToggle = ready.status === "listening" || ready.status === "paused";
  return (
    <div className="flex items-center gap-1 md:border-l md:border-[var(--border-active)] md:pl-4">
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={paused ? onResume : onPause}
        disabled={!canToggle}
        className="flex h-8 w-8 cursor-pointer items-center justify-center border border-[var(--border-active)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--text-primary)] hover:text-[var(--bg-card)] disabled:cursor-not-allowed disabled:opacity-30"
        aria-label={paused ? "Resume" : "Pause"}
        style={{ borderRadius: 0 }}
      >
        {paused ? <Play size={16} strokeWidth={2} /> : <Pause size={16} strokeWidth={2} />}
      </motion.button>
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={onStop}
        className="flex h-8 cursor-pointer items-center gap-1.5 px-3 text-xs font-[family:var(--font-mono)] tracking-widest text-white uppercase transition-opacity hover:opacity-80"
        aria-label="End Session"
        style={{ borderRadius: 0, backgroundColor: "#B91C1C" }}
      >
        <Square size={14} strokeWidth={2} />
        <span>END</span>
      </motion.button>
    </div>
  );
}

function countsFromClaims(claims: Claim[]): {
  total: number;
  verdictCounts: Record<Verdict, number>;
} {
  const verdictCounts: Record<Verdict, number> = {
    TRUE: 0,
    FALSE: 0,
    MISLEADING: 0,
    UNVERIFIED: 0,
  };
  let total = 0;
  for (const claim of claims) {
    if (claim.phase === "heard") continue;
    total += 1;
    if (claim.phase === "verdicted") {
      verdictCounts[claim.verdict] += 1;
    }
  }
  return { total, verdictCounts };
}

export function TopBar({
  ready,
  claims,
  onPause,
  onResume,
  onStop,
  onSignOut,
  onTitleClick,
  trialCue,
  accountFullName,
}: TopBarProps) {
  const { user } = useAuth();
  const [elapsed, setElapsed] = useState(0);
  const { total: totalClaims, verdictCounts } = countsFromClaims(claims);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (ready.status === "listening") {
      interval = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [ready.status]);

  useEffect(() => {
    if (ready.status === "offline") {
      setElapsed(0);
    }
  }, [ready.status]);

  const showCounts = totalClaims > 0;
  const accountName =
    accountFullName || (user ? accountFullNameFromMetadata(user.user_metadata) : "");

  return (
    <header
      className="app-header-frost sticky top-0 z-[60] w-full"
      style={{ borderRadius: 0, borderTop: "6px solid var(--border-active)" }}
    >
      <div className="md:hidden">
        <div className="flex items-center justify-between gap-3 px-4 pb-2">
          <div className="shrink-0">
            <BrandTitle onClick={onTitleClick} />
          </div>
          {accountName ? <AccountChrome fullName={accountName} onSignOut={onSignOut} /> : null}
        </div>
        <div className="flex items-center justify-between gap-3 px-4 pb-3">
          <LiveStatus ready={ready} elapsed={elapsed} trialCue={trialCue} />
          <SessionControls ready={ready} onPause={onPause} onResume={onResume} onStop={onStop} />
        </div>
      </div>

      <div className="hidden items-center justify-between px-6 pb-3 md:flex">
        <div className="shrink-0">
          <BrandTitle onClick={onTitleClick} />
        </div>
        <div className="flex shrink-0 items-center gap-8">
          {accountName ? <AccountChrome fullName={accountName} onSignOut={onSignOut} /> : null}
          <LiveStatus ready={ready} elapsed={elapsed} trialCue={trialCue} />
          <SessionControls ready={ready} onPause={onPause} onResume={onResume} onStop={onStop} />
        </div>
      </div>

      <AnimatePresence>
        {showCounts && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-[var(--border-subtle)]"
          >
            <div className="flex divide-x divide-[var(--border-subtle)] text-[10px] font-[family:var(--font-mono)] tracking-tighter text-[var(--text-secondary)] uppercase md:text-xs md:tracking-widest">
              <div
                className="flex items-center gap-2 px-3 py-1.5 font-black text-[var(--bg-card)]"
                style={{ backgroundColor: "var(--text-primary)", borderRadius: 0 }}
              >
                VERDICTS
              </div>
              <div className="flex flex-1 items-center gap-2 px-3 py-1.5 sm:flex-none">
                <span className="text-[var(--text-muted)]">CLAIMS:</span>
                <motion.span
                  key={totalClaims}
                  initial={{ opacity: 0.5 }}
                  animate={{ opacity: 1 }}
                  className="font-bold text-[var(--text-primary)]"
                >
                  {totalClaims}
                </motion.span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5">
                <CheckCircle size={13} className="text-[var(--accent-green)]" />
                <span className="hidden text-[var(--text-muted)] md:inline">TRUE:</span>
                <motion.span
                  key={verdictCounts.TRUE}
                  initial={{ scale: 1.2 }}
                  animate={{ scale: 1 }}
                  className="font-bold text-[var(--text-primary)]"
                >
                  {verdictCounts.TRUE}
                </motion.span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5">
                <XCircle size={13} style={{ color: "#B91C1C" }} />
                <span className="hidden text-[var(--text-muted)] md:inline">FALSE:</span>
                <motion.span
                  key={verdictCounts.FALSE}
                  initial={{ scale: 1.2 }}
                  animate={{ scale: 1 }}
                  className="font-bold text-[var(--text-primary)]"
                >
                  {verdictCounts.FALSE}
                </motion.span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5">
                <AlertTriangle size={13} className="text-[var(--accent-amber)]" />
                <span className="hidden text-[var(--text-muted)] md:inline">MISLEADING:</span>
                <motion.span
                  key={verdictCounts.MISLEADING}
                  initial={{ scale: 1.2 }}
                  animate={{ scale: 1 }}
                  className="font-bold text-[var(--text-primary)]"
                >
                  {verdictCounts.MISLEADING}
                </motion.span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5">
                <HelpCircle size={13} className="text-[var(--text-muted)]" />
                <span className="hidden text-[var(--text-muted)] md:inline">UNVERIFIED:</span>
                <motion.span
                  key={verdictCounts.UNVERIFIED}
                  initial={{ scale: 1.2 }}
                  animate={{ scale: 1 }}
                  className="font-bold text-[var(--text-primary)]"
                >
                  {verdictCounts.UNVERIFIED}
                </motion.span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <ListeningIndicator ready={ready} />
    </header>
  );
}
