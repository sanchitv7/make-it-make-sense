import { apiFetch } from "@/lib/api";
import type { SessionCard, SessionDetailResponse, SessionListResponse } from "@/types";

const cache = new Map<string, SessionDetailResponse>();
const inflight = new Map<string, Promise<SessionDetailResponse>>();

let listCache: SessionCard[] | undefined;
let listInflight: Promise<SessionCard[]> | undefined;

export function getCachedSession(sessionId: string): SessionDetailResponse | undefined {
  return cache.get(sessionId);
}

export function setCachedSession(session: SessionDetailResponse): void {
  cache.set(session.id, session);
}

export function getCachedSessionList(): SessionCard[] | undefined {
  return listCache;
}

export function clearSessionCache(): void {
  cache.clear();
  inflight.clear();
  listCache = undefined;
  listInflight = undefined;
}

/** Fetch session detail; dedupe concurrent requests and cache the result. */
export async function loadSession(
  sessionId: string,
  accessToken: string,
): Promise<SessionDetailResponse> {
  const cached = cache.get(sessionId);
  if (cached) return cached;

  const pending = inflight.get(sessionId);
  if (pending) return pending;

  const request = apiFetch(`/api/session/${sessionId}`, accessToken)
    .then(async (res) => {
      if (!res.ok) throw new Error(`Failed to load session ${sessionId}`);
      return res.json() as Promise<SessionDetailResponse>;
    })
    .then((data) => {
      cache.set(sessionId, data);
      return data;
    })
    .finally(() => {
      inflight.delete(sessionId);
    });

  inflight.set(sessionId, request);
  return request;
}

/** Fire-and-forget warm of the cache (e.g. card hover). */
export function prefetchSession(sessionId: string, accessToken: string): void {
  void loadSession(sessionId, accessToken).catch(() => {
    // Prefetch is best-effort
  });
}

/** Fetch the sessions board; dedupe concurrent requests and cache the result. */
export async function loadSessionList(
  accessToken: string,
  opts?: { force?: boolean },
): Promise<SessionCard[]> {
  if (!opts?.force && listCache) return listCache;
  if (listInflight) return listInflight;

  listInflight = apiFetch("/api/sessions", accessToken)
    .then(async (res) => {
      if (!res.ok) throw new Error("Failed to load sessions");
      return res.json() as Promise<SessionListResponse>;
    })
    .then((data) => {
      listCache = data.sessions;
      return data.sessions;
    })
    .finally(() => {
      listInflight = undefined;
    });

  return listInflight;
}

/** Fire-and-forget warm of the sessions board (e.g. header hover). */
export function prefetchSessionList(accessToken: string): void {
  void loadSessionList(accessToken).catch(() => {
    // Prefetch is best-effort
  });
}
