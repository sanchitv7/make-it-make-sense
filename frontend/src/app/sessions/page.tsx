"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { SiteHeader } from "@/components/site-header";
import { VerdictProportionBar } from "@/components/verdict-proportion-bar";
import { useAuth } from "@/components/auth-provider";
import { getCachedSessionList, loadSessionList, prefetchSession } from "@/lib/session-cache";
import { PRESET_LABELS } from "@/lib/verdict-config";
import type { SessionCard, Verdict } from "@/types";

function formatSessionDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function countsRecord(card: SessionCard): Record<Verdict, number> {
  return {
    TRUE: card.verdict_counts.TRUE,
    FALSE: card.verdict_counts.FALSE,
    MISLEADING: card.verdict_counts.MISLEADING,
    UNVERIFIED: card.verdict_counts.UNVERIFIED,
  };
}

export default function SessionsPage() {
  const { accessToken, loading: authLoading, user } = useAuth();
  const [sessions, setSessions] = useState<SessionCard[]>(() => getCachedSessionList() ?? []);
  const [listLoading, setListLoading] = useState(() => getCachedSessionList() === undefined);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !accessToken) {
      setSessions([]);
      setListLoading(false);
      return;
    }
    let cancelled = false;
    const hadCache = getCachedSessionList() !== undefined;
    if (!hadCache) setListLoading(true);
    loadSessionList(accessToken, { force: true })
      .then((data) => {
        if (!cancelled) setSessions(data);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setListLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, authLoading, user]);

  return (
    <>
      <SiteHeader />
      <main
        className="min-h-screen px-6 pt-32 pb-16 text-[var(--text-primary)] md:px-12"
        style={{ backgroundColor: "var(--bg-primary)" }}
      >
        <div className="mx-auto w-full max-w-[1100px]">
          <header className="mb-12">
            <h1
              className="font-[family:var(--font-display)] text-[var(--text-primary)] italic"
              style={{ fontSize: "clamp(2.5rem, 6vw, 4rem)" }}
            >
              Sessions
            </h1>
            <p className="mt-2 text-sm font-[family:var(--font-body)] text-[var(--text-secondary)]">
              Ended listening runs with claims
            </p>
          </header>

          {!authLoading && !user ? (
            <div className="flex flex-col items-start gap-4">
              <p className="text-lg font-[family:var(--font-display)] text-[var(--text-secondary)] italic">
                Sign in to view your sessions.
              </p>
              <Link
                href="/"
                className="text-xs font-[family:var(--font-mono)] tracking-widest text-[var(--accent-blue)] uppercase underline"
              >
                Return Home
              </Link>
            </div>
          ) : listLoading && sessions.length === 0 ? (
            <p className="text-sm font-[family:var(--font-body)] text-[var(--text-muted)]">
              Loading…
            </p>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-start gap-4">
              <p className="text-lg font-[family:var(--font-display)] text-[var(--text-secondary)] italic">
                No sessions yet
              </p>
              <Link
                href="/"
                className="inline-flex min-h-10 items-center border border-[var(--border-subtle)] px-4 text-xs font-[family:var(--font-mono)] tracking-widest text-[var(--text-primary)] uppercase hover:border-[var(--border-active)]"
              >
                Start a session
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {sessions.map((card, index) => {
                const presetLabel = PRESET_LABELS[card.context_preset] || card.context_preset;
                const heading = card.title?.trim() || presetLabel;
                return (
                  <motion.div
                    key={card.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05, duration: 0.4 }}
                  >
                    <Link
                      href={`/summary/${card.id}`}
                      onPointerEnter={() => {
                        if (accessToken) prefetchSession(card.id, accessToken);
                      }}
                      onFocus={() => {
                        if (accessToken) prefetchSession(card.id, accessToken);
                      }}
                      className="flex cursor-pointer flex-col gap-4 border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 text-left transition-colors hover:border-[var(--border-active)]"
                      style={{ borderRadius: 0, boxShadow: "var(--card-shadow)" }}
                    >
                      <div className="flex flex-col gap-1">
                        <time className="text-[10px] font-[family:var(--font-mono)] tracking-widest text-[var(--text-muted)] uppercase">
                          {formatSessionDate(card.started_at)}
                        </time>
                        <h2 className="text-xl leading-tight font-[family:var(--font-display)] text-[var(--text-primary)] italic">
                          {heading}
                        </h2>
                      </div>
                      {card.blurb && (
                        <p className="line-clamp-3 text-sm leading-relaxed font-[family:var(--font-body)] text-[var(--text-secondary)]">
                          {card.blurb}
                        </p>
                      )}
                      <VerdictProportionBar
                        counts={countsRecord(card)}
                        total={card.claim_count}
                        compact
                      />
                      <span className="text-[10px] font-[family:var(--font-mono)] tracking-widest text-[var(--text-muted)] uppercase">
                        {card.claim_count} {card.claim_count === 1 ? "claim" : "claims"} ·{" "}
                        {presetLabel}
                      </span>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
