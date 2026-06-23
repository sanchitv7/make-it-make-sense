"use client";

import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useGeminiLive } from "@/hooks/use-gemini-live";
import { useFactCheck } from "@/hooks/use-fact-check";
import { VerdictFeed } from "@/components/verdict-feed";
import { TopBar } from "@/components/top-bar";
import type { ContextPreset, DetectedClaim, Verdict } from "@/types";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export default function SessionPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = params.id as string;
  const preset = (searchParams.get("preset") || "podcast") as ContextPreset;
  const contextDetail = searchParams.get("context") || undefined;

  const [claims, setClaims] = useState<DetectedClaim[]>([]);
  const startedRef = useRef(false);

  const { verdicts, checkingIds, hasRateLimit, checkClaim } = useFactCheck({ sessionId, preset, speakerInfo: contextDetail });

  const onClaim = useCallback(
    (claim: DetectedClaim) => {
      setClaims((prev) => [...prev, claim]);
      checkClaim(claim);
    },
    [checkClaim]
  );

  const { isConnected, isPaused, isReconnecting, connectionError, start, stop, pause, resume } = useGeminiLive({
    preset,
    sessionId,
    onClaim,
  });

  const [bannerDismissed, setBannerDismissed] = useState(false);
  useEffect(() => { if (!connectionError) setBannerDismissed(false); }, [connectionError]);

  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      start();
    }
  }, [start]);

  const checkingIdsRef = useRef(checkingIds);
  useEffect(() => { checkingIdsRef.current = checkingIds; }, [checkingIds]);

  const handleStop = async () => {
    stop();
    // Wait for all in-flight fact-checks to complete before navigating
    await new Promise<void>((resolve) => {
      const poll = () => {
        if (checkingIdsRef.current.size === 0) return resolve();
        setTimeout(poll, 200);
      };
      poll();
    });
    try {
      await fetch(`${BACKEND_URL}/api/session/${sessionId}`, { method: "PATCH" });
    } catch {
      // ignore
    }
    router.push(`/summary/${sessionId}`);
  };

  // Verdict counts for top bar
  const verdictCounts: Record<Verdict, number> = { TRUE: 0, FALSE: 0, MISLEADING: 0, UNVERIFIED: 0 };
  for (const v of verdicts) verdictCounts[v.verdict]++;

  return (
    <div className="min-h-dvh" style={{ backgroundColor: "var(--bg-primary)" }}>
      {connectionError && !bannerDismissed && (
        <div
          className="flex items-center justify-between px-4 py-2 font-[family:var(--font-mono)] text-xs uppercase tracking-widest sticky top-0 z-20"
          style={{ backgroundColor: 'rgba(251,191,36,0.15)', borderBottom: '1px solid rgba(251,191,36,0.4)', color: 'var(--accent-amber)' }}
        >
          <span>{connectionError}</span>
          <button
            onClick={() => setBannerDismissed(true)}
            aria-label="Dismiss"
            className="ml-4 opacity-70 hover:opacity-100 transition-opacity cursor-pointer"
            style={{ background: 'none', border: 'none', color: 'inherit' }}
          >
            ✕
          </button>
        </div>
      )}
      {hasRateLimit && (
        <div
          className="flex items-center px-4 py-1.5 font-[family:var(--font-mono)] text-xs uppercase tracking-widest sticky z-20"
          style={{ top: connectionError && !bannerDismissed ? '34px' : '0', backgroundColor: 'rgba(251,191,36,0.08)', borderBottom: '1px solid rgba(251,191,36,0.2)', color: 'var(--accent-amber)', opacity: 0.8 }}
        >
          Rate limit reached — some claims marked unverified without checking
        </div>
      )}
      <div className="sticky top-0 z-10">
        <TopBar
          isConnected={isConnected}
          isPaused={isPaused}
          isReconnecting={isReconnecting}
          verdictCounts={verdictCounts}
          totalClaims={claims.length}
          onPause={pause}
          onResume={resume}
          onStop={handleStop}
        />
      </div>
      <div className="w-full mx-auto px-6 md:px-12 py-8 max-w-[900px]">
        <div>
          <VerdictFeed
            claims={claims}
            verdicts={verdicts}
            checkingIds={checkingIds}
          />
        </div>
      </div>
    </div>
  );
}
