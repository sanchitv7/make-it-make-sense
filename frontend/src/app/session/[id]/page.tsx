"use client";

import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useGeminiLive } from "@/hooks/use-gemini-live";
import { useFactCheck } from "@/hooks/use-fact-check";
import { VerdictFeed } from "@/components/verdict-feed";
import { TopBar } from "@/components/top-bar";
import { SessionExitDialog } from "@/components/session-exit-dialog";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api";
import { trialRemainingSeconds } from "@/lib/trial";
import { markTrialVerdictAccess } from "@/lib/trial-verdict-access";
import type { ContextPreset, DetectedClaim, SessionDetailResponse, Verdict } from "@/types";

export default function SessionPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { accessToken, loading: authLoading, user, isAnonymous, signOut } = useAuth();
  const sessionId = params.id as string;
  const preset = (searchParams.get("preset") || "podcast") as ContextPreset;
  const contextDetail = searchParams.get("context") || undefined;

  const [claims, setClaims] = useState<DetectedClaim[]>([]);
  const [exitDialogOpen, setExitDialogOpen] = useState(false);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const startedRef = useRef(false);
  const endingRef = useRef(false);
  const stopRef = useRef<() => void>(() => {});

  const { verdicts, checkingIds, checkClaim } = useFactCheck({
    sessionId,
    preset,
    speakerInfo: contextDetail,
    accessToken,
  });

  const onClaim = useCallback(
    (claim: DetectedClaim) => {
      setClaims((prev) => [...prev, claim]);
      checkClaim(claim);
    },
    [checkClaim],
  );

  const checkingIdsRef = useRef(checkingIds);
  useEffect(() => {
    checkingIdsRef.current = checkingIds;
  }, [checkingIds]);

  const accessTokenRef = useRef(accessToken);
  useEffect(() => {
    accessTokenRef.current = accessToken;
  }, [accessToken]);

  const endSessionCleanup = useCallback(async () => {
    stopRef.current();
    await new Promise<void>((resolve) => {
      const poll = () => {
        if (checkingIdsRef.current.size === 0) return resolve();
        setTimeout(poll, 200);
      };
      poll();
    });
    const token = accessTokenRef.current;
    if (token) {
      try {
        await apiFetch(`/api/session/${sessionId}`, token, { method: "PATCH" });
      } catch {
        // ignore
      }
    }
  }, [sessionId]);

  const finishToSummary = useCallback(async () => {
    if (endingRef.current) return;
    endingRef.current = true;
    await endSessionCleanup();
    // One-time pass: anonymous visitors may see this Verdict now, not on a later return.
    if (isAnonymous) markTrialVerdictAccess(sessionId);
    router.push(`/summary/${sessionId}`);
  }, [endSessionCleanup, isAnonymous, router, sessionId]);

  const { isConnected, isPaused, start, stop, pause, resume } = useGeminiLive({
    preset,
    onClaim,
    accessToken,
    sessionId,
    onTrialExpired: () => {
      void finishToSummary();
    },
  });
  stopRef.current = stop;

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/");
      return;
    }
    if (!accessToken || startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFetch(`/api/session/${sessionId}`, accessToken);
        if (!res.ok) throw new Error("Failed to load session");
        const session = (await res.json()) as SessionDetailResponse;
        if (cancelled) return;
        setStartedAt(session.started_at);
        if (session.ended_at) {
          // Anonymous Accounts do not freeload an ended trial Verdict on revisit.
          router.replace(isAnonymous ? "/" : `/summary/${sessionId}`);
          return;
        }
        if (isAnonymous && trialRemainingSeconds(session.started_at) <= 0) {
          await finishToSummary();
          return;
        }
        start();
      } catch {
        if (!cancelled) router.replace("/");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, accessToken, isAnonymous, sessionId, start, router, finishToSummary]);

  useEffect(() => {
    if (!isAnonymous || !startedAt) return;
    const tick = () => {
      if (trialRemainingSeconds(startedAt) <= 0) void finishToSummary();
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [isAnonymous, startedAt, finishToSummary]);

  const handleStop = async () => {
    await finishToSummary();
  };

  const handleGoHome = async () => {
    if (endingRef.current) return;
    endingRef.current = true;
    setExitDialogOpen(false);
    await endSessionCleanup();
    router.push("/");
  };

  const handleTitleClick = () => {
    if (isConnected && !isPaused) {
      pause();
    }
    setExitDialogOpen(true);
  };

  const handleSignOut = async () => {
    if (endingRef.current) return;
    endingRef.current = true;
    await endSessionCleanup();
    await signOut();
    router.replace("/");
  };

  const verdictCounts: Record<Verdict, number> = {
    TRUE: 0,
    FALSE: 0,
    MISLEADING: 0,
    UNVERIFIED: 0,
  };
  for (const v of verdicts) verdictCounts[v.verdict]++;

  if (authLoading || !user) {
    return (
      <div
        className="flex min-h-dvh items-center justify-center"
        style={{ backgroundColor: "var(--bg-primary)" }}
      >
        <p className="font-[family:var(--font-display)] text-[var(--text-secondary)] italic">
          {authLoading ? "Loading…" : "Redirecting…"}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh" style={{ backgroundColor: "var(--bg-primary)" }}>
      <div className="sticky top-0 z-10">
        <TopBar
          isConnected={isConnected}
          isPaused={isPaused}
          verdictCounts={verdictCounts}
          totalClaims={claims.length}
          onPause={pause}
          onResume={resume}
          onStop={() => void handleStop()}
          onSignOut={() => void handleSignOut()}
          onTitleClick={handleTitleClick}
        />
      </div>
      <SessionExitDialog
        open={exitDialogOpen}
        onClose={() => setExitDialogOpen(false)}
        onEndAndGoHome={() => void handleGoHome()}
        onResume={resume}
      />
      <div className="mx-auto w-full max-w-[900px] px-6 py-8 md:px-12">
        <div>
          <VerdictFeed claims={claims} verdicts={verdicts} checkingIds={checkingIds} />
        </div>
      </div>
    </div>
  );
}
