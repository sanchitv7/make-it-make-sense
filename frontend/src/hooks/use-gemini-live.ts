"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import type { DetectedClaim, ContextPreset } from "@/types";
import { backendUrl } from "@/lib/api";
import { createSileroVad, type SileroVadEvent, type SileroVadHandle } from "@/lib/silero-vad";

const RECONNECT_BEFORE_MS = 13.5 * 60 * 1000;
const PCM_CHUNK_SAMPLES = 1024;

/** Far-field / speaker pickup: preserve quiet dialogue, boost levels. */
const MIC_CONSTRAINTS: MediaTrackConstraints = {
  sampleRate: 16000,
  channelCount: 1,
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: true,
};

export type TranscriptSegment =
  | { type: "text"; id: string; text: string }
  | { type: "claim"; id: string; claimId: string; text: string };

interface UseGeminiLiveOptions {
  preset: ContextPreset;
  onClaim: (claim: DetectedClaim) => void;
  accessToken: string | null;
}

export function useGeminiLive({ preset, onClaim, accessToken }: UseGeminiLiveOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const sileroVadRef = useRef<SileroVadHandle | null>(null);
  const streamingRef = useRef(false);
  const turnOpenRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stoppedRef = useRef(true);
  const presetRef = useRef(preset);
  const onClaimRef = useRef(onClaim);
  const accessTokenRef = useRef(accessToken);
  // ID of the current "open" text segment being streamed into
  const currentTextSegIdRef = useRef<string | null>(null);

  useEffect(() => {
    presetRef.current = preset;
  }, [preset]);
  useEffect(() => {
    onClaimRef.current = onClaim;
  }, [onClaim]);
  useEffect(() => {
    accessTokenRef.current = accessToken;
  }, [accessToken]);

  async function teardownSileroVad() {
    const vad = sileroVadRef.current;
    sileroVadRef.current = null;
    if (!vad) return;
    try {
      await vad.destroy();
    } catch (err) {
      console.error("[Live] Silero VAD destroy error:", err);
    }
  }

  function teardownAudio() {
    streamingRef.current = false;
    void teardownSileroVad();
    workletRef.current?.disconnect();
    workletRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
  }

  function sendActivity(ws: WebSocket, event: SileroVadEvent) {
    if (ws.readyState !== WebSocket.OPEN) return;
    switch (event) {
      case "speech_start":
        if (turnOpenRef.current) return;
        ws.send(JSON.stringify({ type: "activity_start" }));
        turnOpenRef.current = true;
        return;
      case "speech_end":
        if (!turnOpenRef.current) return;
        ws.send(JSON.stringify({ type: "activity_end" }));
        turnOpenRef.current = false;
        return;
      default: {
        const _exhaustive: never = event;
        return _exhaustive;
      }
    }
  }

  function onSileroEvent(ws: WebSocket, event: SileroVadEvent) {
    console.log("[Live] Silero", event);
    sendActivity(ws, event);
    if (event === "speech_end" && streamingRef.current && !stoppedRef.current) {
      sendActivity(ws, "speech_start");
    }
  }

  async function startSileroVad(ws: WebSocket, stream: MediaStream) {
    await teardownSileroVad();
    const vad = await createSileroVad({
      stream,
      onEvent: (event) => {
        onSileroEvent(ws, event);
      },
    });
    sileroVadRef.current = vad;
    await vad.start();
    console.log("[Live] Silero VAD started");
  }

  /** Append text to the current open text segment, or create one. */
  function appendText(text: string) {
    if (!text) return;
    setSegments((prev) => {
      const last = prev[prev.length - 1];
      if (last?.type === "text" && last.id === currentTextSegIdRef.current) {
        return [...prev.slice(0, -1), { ...last, text: last.text + text }];
      }
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
    currentTextSegIdRef.current = null;
    setSegments((prev) => {
      if (prev.length === 0) {
        return [{ type: "claim", id: uuidv4(), claimId, text: claimText }];
      }
      const last = prev[prev.length - 1];
      if (last.type === "text") {
        return [
          ...prev.slice(0, -1),
          { type: "claim", id: last.id, claimId, text: last.text || claimText },
        ];
      }
      return [...prev, { type: "claim", id: uuidv4(), claimId, text: claimText }];
    });
  }

  async function startAudio(ws: WebSocket) {
    console.log("[Live] Starting audio");
    const stream = mediaStreamRef.current;
    if (!stream) {
      console.error("[Live] No media stream for audio");
      return;
    }

    const audioCtx = new AudioContext({ sampleRate: 16000 });
    audioCtxRef.current = audioCtx;

    const source = audioCtx.createMediaStreamSource(stream);

    const workletCode = `
      class PCMProcessor extends AudioWorkletProcessor {
        _buf = new Int16Array(${PCM_CHUNK_SAMPLES});
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
    const blobUrl = URL.createObjectURL(
      new Blob([workletCode], { type: "application/javascript" }),
    );
    await audioCtx.audioWorklet.addModule(blobUrl);
    URL.revokeObjectURL(blobUrl);

    const node = new AudioWorkletNode(audioCtx, "pcm-proc");
    workletRef.current = node;

    node.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ type: "audio", data: bufToBase64(e.data) }));
    };

    source.connect(node);
    // Do not connect to destination — avoids feedback when monitoring speakers.
    console.log("[Live] Audio streaming started");

    streamingRef.current = true;
    try {
      await startSileroVad(ws, stream);
    } catch (err) {
      console.error("[Live] Silero VAD start error:", err);
      streamingRef.current = false;
      await teardownSileroVad();
    }
  }

  async function doConnect() {
    console.log("[Live] doConnect, stopped=", stoppedRef.current);
    if (stoppedRef.current) return;

    try {
      if (!mediaStreamRef.current) {
        mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: MIC_CONSTRAINTS,
        });
        console.log("[Live] Mic acquired");
      }

      if (stoppedRef.current) return;

      const token = accessTokenRef.current;
      if (!token) {
        console.error("[Live] Missing access token — cannot connect");
        return;
      }

      const params = new URLSearchParams({
        preset: presetRef.current,
      });
      const wsUrl = backendUrl(`/ws/live?${params.toString()}`).replace(/^http/, "ws");
      console.log("[Live] Connecting to proxy:", wsUrl);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      let authAccepted = false;

      ws.onopen = () => {
        console.log("[Live] WS open — sending auth");
        ws.send(JSON.stringify({ type: "auth", access_token: token }));
      };

      ws.onmessage = async (event) => {
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }

        const keys = Object.keys(msg);
        if (keys.length) console.log("[Live] ←", keys[0], JSON.stringify(msg).slice(0, 120));

        if (msg.type === "auth_ok") {
          console.log("[Live] Auth accepted");
          authAccepted = true;
          return;
        }

        if ("setupComplete" in msg) {
          if (!authAccepted) {
            console.error("[Live] setupComplete before auth_ok — closing");
            ws.close();
            return;
          }
          console.log("[Live] Setup complete — starting audio");
          setIsConnected(true);
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

        const tc = msg.toolCall as
          | {
              functionCalls?: { id: string; name: string; args: Record<string, unknown> }[];
            }
          | undefined;
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
              ws.send(
                JSON.stringify({
                  type: "tool_response",
                  functionResponses: [{ id: call.id, name: call.name, response: { status: "ok" } }],
                }),
              );
            }
          }
        }
      };

      ws.onerror = (e) => console.error("[Live] WS error", e);

      ws.onclose = (e) => {
        console.log("[Live] WS closed", e.code, e.reason);
        turnOpenRef.current = false;
        teardownAudio();
        setIsConnected(false);
        if (!stoppedRef.current) {
          console.log("[Live] Reconnecting in 2s");
          setTimeout(doConnect, 2000);
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
      if (!stoppedRef.current) setTimeout(doConnect, 3000);
    }
  }

  const [isPaused, setIsPaused] = useState(false);

  const pause = useCallback(() => {
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    teardownAudio();
    setIsPaused(true);
  }, []);

  const resume = useCallback(async () => {
    if (!isPaused) return;
    try {
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: MIC_CONSTRAINTS,
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
    stoppedRef.current = true;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
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

  useEffect(
    () => () => {
      stoppedRef.current = true;
      stop();
    },
    [stop],
  );

  return { isConnected, isPaused, segments, start, stop, pause, resume };
}

function bufToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
