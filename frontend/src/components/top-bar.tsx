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
import type { Verdict } from "@/types";
import { ListeningIndicator } from "@/components/listening-indicator";
import { AccountChip } from "@/components/account-chip";
import { useAuth } from "@/components/auth-provider";
import { accountFullNameFromMetadata } from "@/lib/account-display-name";

interface TopBarProps {
  isConnected: boolean;
  isPaused: boolean;
  verdictCounts: Record<Verdict, number>;
  totalClaims: number;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onSignOut: () => void;
  onTitleClick: () => void;
}

const signOutClassName =
  "inline-flex items-center justify-center min-h-8 px-3 font-[family:var(--font-body)] text-xs text-[var(--text-primary)] border border-[var(--border-subtle)] hover:border-[var(--border-active)] cursor-pointer transition-colors";

export function TopBar({
  isConnected,
  isPaused,
  verdictCounts,
  totalClaims,
  onPause,
  onResume,
  onStop,
  onSignOut,
  onTitleClick,
}: TopBarProps) {
  const { user } = useAuth();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isConnected && !isPaused) {
      interval = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isConnected, isPaused]);

  useEffect(() => {
    if (!isConnected) {
      setElapsed(0);
    }
  }, [isConnected]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return [hrs, mins, secs].map((v) => v.toString().padStart(2, "0")).join(":");
  };

  const hasVerdicts = Object.values(verdictCounts).some((count) => count > 0);

  return (
    <header className="sticky top-0 isolate z-50 w-full" style={{ borderRadius: 0 }}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 border-b border-[var(--border-subtle)] backdrop-blur-xl backdrop-saturate-150"
        style={{
          backgroundColor: "color-mix(in srgb, var(--bg-card) 78%, transparent)",
          borderTop: "6px solid var(--border-active)",
        }}
      />
      <div
        className="relative flex items-center justify-between px-4 py-3 md:px-6"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <div className="flex items-baseline overflow-hidden">
          <BrandTitle onClick={onTitleClick} />
        </div>

        <div className="flex items-center gap-4 md:gap-8">
          {user ? (
            <div className="flex items-center gap-3">
              <AccountChip fullName={accountFullNameFromMetadata(user.user_metadata)} />
              <button type="button" onClick={onSignOut} className={signOutClassName}>
                Sign out
              </button>
            </div>
          ) : null}

          <div className="flex items-center gap-3 font-[family:var(--font-mono)] tabular-nums">
            <AnimatePresence mode="wait">
              {isConnected ? (
                <motion.div
                  key="connected"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="flex items-center gap-3 text-xs font-bold md:text-sm"
                >
                  <div className="flex items-center gap-1.5">
                    <motion.div
                      animate={isPaused ? { opacity: 1 } : { opacity: [1, 0.4, 1] }}
                      transition={
                        isPaused
                          ? { duration: 0 }
                          : { repeat: Infinity, duration: 1.5, ease: "easeInOut" }
                      }
                      className="flex items-center justify-center"
                    >
                      <Radio
                        size={12}
                        className={isPaused ? "text-[var(--accent-amber)]" : "text-[#B91C1C]"}
                      />
                    </motion.div>
                    <span className={isPaused ? "text-[var(--accent-amber)]" : "text-[#B91C1C]"}>
                      {isPaused ? "PAUSED" : "LIVE"}
                    </span>
                  </div>
                  <span className="inline-block w-[5.5ch] border-l border-[var(--border-subtle)] pl-3 text-[var(--text-primary)]">
                    {formatTime(elapsed)}
                  </span>
                </motion.div>
              ) : (
                <motion.span
                  key="offline"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs font-bold tracking-widest text-[var(--text-muted)] uppercase"
                >
                  OFFLINE
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-1 border-l border-[var(--border-active)] pl-4">
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={isPaused ? onResume : onPause}
              disabled={!isConnected}
              className="flex h-8 w-8 cursor-pointer items-center justify-center border border-[var(--border-active)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--text-primary)] hover:text-[var(--bg-card)] disabled:cursor-not-allowed disabled:opacity-30"
              aria-label={isPaused ? "Resume" : "Pause"}
              style={{ borderRadius: 0 }}
            >
              {isPaused ? <Play size={16} strokeWidth={2} /> : <Pause size={16} strokeWidth={2} />}
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
        </div>
      </div>

      <AnimatePresence>
        {isConnected && hasVerdicts && (
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
      <ListeningIndicator isConnected={isConnected} isPaused={isPaused} />
    </header>
  );
}
