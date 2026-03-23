"use client";

import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useGeminiLive } from "@/hooks/use-gemini-live";
import { useFactCheck } from "@/hooks/use-fact-check";
import { VerdictFeed } from "@/components/verdict-feed";
import { TopBar } from "@/components/top-bar";
import { ListeningIndicator } from "@/components/listening-indicator";
import type { ContextPreset, DetectedClaim, Verdict } from "@/types";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export default function SessionPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = params.id as string;
  const preset = (searchParams.get("preset") || "podcast") as ContextPreset;

  const [claims, setClaims] = useState<DetectedClaim[]>([]);
  const startedRef = useRef(false);

  const { verdicts, checkingIds, checkClaim } = useFactCheck({ sessionId, preset });

  const onClaim = useCallback(
    (claim: DetectedClaim) => {
      setClaims((prev) => [...prev, claim]);
      checkClaim(claim);
    },
    [checkClaim]
  );

  const { isConnected, isPaused, start, stop, pause, resume } = useGeminiLive({
    preset,
    onClaim,
  });

  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      start();
    }
  }, [start]);

  const handleStop = async () => {
    stop();
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
    <div
      className="flex flex-col px-4 pt-4 pb-2"
      style={{ height: "100dvh" }}
    >
      <div className="w-full mx-auto flex flex-col h-full" style={{ maxWidth: "512px" }}>
        <TopBar
          isConnected={isConnected}
          isPaused={isPaused}
          verdictCounts={verdictCounts}
          totalClaims={claims.length}
          onPause={pause}
          onResume={resume}
          onStop={handleStop}
        />
        <ListeningIndicator isConnected={isConnected} isPaused={isPaused} />
        <div className="flex-1 min-h-0 h-full">
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
