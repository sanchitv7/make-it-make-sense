"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import type { DetectedClaim, ContextPreset } from "@/types";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
const RECONNECT_BEFORE_MS = 13.5 * 60 * 1000;

export type TranscriptSegment =
  | { type: "text"; id: string; text: string }
  | { type: "claim"; id: string; claimId: string; text: string };

interface UseGeminiLiveOptions {
  preset: ContextPreset;
  sessionId: string;
  onClaim: (claim: DetectedClaim) => void;
}

export function useGeminiLive({
  preset,
  sessionId,
  onClaim,
}: UseGeminiLiveOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stoppedRef = useRef(true);
  const presetRef = useRef(preset);
  const sessionIdRef = useRef(sessionId);
  const onClaimRef = useRef(onClaim);
  // ID of the current "open" text segment being streamed into
  const currentTextSegIdRef = useRef<string | null>(null);

  useEffect(() => { presetRef.current = preset; }, [preset]);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
  useEffect(() => { onClaimRef.current = onClaim; }, [onClaim]);

  function teardownAudio() {
    workletRef.current?.disconnect();
    workletRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
  }

  /** Append text to the current open text segment, or create one. */
  function appendText(text: string) {
    if (!text) return;
    setSegments((prev) => {
      const last = prev[prev.length - 1];
      if (last?.type === "text" && last.id === currentTextSegIdRef.current) {
        // Extend the last text segment
        return [
          ...prev.slice(0, -1),
          { ...last, text: last.text + text },
        ];
      }
      // Start a new text segment
      const id = uuidv4();
      currentTextSegIdRef.current = id;
      return [...prev, { type: "text", id, text }];
    });
  }

  /** On a turn boundary, close the current segment so the next text starts fresh. */
  function closeTurn() {
    currentTextSegIdRef.current = null;
  }

  /**
   * When a claim fires, convert the most recent text segment into a claim segment.
   * If nothing has been transcribed yet, add a claim segment with the claim_text.
   */
  function tagLastSegmentAsClaim(claimId: string, claimText: string) {
    currentTextSegIdRef.current = null; // next text starts a new segment
    setSegments((prev) => {
      if (prev.length === 0) {
        return [{ type: "claim", id: uuidv4(), claimId, text: claimText }];
      }
      const last = prev[prev.length - 1];
      if (last.type === "text") {
        // Replace the last text segment with a claim segment
        return [
          ...prev.slice(0, -1),
          { type: "claim", id: last.id, claimId, text: last.text || claimText },
        ];
      }
      // Already a claim — append a new claim segment
      return [...prev, { type: "claim", id: uuidv4(), claimId, text: claimText }];
    });
  }

  async function startAudio(ws: WebSocket) {
    console.log("[Live] Starting audio");
    const audioCtx = new AudioContext({ sampleRate: 16000 });
    audioCtxRef.current = audioCtx;

    const source = audioCtx.createMediaStreamSource(mediaStreamRef.current!);

    const workletCode = `
      class PCMProcessor extends AudioWorkletProcessor {
        _buf = new Int16Array(2048);
        _i = 0;
        process(inputs) {
          const ch = inputs[0]?.[0];
          if (!ch) return true;
          for (let s = 0; s < ch.length; s++) {
            this._buf[this._i++] = Math.max(-32768, Math.min(32767, ch[s] * 32768));
            if (this._i >= this._buf.length) {
              this.port.postMessage(this._buf.buffer.slice(0, this._i * 2));
              this._i = 0;
            }
          }
          return true;
        }
      }
      registerProcessor('pcm-proc', PCMProcessor);
    `;
    const blobUrl = URL.createObjectURL(new Blob([workletCode], { type: "application/javascript" }));
    await audioCtx.audioWorklet.addModule(blobUrl);
    URL.revokeObjectURL(blobUrl);

    const node = new AudioWorkletNode(audioCtx, "pcm-proc");
    workletRef.current = node;

    node.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ type: "audio", data: bufToBase64(e.data) }));
    };

    source.connect(node);
    node.connect(audioCtx.destination);
    console.log("[Live] Audio streaming started");
  }

  async function doConnect() {
    console.log("[Live] doConnect, stopped=", stoppedRef.current);
    if (stoppedRef.current) return;

    try {
      if (!mediaStreamRef.current) {
        mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: { sampleRate: 16000, channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        });
        console.log("[Live] Mic acquired");
      }

      if (stoppedRef.current) return;

      let wsUrl: string;
      try {
        const tokenRes = await fetch(`${BACKEND_URL}/api/token?preset=${presetRef.current}&session_id=${encodeURIComponent(sessionIdRef.current)}`);
        if (!tokenRes.ok) throw new Error(`Token fetch failed: ${tokenRes.status}`);
        const { token } = await tokenRes.json() as { token: string };
        wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${token}`;
        console.log("[Live] Using direct Gemini connection via ephemeral token");
      } catch (err) {
        console.warn("[Live] Token fetch failed, falling back to proxy:", err);
        const wsBase = BACKEND_URL.replace(/^http/, "ws");
        wsUrl = `${wsBase}/ws/live?preset=${presetRef.current}`;
      }
      console.log("[Live] Connecting to:", wsUrl.slice(0, 80));

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => console.log("[Live] WS open");

      ws.onmessage = async (event) => {
        let msg: Record<string, unknown>;
        try { msg = JSON.parse(event.data); } catch { return; }

        const keys = Object.keys(msg);
        if (keys.length) console.log("[Live] ←", keys[0], JSON.stringify(msg).slice(0, 120));

        if ("setupComplete" in msg) {
          console.log("[Live] Setup complete — starting audio");
          setIsConnected(true);
          setConnectionError(null);
          setIsReconnecting(false);
          await startAudio(ws);
          return;
        }

        const sc = msg.serverContent as Record<string, unknown> | undefined;
        if (sc) {
          const it = (sc.inputTranscription as { text?: string } | undefined)?.text;
          if (it) {
            console.log("[Live] transcript chunk:", JSON.stringify(it));
            appendText(it);
          }
          if (sc.turnComplete) {
            closeTurn();
          }
        }

        const tc = msg.toolCall as {
          functionCalls?: { id: string; name: string; args: Record<string, unknown> }[]
        } | undefined;
        if (tc?.functionCalls) {
          for (const call of tc.functionCalls) {
            if (call.name === "report_claim") {
              const claimText = call.args.claim_text as string;
              const claimId = uuidv4();
              console.log("[Live] claim:", claimText);
              tagLastSegmentAsClaim(claimId, claimText);
              onClaimRef.current({
                id: claimId,
                claim_text: claimText,
                timestamp_seconds: (call.args.timestamp_seconds as number) || 0,
                context: (call.args.context as string) || undefined,
              });
              ws.send(JSON.stringify({
                type: "tool_response",
                functionResponses: [{ id: call.id, name: call.name, response: { status: "ok" } }],
              }));
            }
          }
        }
      };

      ws.onerror = (e) => {
        console.error("[Live] WS error", e);
        setConnectionError("Connection error — retrying…");
      };

      ws.onclose = (e) => {
        console.log("[Live] WS closed", e.code, e.reason);
        teardownAudio();
        setIsConnected(false);
        if (!stoppedRef.current) {
          setIsReconnecting(true);
          setConnectionError(null);
          console.log("[Live] Reconnecting in 2s");
          setTimeout(doConnect, 2000);
        } else {
          setIsReconnecting(false);
        }
      };

      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = setTimeout(() => {
        if (!stoppedRef.current) {
          console.log("[Live] Proactive reconnect");
          ws.close();
        }
      }, RECONNECT_BEFORE_MS);

    } catch (err) {
      console.error("[Live] connect error:", err);
      setIsConnected(false);
      if (!stoppedRef.current) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setConnectionError(
          msg.includes("Permission denied") || msg.includes("NotAllowedError")
            ? "Microphone access denied — please allow mic access and refresh."
            : `Connection failed: ${msg}. Retrying…`
        );
        setIsReconnecting(true);
        setTimeout(doConnect, 3000);
      }
    }
  }

  const [isPaused, setIsPaused] = useState(false);

  const pause = useCallback(() => {
    // Stop mic tracks so the browser releases the mic indicator
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    teardownAudio();
    setIsPaused(true);
  }, []);

  const resume = useCallback(async () => {
    if (!isPaused) return;
    try {
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        await startAudio(wsRef.current);
      }
      setIsPaused(false);
    } catch (err) {
      console.error("[Live] resume mic error:", err);
    }
  }, [isPaused]);

  const start = useCallback(async () => {
    stoppedRef.current = false;
    setSegments([]);
    currentTextSegIdRef.current = null;
    setIsConnected(false);
    setIsPaused(false);
    await doConnect();
  }, []);

  const stop = useCallback(() => {
    setIsPaused(false);
    setIsReconnecting(false);
    setConnectionError(null);
    stoppedRef.current = true;
    if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "stop" }));
    }
    wsRef.current?.close();
    wsRef.current = null;
    teardownAudio();
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    setIsConnected(false);
  }, []);

  useEffect(() => () => { stoppedRef.current = true; stop(); }, [stop]);

  return { isConnected, isPaused, isReconnecting, connectionError, segments, start, stop, pause, resume };
}

function bufToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
