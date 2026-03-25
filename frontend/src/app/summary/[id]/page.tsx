"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, Quote } from "lucide-react";
import Link from "next/link";
import type { SessionDetailResponse, Verdict } from "@/types";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

const VERDICT_CONFIG: Record<Verdict, { color: string; className: string; label: string }> = {
  TRUE:       { color: 'var(--accent-green)', className: 'verdict-true',       label: 'TRUE'        },
  FALSE:      { color: '#B91C1C',             className: 'verdict-false',      label: 'FALSE'       },
  MISLEADING: { color: 'var(--accent-amber)', className: 'verdict-misleading', label: 'MISLEADING'  },
  UNVERIFIED: { color: 'var(--accent-zinc)',  className: 'verdict-unverified', label: 'UNVERIFIED'  },
};

const PRESET_LABELS: Record<string, string> = {
  political: "Political Speech",
  news:      "News Broadcast",
  earnings:  "Earnings Call",
  podcast:   "Podcast / Talk",
};

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function SummaryPage() {
  const params  = useParams();
  const router  = useRouter();
  const sessionId = params.id as string;

  const [session, setSession]   = useState<SessionDetailResponse | null>(null);
  const [loading, setLoading]   = useState(true);
  const [copied,  setCopied]    = useState(false);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/session/${sessionId}`)
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then(setSession)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [sessionId]);

  const verdictCounts = useMemo(() => {
    const counts: Record<Verdict, number> = { TRUE: 0, FALSE: 0, MISLEADING: 0, UNVERIFIED: 0 };
    if (session) session.claims.forEach((c) => counts[c.verdict]++);
    return counts;
  }, [session]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--bg-primary)]">
        <motion.p
          initial={{ opacity: 0.4 }}
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="italic text-2xl font-[family:var(--font-display)] text-[var(--text-secondary)]"
        >
          Loading session…
        </motion.p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--bg-primary)] gap-4">
        <p className="text-xl font-[family:var(--font-display)] text-[var(--text-secondary)]">
          Session not found.
        </p>
        <Link
          href="/"
          className="underline uppercase tracking-widest text-xs font-[family:var(--font-mono)] text-[var(--accent-blue)]"
        >
          Return Home
        </Link>
      </div>
    );
  }

  const totalClaims  = session.claims.length;
  const presetLabel  = PRESET_LABELS[session.context_preset] || session.context_preset;

  return (
    <main className="min-h-screen text-[var(--text-primary)] py-16 px-6 md:px-12" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="mx-auto w-full max-w-[900px]">

        {/* ── Header ── */}
        <motion.header
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mb-12"
        >
          {/* eyebrow */}
          <div className="flex items-center gap-2 mb-4 text-[10px] uppercase tracking-[0.2em] font-[family:var(--font-mono)] text-[var(--text-secondary)]">
            <span>{presetLabel}</span>
            <span className="text-[var(--text-muted)]">•</span>
            <span>{totalClaims} {totalClaims === 1 ? "CLAIM" : "CLAIMS"}</span>
          </div>

          {/* title */}
          <h1 className="font-[family:var(--font-display)] text-[var(--text-primary)] leading-[0.95]" style={{ fontStyle: 'italic', fontSize: 'clamp(3.5rem, 10vw, 6rem)' }}>
            The Verdict
          </h1>

          {session.context_detail && (
            <p className="mt-4 text-base font-[family:var(--font-body)] text-[var(--text-secondary)]" style={{ fontStyle: 'italic' }}>
              {session.context_detail}
            </p>
          )}

          <div className="mt-6 h-[2px] w-full" style={{ background: 'linear-gradient(to right, var(--accent-red), var(--accent-gold))' }} />
        </motion.header>

        {/* ── Verdict Bar ── */}
        {totalClaims > 0 && (
          <section className="mb-16">
            <div className="flex h-4 w-full bg-[var(--bg-card)] overflow-hidden">
              {(Object.keys(VERDICT_CONFIG) as Verdict[]).map((v) => {
                const count = verdictCounts[v];
                if (count === 0) return null;
                return (
                  <motion.div
                    key={v}
                    initial={{ width: 0 }}
                    animate={{ width: `${(count / totalClaims) * 100}%` }}
                    transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                    className="h-full flex-shrink-0"
                    style={{ backgroundColor: VERDICT_CONFIG[v].color }}
                  />
                );
              })}
            </div>
            <div className="flex flex-wrap gap-6 mt-5">
              {(Object.keys(VERDICT_CONFIG) as Verdict[]).map((v) => {
                const count = verdictCounts[v];
                if (count === 0) return null;
                return (
                  <div key={v} className="flex flex-col gap-0.5" style={{ borderLeft: `3px solid ${VERDICT_CONFIG[v].color}`, paddingLeft: '12px' }}>
                    <span className="font-[family:var(--font-display)] leading-none" style={{ fontSize: '2rem', color: VERDICT_CONFIG[v].color }}>
                      {count}
                    </span>
                    <span className="font-[family:var(--font-mono)] uppercase tracking-widest text-[var(--text-muted)]" style={{ fontSize: '0.8rem' }}>
                      {v}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Claims ── */}
        <div className="flex flex-col gap-12 mb-20">
          <AnimatePresence>
            {session.claims.map((claim, index) => {
              const config = VERDICT_CONFIG[claim.verdict];
              return (
                <motion.article
                  key={claim.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex flex-col gap-6"
                >
                  <div className="flex gap-6 items-start">
                    <span className="text-2xl md:text-3xl font-[family:var(--font-display)] text-[var(--accent-gold)] opacity-30">
                      {(index + 1).toString().padStart(2, "0")}
                    </span>
                    <div className="flex-1">
                      <div
                        className="relative overflow-hidden"
                        style={{
                          backgroundColor: 'var(--bg-card)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 0,
                          padding: '28px 28px 28px 40px',
                          boxShadow: 'var(--card-shadow)',
                        }}
                      >
                        {/* Left accent bar */}
                        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px', backgroundColor: config.color }} />

                        <div className="flex flex-col gap-4" style={{ zIndex: 1 }}>
                          {/* Top: quote icon + timestamp */}
                          <div className="flex items-start justify-between">
                            <span className="pointer-events-none select-none" style={{ color: 'var(--accent-gold)', opacity: 0.4 }}>
                              <Quote size={32} strokeWidth={1.5} style={{ transform: 'scaleX(-1)' }} />
                            </span>
                            <time className="text-[10px] uppercase tracking-widest font-[family:var(--font-mono)] text-[var(--text-muted)]">
                              {formatTimestamp(claim.timestamp_seconds)}
                            </time>
                          </div>

                          <blockquote className="text-xl md:text-2xl italic leading-tight font-[family:var(--font-display)] text-[var(--text-primary)]">
                            &#x201C;{claim.claim_text}&#x201D;
                          </blockquote>

                          {claim.verdict_summary && (
                            <p className="text-sm leading-relaxed font-[family:var(--font-body)] text-[var(--text-secondary)]">
                              {claim.verdict_summary}
                            </p>
                          )}

                          {/* Bottom: source + verdict badge bottom-right */}
                          <div className="flex items-center justify-between gap-4">
                            {claim.source_url ? (
                              <a
                                href={claim.source_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] border-b border-transparent hover:border-current transition-colors font-[family:var(--font-mono)] text-[var(--accent-blue)]"
                              >
                                <ExternalLink size={14} strokeWidth={2} />
                                {claim.source_name || "Source"}
                              </a>
                            ) : <span />}
                            <div
                              className={`px-3 py-1.5 text-[0.8rem] font-bold tracking-widest uppercase inline-flex items-center font-[family:var(--font-mono)] ${config.className}`}
                              style={{ borderRadius: 0 }}
                            >
                              {config.label}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </AnimatePresence>
        </div>

        {/* ── Actions ── */}
        <footer className="grid grid-cols-2 gap-4">
          <motion.button
            onClick={handleCopyLink}
            whileHover={{ x: 6 }}
            whileTap={{ scale: 0.98 }}
            className="h-14 border border-[var(--border-active)] text-[var(--text-secondary)] uppercase tracking-widest text-xs font-[family:var(--font-mono)] cursor-pointer"
            style={{ borderRadius: 0 }}
          >
            {copied ? "COPIED" : "COPY LINK"}
          </motion.button>
          <motion.button
            onClick={() => router.push("/")}
            whileHover={{ x: 6 }}
            whileTap={{ scale: 0.98 }}
            className="h-14 bg-[var(--accent-red)] text-white uppercase tracking-[0.2em] text-sm font-bold font-[family:var(--font-display)] cursor-pointer"
            style={{ borderRadius: 0 }}
          >
            New Session
          </motion.button>
        </footer>
      </div>
    </main>
  );

  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
}
