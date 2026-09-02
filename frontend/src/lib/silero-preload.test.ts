import { afterEach, describe, expect, it, vi } from "vitest";
import { preloadSileroAssets } from "@/lib/live-session";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("preloadSileroAssets", () => {
  it("fetches Silero ONNX and ORT WASM so Begin overlaps the heavy assets", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    });
    vi.stubGlobal("fetch", fetchMock);

    await preloadSileroAssets();

    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls.some((u) => u.includes("/vad/silero_vad_v5.onnx"))).toBe(true);
    expect(urls.some((u) => u.includes("/vad/ort-wasm-simd-threaded.wasm"))).toBe(true);
  });
});
