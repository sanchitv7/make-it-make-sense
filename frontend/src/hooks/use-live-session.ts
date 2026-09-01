"use client";

import { useCallback, useRef, useSyncExternalStore } from "react";
import type { ContextPreset } from "@/types";
import type { Claim, ListenReady } from "@/types/claim";
import { ListenPreflight } from "@/lib/listen-preflight";
import { LiveSession } from "@/lib/live-session";

export type UseLiveSessionArgs = {
  sessionId: string;
  preset: ContextPreset;
  accessToken: string | null;
  speakerInfo?: string;
  onTrialExpired?: () => void;
};

export type LiveSessionApi = {
  ready: ListenReady;
  claims: Claim[];
  startedAt: string | null;
  connect: () => void;
  stop: () => void;
  pause: () => void;
  resume: () => Promise<void>;
};

const emptySnapshot = { ready: { status: "offline" } as ListenReady, claims: [] as Claim[] };

function createOrAdopt(args: UseLiveSessionArgs): LiveSession | null {
  const adopted = ListenPreflight.adopt(args.sessionId);
  if (adopted) {
    adopted.attach({
      accessToken: args.accessToken ?? undefined,
      speakerInfo: args.speakerInfo,
      onTrialExpired: args.onTrialExpired,
    });
    return adopted;
  }
  if (!args.accessToken) return null;
  return new LiveSession({
    sessionId: args.sessionId,
    preset: args.preset,
    accessToken: args.accessToken,
    speakerInfo: args.speakerInfo,
    onTrialExpired: args.onTrialExpired,
  });
}

export function useLiveSession(args: UseLiveSessionArgs): LiveSessionApi {
  const pipeRef = useRef<LiveSession | null>(null);
  if (!pipeRef.current) {
    pipeRef.current = createOrAdopt(args);
  }
  pipeRef.current?.attach({
    accessToken: args.accessToken ?? undefined,
    speakerInfo: args.speakerInfo,
    onTrialExpired: args.onTrialExpired,
  });

  const pipe = pipeRef.current;

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!pipe) return () => {};
      return pipe.subscribe(onStoreChange);
    },
    [pipe],
  );

  const snapshot = useSyncExternalStore(
    subscribe,
    () => pipe?.getSnapshot() ?? emptySnapshot,
    () => emptySnapshot,
  );

  const connect = useCallback(() => {
    if (!pipeRef.current) {
      pipeRef.current = createOrAdopt(args);
    }
    pipeRef.current?.connect();
  }, [args]);

  const stop = useCallback(() => {
    pipeRef.current?.stop();
  }, []);

  const pause = useCallback(() => {
    pipeRef.current?.pause();
  }, []);

  const resume = useCallback(async () => {
    await pipeRef.current?.resume();
  }, []);

  return {
    ready: snapshot.ready,
    claims: snapshot.claims,
    startedAt: pipeRef.current?.startedAt ?? null,
    connect,
    stop,
    pause,
    resume,
  };
}
