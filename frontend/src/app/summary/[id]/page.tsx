"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { SessionDetailResponse, Verdict } from "@/types";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

const VERDICT_CONFIG: Record<
  Verdict,
  { icon: string; label: string; className: string }
> = {
  TRUE: { icon: "✅", label: "True", className: "verdict-true" },
  FALSE: { icon: "❌", label: "False", className: "verdict-false" },
  MISLEADING: {
    icon: "⚠️",
    label: "Misleading",
    className: "verdict-misleading",
  },
  UNVERIFIED: {
    icon: "🔍",
    label: "Unverified",
    className: "verdict-unverified",
  },
};

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function SummaryPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [session, setSession] = useState<SessionDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/session/${sessionId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load session");
        return res.json();
      })
      .then(setSession)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [sessionId]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100dvh" }} className="flex items-center justify-center">
        <p
          className="text-sm font-mono animate-pulse"
          style={{ color: "var(--text-muted)" }}
        >
          Loading session…
        </p>
      </div>
    );
  }

  if (!session) {
    return (
      <div style={{ minHeight: "100dvh" }} className="flex flex-col items-center justify-center gap-4">
        <p style={{ color: "var(--text-secondary)" }}>Session not found</p>
        <button
          onClick={() => router.push("/")}
          className="px-4 py-2 rounded-xl text-sm cursor-pointer"
          style={{
            background: "var(--bg-tertiary)",
            color: "var(--text-primary)",
          }}
        >
          Back to Home
        </button>
      </div>
    );
  }

  const verdictCounts: Record<Verdict, number> = {
    TRUE: 0,
    FALSE: 0,
    MISLEADING: 0,
    UNVERIFIED: 0,
  };
  for (const claim of session.claims) {
    verdictCounts[claim.verdict]++;
  }

  return (
    <div className="flex flex-col px-4 py-10" style={{ minHeight: "100dvh" }}>
      <div className="w-full mx-auto flex flex-col flex-1" style={{ maxWidth: "512px" }}>
        {/* Header */}
        <div className="mb-6">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono tracking-wider uppercase mb-4"
            style={{
              background: "rgba(113,113,122,0.1)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            Session Complete
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">
            Session Summary
          </h1>
          <p
            className="text-sm capitalize"
            style={{ color: "var(--text-secondary)" }}
          >
            {session.context_preset} &middot;{" "}
            {session.claims.length} claim
            {session.claims.length !== 1 ? "s" : ""} checked
          </p>
        </div>

        {/* Verdict breakdown */}
        {session.claims.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap mb-5">
            {(Object.keys(verdictCounts) as Verdict[]).map((v) =>
              verdictCounts[v] > 0 ? (
                <span
                  key={v}
                  className={`${VERDICT_CONFIG[v].className} text-xs px-3 py-1 rounded-lg border font-mono`}
                >
                  {verdictCounts[v]} {VERDICT_CONFIG[v].icon} {VERDICT_CONFIG[v].label}
                </span>
              ) : null
            )}
          </div>
        )}

        {/* Claims list */}
        <div className="flex flex-col gap-3 mb-8 flex-1">
          {session.claims.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center rounded-xl border p-10"
              style={{ background: "var(--bg-card)", borderColor: "var(--border-subtle)" }}
            >
              <p className="text-sm font-mono" style={{ color: "var(--text-muted)" }}>
                No claims were detected in this session.
              </p>
            </div>
          ) : (
            session.claims.map((claim) => {
              const config = VERDICT_CONFIG[claim.verdict];
              return (
                <div
                  key={claim.id}
                  className="rounded-xl border p-4"
                  style={{
                    background: "var(--bg-card)",
                    borderColor: "var(--border-subtle)",
                    position: "relative",
                    paddingLeft: "20px",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: "4px",
                      borderRadius: "12px 0 0 12px",
                    }}
                    className={config.className}
                  />
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border ${config.className}`}
                    >
                      {config.icon} {config.label}
                    </span>
                    <span
                      className="text-xs font-mono"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {formatTimestamp(claim.timestamp_seconds)}
                    </span>
                  </div>
                  <p className="text-sm font-medium mb-2 leading-relaxed">
                    &ldquo;{claim.claim_text}&rdquo;
                  </p>
                  {claim.verdict_summary && (
                    <p
                      className="text-xs leading-relaxed mb-2"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {claim.verdict_summary}
                    </p>
                  )}
                  {claim.source_url && (
                    <a
                      href={claim.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-mono hover:underline"
                      style={{ color: "var(--accent-blue)" }}
                    >
                      <span>↗</span>
                      {claim.source_name || "Source"}
                    </a>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleCopyLink}
            className="flex-1 flex items-center justify-center rounded-xl text-sm font-medium cursor-pointer transition-colors"
            style={{
              minHeight: "48px",
              background: "var(--bg-tertiary)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            {copied ? "Copied!" : "Copy Link"}
          </button>
          <button
            onClick={() => router.push("/")}
            className="flex-1 flex items-center justify-center rounded-xl text-sm font-medium cursor-pointer"
            style={{
              minHeight: "48px",
              background: "var(--accent-blue)",
              color: "#fff",
            }}
          >
            New Session
          </button>
        </div>
      </div>
    </div>
  );
}
