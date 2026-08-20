import { afterEach, describe, expect, it, vi } from "vitest";
import type { SessionCard, SessionDetailResponse } from "@/types";
import {
  clearSessionCache,
  getCachedSession,
  getCachedSessionList,
  loadSession,
  loadSessionList,
  setCachedSession,
} from "./session-cache";

const sample = (id: string): SessionDetailResponse => ({
  id,
  context_preset: "podcast",
  context_detail: null,
  title: "Sample",
  blurb: "A blurb",
  started_at: "2026-01-01T00:00:00Z",
  ended_at: "2026-01-01T01:00:00Z",
  claims: [],
});

const sampleCard = (id: string): SessionCard => ({
  id,
  title: "Card",
  blurb: null,
  context_preset: "podcast",
  context_detail: null,
  started_at: "2026-01-01T00:00:00Z",
  ended_at: "2026-01-01T01:00:00Z",
  claim_count: 1,
  verdict_counts: { TRUE: 1, FALSE: 0, MISLEADING: 0, UNVERIFIED: 0 },
});

afterEach(() => {
  clearSessionCache();
  vi.unstubAllGlobals();
});

describe("session-cache", () => {
  it("returns a session previously stored in the cache", () => {
    setCachedSession(sample("abc"));
    expect(getCachedSession("abc")?.title).toBe("Sample");
  });

  it("loadSession hits the network once and serves later reads from cache", async () => {
    const body = sample("s1");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => body,
    });
    vi.stubGlobal("fetch", fetchMock);

    const first = await loadSession("s1", "token");
    const second = await loadSession("s1", "token");

    expect(first).toEqual(body);
    expect(second).toEqual(body);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("loadSessionList caches the board so a second read skips the network", async () => {
    const sessions = [sampleCard("c1")];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ sessions }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const first = await loadSessionList("token");
    const second = await loadSessionList("token");

    expect(first).toEqual(sessions);
    expect(second).toEqual(sessions);
    expect(getCachedSessionList()).toEqual(sessions);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
