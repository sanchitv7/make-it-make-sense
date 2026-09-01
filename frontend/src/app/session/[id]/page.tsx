"use client";

import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLiveSession } from "@/hooks/use-live-session";
import { VerdictFeed } from "@/components/verdict-feed";
import { TopBar } from "@/components/top-bar";
import { SessionExitDialog } from "@/components/session-exit-dialog";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api";
import {
  anonymousSessionLoadAction,
  trialClockForLive,
  trialPreviewCue,
  trialRemainingSeconds,
  type TrialPreviewCue,
} from "@/lib/trial";
import type { LiveExitChoice } from "@/lib/live-exit";
import { markTrialVerdictAccess } from "@/lib/trial-verdict-access";
import type { ContextPreset, SessionDetailResponse } from "@/types";

export default function SessionPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { accessToken, loading: authLoading, user, isAnonymous, signOut } = useAuth();
  const sessionId = params.id as string;
  const preset = (searchParams.get("preset") || "podcast") as ContextPreset;
  const contextDetail = searchParams.get("context") || undefined;

  const [exitDialogOpen, setExitDialogOpen] = useState(false);
  const [loadedStartedAt, setLoadedStartedAt] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const startedRef = useRef(false);
  const endingRef = useRef(false);

  const finishToSummaryRef = useRef<() => void>(() => {});

  const live = useLiveSession({
    sessionId,
    preset,
    accessToken,
    speakerInfo: contextDetail,
    onTrialExpired: () => {
      finishToSummaryRef.current();
    },
  });

  const claimsRef = useRef(live.claims);
  claimsRef.current = live.claims;
  const stopRef = useRef(live.stop);
  stopRef.current = live.stop;

  const accessTokenRef = useRef(accessToken);
  useEffect(() => {
    accessTokenRef.current = accessToken;
  }, [accessToken]);

  const endSessionCleanup = useCallback(async () => {
    stopRef.current();
    await new Promise<void>((resolve) => {
      const poll = () => {
        if (!claimsRef.current.some((claim) => claim.phase === "checking")) return resolve();
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
    if (isAnonymous) markTrialVerdictAccess(sessionId);
    router.push(`/summary/${sessionId}`);
  }, [endSessionCleanup, isAnonymous, router, sessionId]);
  finishToSummaryRef.current = () => {
    void finishToSummary();
  };

  const startedAt = live.startedAt ?? loadedStartedAt;

  const connectRef = useRef(live.connect);
  connectRef.current = live.connect;

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/");
      return;
    }
    if (!accessToken || startedRef.current) return;
    startedRef.current = true;

    if (live.startedAt) {
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFetch(`/api/session/${sessionId}`, accessToken);
        if (!res.ok) throw new Error("Failed to load session");
        const session = (await res.json()) as SessionDetailResponse;
        if (cancelled) return;
        if (isAnonymous) {
          const action = anonymousSessionLoadAction({
            endedAt: session.ended_at,
            remainingSeconds: trialRemainingSeconds(session.started_at),
          });
          switch (action.kind) {
            case "home":
              router.replace("/");
              return;
            case "listen":
              setLoadedStartedAt(session.started_at);
              connectRef.current();
              return;
            default: {
              const _exhaustive: never = action;
              return _exhaustive;
            }
          }
        }
        if (session.ended_at) {
          router.replace(`/summary/${sessionId}`);
          return;
        }
        setLoadedStartedAt(session.started_at);
        connectRef.current();
      } catch {
        if (!cancelled) router.replace("/");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, accessToken, isAnonymous, sessionId, router, live.startedAt]);

  useEffect(() => {
    if (!isAnonymous || !startedAt) return;
    const tick = () => {
      const now = Date.now();
      setNowMs(now);
      if (trialRemainingSeconds(startedAt, now) <= 0) void finishToSummary();
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [isAnonymous, startedAt, finishToSummary]);

  const trialClock = trialClockForLive({ isAnonymous, startedAt });
  const trialCue: TrialPreviewCue = trialClock
    ? trialPreviewCue(trialClock.startedAt, nowMs)
    : { kind: "none" };

  const handleStop = async () => {
    await finishToSummary();
  };

  const handleTitleClick = () => {
    if (live.ready.status === "listening") {
      live.pause();
    }
    setExitDialogOpen(true);
  };

  const handleExitChoice = (choice: LiveExitChoice) => {
    switch (choice.kind) {
      case "see-the-verdict":
        setExitDialogOpen(false);
        void finishToSummary();
        return;
      case "keep-listening":
        setExitDialogOpen(false);
        void live.resume();
        return;
      default: {
        const _exhaustive: never = choice;
        return _exhaustive;
      }
    }
  };

  const handleSignOut = async () => {
    if (endingRef.current) return;
    endingRef.current = true;
    await endSessionCleanup();
    await signOut();
    router.replace("/");
  };

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
          ready={live.ready}
          claims={live.claims}
          trialCue={trialCue}
          onPause={live.pause}
          onResume={() => void live.resume()}
          onStop={() => void handleStop()}
          onSignOut={() => void handleSignOut()}
          onTitleClick={handleTitleClick}
        />
      </div>
      <SessionExitDialog open={exitDialogOpen} onChoice={handleExitChoice} />
      <div className="mx-auto w-full max-w-[900px] px-6 py-8 md:px-12">
        <div>
          <VerdictFeed claims={live.claims} ready={live.ready} />
        </div>
      </div>
    </div>
  );
}
