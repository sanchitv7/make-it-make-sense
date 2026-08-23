"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, Quote } from "lucide-react";
import Link from "next/link";
import type { SessionDetailResponse, Verdict } from "@/types";
import { useAuth } from "@/components/auth-provider";
import { SiteHeader } from "@/components/site-header";
import { VerdictProportionBar } from "@/components/verdict-proportion-bar";
import { apiFetch } from "@/lib/api";
import { getCachedSession, loadSession, setCachedSession } from "@/lib/session-cache";
import { PRESET_LABELS, VERDICT_CONFIG } from "@/lib/verdict-config";

const BLURB_POLL_MS = 1500;
const BLURB_POLL_MAX_MS = 15000;

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function SummaryPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;
  const { accessToken, loading: authLoading, user } = useAuth();

  const [session, setSession] = useState<SessionDetailResponse | null>(
    () => getCachedSession(sessionId) ?? null,
  );
  const [loadError, setLoadError] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const cached = getCachedSession(sessionId);
    if (cached) setSession(cached);
  }, [sessionId]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !accessToken) {
      setSession(null);
      setLoadError(false);
      return;
    }
    let cancelled = false;
    setLoadError(false);
    loadSession(sessionId, accessToken)
      .then((data) => {
        if (!cancelled) setSession(data);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, accessToken, authLoading, user]);

  const needsBlurb = Boolean(session && (!session.title?.trim() || !session.blurb?.trim()));

  useEffect(() => {
    if (!needsBlurb || !accessToken || !user) return;

    const startedAt = Date.now();
    const id = window.setInterval(() => {
      if (Date.now() - startedAt >= BLURB_POLL_MAX_MS) {
        window.clearInterval(id);
        return;
      }
      void apiFetch(`/api/session/${sessionId}`, accessToken)
        .then((res) => {
          if (!res.ok) throw new Error();
          return res.json() as Promise<SessionDetailResponse>;
        })
        .then((data) => {
          setCachedSession(data);
          setSession(data);
          if (data.title?.trim() && data.blurb?.trim()) {
            window.clearInterval(id);
          }
        })
        .catch(console.error);
    }, BLURB_POLL_MS);

    return () => window.clearInterval(id);
  }, [needsBlurb, accessToken, user, sessionId]);

  const verdictCounts = useMemo(() => {
    const counts: Record<Verdict, number> = { TRUE: 0, FALSE: 0, MISLEADING: 0, UNVERIFIED: 0 };
    if (session) session.claims.forEach((c) => counts[c.verdict]++);
    return counts;
  }, [session]);

  const waitingForAuth = authLoading;
  const signedOut = !authLoading && !user;
  const notFound = !authLoading && !!user && loadError && !session;
  const showContent = !!session;

  const totalClaims = session?.claims.length ?? 0;
  const presetLabel = session
    ? PRESET_LABELS[session.context_preset] || session.context_preset
    : null;
  const showBlurbBlock = Boolean(session?.title?.trim() || session?.blurb?.trim());

  return (
    <>
      <SiteHeader />
      <main
        className="min-h-screen px-6 pt-32 pb-16 text-[var(--text-primary)] md:px-12"
        style={{ backgroundColor: "var(--bg-primary)" }}
      >
        <div className="mx-auto w-full max-w-[900px]">
          {signedOut || notFound ? (
            <div className="flex flex-col items-start gap-4">
              <p className="text-xl font-[family:var(--font-display)] text-[var(--text-secondary)]">
                {signedOut ? "Sign in to view this session." : "Session not found."}
              </p>
              <Link
                href={signedOut ? "/" : "/sessions"}
                className="text-xs font-[family:var(--font-mono)] tracking-widest text-[var(--accent-blue)] uppercase underline"
              >
                {signedOut ? "Return Home" : "Back to Sessions"}
              </Link>
            </div>
          ) : (
            <>
              <motion.header
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="mb-12"
              >
                <div className="mb-4 flex items-center gap-2 text-[10px] font-[family:var(--font-mono)] tracking-[0.2em] text-[var(--text-secondary)] uppercase">
                  {presetLabel ? (
                    <>
                      <span>{presetLabel}</span>
                      <span className="text-[var(--text-muted)]">•</span>
                      <span>
                        {totalClaims} {totalClaims === 1 ? "CLAIM" : "CLAIMS"}
                      </span>
                    </>
                  ) : (
                    <span className="text-[var(--text-muted)]">
                      {waitingForAuth ? "…" : "Loading claims…"}
                    </span>
                  )}
                </div>

                <h1
                  className="leading-[0.95] font-[family:var(--font-display)] text-[var(--text-primary)]"
                  style={{ fontStyle: "italic", fontSize: "clamp(3.5rem, 10vw, 6rem)" }}
                >
                  The Verdict
                </h1>

                <div
                  className="mt-6 h-[2px] w-full"
                  style={{
                    background: "linear-gradient(to right, var(--accent-red), var(--accent-gold))",
                  }}
                />
              </motion.header>

              {showContent && (
                <>
                  <AnimatePresence>
                    {showBlurbBlock && (
                      <motion.div
                        key="session-blurb"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                        className="mb-10"
                      >
                        {session.title?.trim() && (
                          <h2 className="text-2xl font-[family:var(--font-display)] text-[var(--text-primary)] italic md:text-3xl">
                            {session.title.trim()}
                          </h2>
                        )}
                        {session.blurb?.trim() && (
                          <p className="mt-3 max-w-2xl text-base leading-relaxed font-[family:var(--font-body)] text-[var(--text-secondary)]">
                            {session.blurb.trim()}
                          </p>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {totalClaims > 0 && (
                    <section className="mb-16">
                      <VerdictProportionBar counts={verdictCounts} total={totalClaims} />
                    </section>
                  )}

                  <div className="mb-20 flex flex-col gap-12">
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
                            <div className="flex items-start gap-6">
                              <span className="text-2xl font-[family:var(--font-display)] text-[var(--accent-gold)] opacity-30 md:text-3xl">
                                {(index + 1).toString().padStart(2, "0")}
                              </span>
                              <div className="flex-1">
                                <div
                                  className="relative overflow-hidden"
                                  style={{
                                    backgroundColor: "var(--bg-card)",
                                    border: "1px solid var(--border-subtle)",
                                    borderRadius: 0,
                                    padding: "28px 28px 28px 40px",
                                    boxShadow: "var(--card-shadow)",
                                  }}
                                >
                                  <div
                                    style={{
                                      position: "absolute",
                                      left: 0,
                                      top: 0,
                                      bottom: 0,
                                      width: "3px",
                                      backgroundColor: config.color,
                                    }}
                                  />

                                  <div className="flex flex-col gap-4" style={{ zIndex: 1 }}>
                                    <div className="flex items-start justify-between">
                                      <span
                                        className="pointer-events-none select-none"
                                        style={{ color: "var(--accent-gold)", opacity: 0.4 }}
                                      >
                                        <Quote
                                          size={32}
                                          strokeWidth={1.5}
                                          style={{ transform: "scaleX(-1)" }}
                                        />
                                      </span>
                                      <time className="text-[10px] font-[family:var(--font-mono)] tracking-widest text-[var(--text-muted)] uppercase">
                                        {formatTimestamp(claim.timestamp_seconds)}
                                      </time>
                                    </div>

                                    <blockquote className="text-xl leading-tight font-[family:var(--font-display)] text-[var(--text-primary)] italic md:text-2xl">
                                      &#x201C;{claim.claim_text}&#x201D;
                                    </blockquote>

                                    {claim.verdict_summary && (
                                      <p className="text-sm leading-relaxed font-[family:var(--font-body)] text-[var(--text-secondary)]">
                                        {claim.verdict_summary}
                                      </p>
                                    )}

                                    <div className="flex items-center justify-between gap-4">
                                      {claim.source_url ? (
                                        <a
                                          href={claim.source_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1.5 text-[10px] font-[family:var(--font-mono)] tracking-[0.15em] text-[var(--accent-blue)] uppercase underline-offset-2 transition-colors hover:underline"
                                        >
                                          <ExternalLink size={14} strokeWidth={2} />
                                          {claim.source_name || "Source"}
                                        </a>
                                      ) : (
                                        <span />
                                      )}
                                      <div
                                        className={`inline-flex items-center px-3 py-1.5 font-[family:var(--font-mono)] font-bold uppercase ${config.className}`}
                                        style={{
                                          borderRadius: 0,
                                          fontSize: "0.8rem",
                                          letterSpacing: "0.15em",
                                        }}
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

                  <footer className="grid grid-cols-2 gap-4">
                    <motion.button
                      onClick={handleCopyLink}
                      whileHover={{ x: 6 }}
                      whileTap={{ scale: 0.98 }}
                      className="h-14 cursor-pointer border border-[var(--border-active)] text-xs font-[family:var(--font-mono)] tracking-widest text-[var(--text-secondary)] uppercase"
                      style={{ borderRadius: 0 }}
                    >
                      {copied ? "COPIED" : "COPY LINK"}
                    </motion.button>
                    <motion.button
                      onClick={() => router.push("/")}
                      whileHover={{ x: 6 }}
                      whileTap={{ scale: 0.98 }}
                      className="h-14 cursor-pointer bg-[var(--accent-red)] text-xs font-[family:var(--font-mono)] tracking-widest text-white uppercase"
                      style={{ borderRadius: 0 }}
                    >
                      NEW SESSION
                    </motion.button>
                  </footer>
                </>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );

  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
}
