import type { ContextPreset, FactCheckResult, Verdict } from "@/types";
import type { Claim, ClaimAction, ClaimId, ListenReady, TurnId } from "@/types/claim";
import { newClaimId, reduceClaims, UNCONFIRMED_HEARD_MS } from "@/lib/claim-machine";
import {
  pullCompletedSentences,
  pullRemainderOnSpeechEnd,
  type TranscriptTail,
} from "@/lib/hear-sentences";
import { isEnglishClaimText } from "@/lib/claim-language";
import { apiFetch, backendUrl } from "@/lib/api";
import { TRIAL_EXPIRED_DETAIL } from "@/lib/trial";
import { PcmPadBuffer } from "@/lib/pcm-pad";
import {
  createSileroVad,
  SILERO_PRE_SPEECH_PAD_MS,
  type GeminiActivityEvent,
  type SileroVadEvent,
  type SileroVadHandle,
} from "@/lib/silero-vad";

const RECONNECT_BEFORE_MS = 13.5 * 60 * 1000;
const PCM_CHUNK_SAMPLES = 1024;
const MAX_QUEUED_AUDIO = 24;

export const MIC_CONSTRAINTS: MediaTrackConstraints = {
  sampleRate: 16000,
  channelCount: 1,
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: true,
};

export type LiveSnapshot = {
  ready: ListenReady;
  claims: Claim[];
};

export type LiveSessionOpts = {
  sessionId: string;
  preset: ContextPreset;
  accessToken: string;
  speakerInfo?: string;
  stream?: MediaStream;
  sileroAssets?: Promise<void>;
  startedAt?: string;
  onTrialExpired?: () => void;
  onStopped?: () => void;
};

type Outgoing = { kind: "control" | "audio"; json: string };

type LiveEvent =
  | { type: "auth_ok" }
  | { type: "setup_complete" }
  | { type: "transcript"; text: string }
  | { type: "turn_complete" }
  | { type: "claim"; toolCallId: string; name: string; args: Record<string, unknown> }
  | { type: "trial_expired" }
  | { type: "ignored" };

export class LiveSession {
  readonly sessionId: string;
  startedAt: string | null;

  private preset: ContextPreset;
  private accessToken: string;
  private speakerInfo?: string;
  private sileroAssets?: Promise<void>;
  private onTrialExpired?: () => void;
  private onStopped?: () => void;

  private snapshot: LiveSnapshot = { ready: { status: "offline" }, claims: [] };
  private listeners = new Set<() => void>();
  private keepAlive = false;
  private subCount = 0;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  private ws: WebSocket | null = null;
  private mediaStream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private worklet: AudioWorkletNode | null = null;
  private silero: SileroVadHandle | null = null;
  private turnOpen = false;
  private pcmLive = false;
  private stopped = true;
  private trialEnded = false;
  private connectInFlight: Promise<void> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private originMs = Date.now();
  private turnSeq = 0;
  private tail: TranscriptTail = { buffer: "", turnId: 0 as TurnId };
  private pad = new PcmPadBuffer();
  private outbound: Outgoing[] = [];
  private flushScheduled = false;
  private retractTimers = new Map<number, ReturnType<typeof setTimeout>>();

  constructor(opts: LiveSessionOpts) {
    this.sessionId = opts.sessionId;
    this.startedAt = opts.startedAt ?? null;
    this.preset = opts.preset;
    this.accessToken = opts.accessToken;
    this.speakerInfo = opts.speakerInfo;
    this.sileroAssets = opts.sileroAssets;
    this.onTrialExpired = opts.onTrialExpired;
    this.onStopped = opts.onStopped;
    this.mediaStream = opts.stream ?? null;
  }

  static connect(opts: LiveSessionOpts): LiveSession {
    const session = new LiveSession(opts);
    session.retain();
    session.connect();
    return session;
  }

  retain(): void {
    this.keepAlive = true;
    this.clearIdle();
  }

  markAdopted(): void {
    this.keepAlive = false;
  }

  attach(
    opts: Partial<Pick<LiveSessionOpts, "accessToken" | "onTrialExpired" | "speakerInfo">>,
  ): void {
    if (opts.accessToken) this.accessToken = opts.accessToken;
    if (opts.onTrialExpired) this.onTrialExpired = opts.onTrialExpired;
    if (opts.speakerInfo !== undefined) this.speakerInfo = opts.speakerInfo;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    this.subCount += 1;
    this.clearIdle();
    return () => {
      this.listeners.delete(listener);
      this.subCount -= 1;
      if (this.subCount === 0 && !this.keepAlive && !this.stopped) {
        this.idleTimer = setTimeout(() => {
          this.stop();
        }, 300);
      }
    };
  }

  getSnapshot = (): LiveSnapshot => this.snapshot;

  connect(): void {
    if (this.connectInFlight) return;
    if (this.ws?.readyState === WebSocket.OPEN && this.snapshot.ready.status === "listening") {
      return;
    }
    this.stopped = false;
    this.trialEnded = false;
    if (this.snapshot.ready.status === "offline" || this.snapshot.ready.status === "paused") {
      this.setReady({ status: "connecting" });
    }
    this.connectInFlight = this.doConnect().finally(() => {
      this.connectInFlight = null;
    });
  }

  stop(): void {
    if (this.stopped && this.snapshot.ready.status === "offline") {
      this.onStopped?.();
      return;
    }
    this.stopped = true;
    this.clearIdle();
    this.clearReconnect();
    this.clearRetractTimers();
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.enqueue({ kind: "control", json: JSON.stringify({ type: "stop" }) });
      this.flushOutbound();
    }
    this.ws?.close();
    this.ws = null;
    this.teardownAudio();
    this.mediaStream?.getTracks().forEach((t) => t.stop());
    this.mediaStream = null;
    this.setReady({ status: "offline" });
    this.onStopped?.();
  }

  pause(): void {
    this.mediaStream?.getTracks().forEach((t) => t.stop());
    this.mediaStream = null;
    this.teardownAudio();
    this.setReady({ status: "paused" });
  }

  async resume(): Promise<void> {
    if (this.snapshot.ready.status !== "paused") return;
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: MIC_CONSTRAINTS });
      if (this.ws?.readyState === WebSocket.OPEN) {
        await this.startAudio(this.ws);
      }
      this.setReady({ status: "listening" });
    } catch (err) {
      console.error("[Live] resume mic error:", err);
    }
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  private setReady(ready: ListenReady): void {
    if (this.snapshot.ready.status === ready.status) return;
    this.snapshot = { ...this.snapshot, ready };
    this.emit();
  }

  private dispatch(action: ClaimAction) {
    const result = reduceClaims(this.snapshot.claims, action);
    if (result.claims !== this.snapshot.claims) {
      this.snapshot = { ...this.snapshot, claims: result.claims };
      this.emit();
    }
    return result;
  }

  private clearIdle(): void {
    if (this.idleTimer != null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private clearReconnect(): void {
    if (this.reconnectTimer != null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private clearRetractTimers(): void {
    for (const timer of this.retractTimers.values()) clearTimeout(timer);
    this.retractTimers.clear();
  }

  private startNewTurn(): void {
    this.turnSeq += 1;
    this.tail = { buffer: "", turnId: this.turnSeq as TurnId };
  }

  private cutGeminiTurn(): void {
    this.sendActivity("speech_end");
    this.sendActivity("speech_start");
  }

  private enqueue(frame: Outgoing): void {
    if (frame.kind === "audio") {
      let audioCount = 0;
      for (const item of this.outbound) {
        if (item.kind === "audio") audioCount += 1;
      }
      if (audioCount >= MAX_QUEUED_AUDIO) {
        const idx = this.outbound.findIndex((item) => item.kind === "audio");
        if (idx >= 0) this.outbound.splice(idx, 1);
      }
    }
    this.outbound.push(frame);
    if (!this.flushScheduled) {
      this.flushScheduled = true;
      queueMicrotask(() => {
        this.flushScheduled = false;
        this.flushOutbound();
      });
    }
  }

  private flushOutbound(): void {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    while (this.outbound.length > 0) {
      const controlIdx = this.outbound.findIndex((item) => item.kind === "control");
      const idx = controlIdx >= 0 ? controlIdx : 0;
      const frame = this.outbound.splice(idx, 1)[0];
      if (frame) ws.send(frame.json);
    }
  }

  private sendPcm(frame: Int16Array): void {
    this.pad.push(frame);
    if (!this.pcmLive) return;
    this.enqueue({
      kind: "audio",
      json: JSON.stringify({ type: "audio", data: int16ToBase64(frame) }),
    });
  }

  private sendActivity(event: GeminiActivityEvent): void {
    switch (event) {
      case "speech_start": {
        if (this.turnOpen) return;
        this.turnOpen = true;
        this.enqueue({ kind: "control", json: JSON.stringify({ type: "activity_start" }) });
        const dump = this.pad.takeLast(SILERO_PRE_SPEECH_PAD_MS);
        this.pcmLive = true;
        if (dump.length > 0) {
          this.enqueue({
            kind: "audio",
            json: JSON.stringify({ type: "audio", data: int16ToBase64(dump) }),
          });
        }
        return;
      }
      case "speech_end": {
        if (!this.turnOpen) return;
        this.turnOpen = false;
        this.enqueue({ kind: "control", json: JSON.stringify({ type: "activity_end" }) });
        return;
      }
      default: {
        const _exhaustive: never = event;
        return _exhaustive;
      }
    }
  }

  private onSileroEvent(event: SileroVadEvent): void {
    switch (event) {
      case "speech_start": {
        this.startNewTurn();
        this.sendActivity("speech_start");
        return;
      }
      case "speech_end": {
        this.sendActivity("speech_end");
        const pulled = pullRemainderOnSpeechEnd(this.tail);
        this.tail = pulled.next;
        this.hearSentences(pulled.sentences);
        this.startNewTurn();
        this.sendActivity("speech_start");
        return;
      }
      case "turn_flush": {
        this.cutGeminiTurn();
        return;
      }
      default: {
        const _exhaustive: never = event;
        return _exhaustive;
      }
    }
  }

  private onTranscript(text: string): void {
    const pulled = pullCompletedSentences(this.tail, text);
    this.tail = pulled.next;
    if (pulled.sentences.length === 0) return;
    this.hearSentences(pulled.sentences);
    this.cutGeminiTurn();
  }

  private onTurnComplete(): void {
    const turnId = this.tail.turnId;
    const existing = this.retractTimers.get(turnId);
    if (existing != null) clearTimeout(existing);
    this.retractTimers.set(
      turnId,
      setTimeout(() => {
        this.retractTimers.delete(turnId);
        this.dispatch({ type: "retractUnconfirmed", turnId, nowMs: Date.now() });
      }, UNCONFIRMED_HEARD_MS),
    );
  }

  private hearSentences(sentences: string[]): void {
    const timestamp = Math.floor((Date.now() - this.originMs) / 1000);
    for (const claim_text of sentences) {
      this.dispatch({
        type: "hear",
        id: newClaimId(),
        claim_text,
        timestamp_seconds: timestamp,
        turnId: this.tail.turnId,
        nowMs: Date.now(),
      });
    }
  }

  private onReportClaim(event: Extract<LiveEvent, { type: "claim" }>): void {
    this.enqueue({
      kind: "control",
      json: JSON.stringify({
        type: "tool_response",
        functionResponses: [{ id: event.toolCallId, name: event.name, response: { status: "ok" } }],
      }),
    });
    this.flushOutbound();

    const claim_text = typeof event.args.claim_text === "string" ? event.args.claim_text : "";
    if (!isEnglishClaimText(claim_text)) return;
    const timestamp_seconds =
      typeof event.args.timestamp_seconds === "number" ? event.args.timestamp_seconds : 0;
    const context = typeof event.args.context === "string" ? event.args.context : undefined;
    const result = this.dispatch({
      type: "promote",
      reportText: claim_text,
      context,
      timestamp_seconds,
    });
    if (result.effect === "fact-check" && result.promotedId) {
      this.factCheck(result.promotedId);
    }
  }

  private factCheck(id: ClaimId): void {
    const claim = this.snapshot.claims.find((row) => row.id === id);
    if (!claim || claim.phase !== "checking") return;
    const token = this.accessToken;
    if (!token) {
      this.dispatch({
        type: "verdict",
        id,
        verdict: "UNVERIFIED",
        verdict_summary: "Failed to fact-check this claim",
        source_name: null,
        source_url: null,
      });
      return;
    }
    apiFetch("/api/fact-check", token, {
      method: "POST",
      body: JSON.stringify({
        claim_text: claim.claim_text,
        timestamp_seconds: claim.timestamp_seconds,
        session_id: this.sessionId,
        preset: this.preset,
        speaker_info: this.speakerInfo ?? null,
        claim_context: claim.context ?? null,
      }),
    })
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((raw: unknown) => {
        if (raw == null) {
          this.dispatch({
            type: "verdict",
            id,
            verdict: "UNVERIFIED",
            verdict_summary: "Failed to fact-check this claim",
            source_name: null,
            source_url: null,
          });
          return;
        }
        const parsed = parseFactCheckResult(raw);
        this.dispatch({
          type: "verdict",
          id,
          verdict: parsed.verdict,
          verdict_summary: parsed.verdict_summary,
          source_name: parsed.source_name,
          source_url: parsed.source_url,
        });
      })
      .catch((err: unknown) => {
        console.error("Fact-check error:", err);
        this.dispatch({
          type: "verdict",
          id,
          verdict: "UNVERIFIED",
          verdict_summary: "Failed to fact-check this claim",
          source_name: null,
          source_url: null,
        });
      });
  }

  private async teardownSilero(): Promise<void> {
    const vad = this.silero;
    this.silero = null;
    if (!vad) return;
    try {
      await vad.destroy();
    } catch (err) {
      console.error("[Live] Silero VAD destroy error:", err);
    }
  }

  private teardownAudio(): void {
    this.pcmLive = false;
    void this.teardownSilero();
    this.worklet?.disconnect();
    this.worklet = null;
    void this.audioCtx?.close();
    this.audioCtx = null;
  }

  private async startSilero(ws: WebSocket, stream: MediaStream): Promise<void> {
    await this.teardownSilero();
    if (this.sileroAssets) await this.sileroAssets;
    const vad = await createSileroVad({
      stream,
      onEvent: (event) => {
        if (this.ws !== ws || this.stopped) return;
        this.onSileroEvent(event);
      },
    });
    this.silero = vad;
    await vad.start();
  }

  private async startAudio(ws: WebSocket): Promise<void> {
    const stream = this.mediaStream;
    if (!stream) {
      console.error("[Live] No media stream for audio");
      return;
    }

    const audioCtx = new AudioContext({ sampleRate: 16000 });
    this.audioCtx = audioCtx;
    // setupComplete is async; resume or the worklet stays suspended with no PCM.
    if (audioCtx.state === "suspended") {
      await audioCtx.resume();
    }
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
    this.worklet = node;
    node.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      this.sendPcm(new Int16Array(e.data));
    };
    source.connect(node);

    this.pcmLive = false;
    try {
      await this.startSilero(ws, stream);
    } catch (err) {
      console.error("[Live] Silero VAD start error:", err);
      await this.teardownSilero();
      throw err;
    }
  }

  private async doConnect(): Promise<void> {
    if (this.stopped) return;
    try {
      if (!this.mediaStream) {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: MIC_CONSTRAINTS });
      }
      if (this.stopped) return;

      const params = new URLSearchParams({ preset: this.preset });
      const wsUrl = backendUrl(`/ws/live?${params.toString()}`).replace(/^http/, "ws");
      const ws = new WebSocket(wsUrl);
      this.ws = ws;
      let authAccepted = false;

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: "auth",
            access_token: this.accessToken,
            session_id: this.sessionId,
          }),
        );
      };

      ws.onmessage = (event) => {
        let msg: unknown;
        try {
          msg = JSON.parse(String(event.data));
        } catch {
          return;
        }
        const events = parseLiveMessage(msg);
        for (const liveEvent of events) {
          this.handleEvent(ws, liveEvent, authAccepted, (next) => {
            authAccepted = next;
          });
        }
      };

      ws.onerror = (e) => console.error("[Live] WS error", e);

      ws.onclose = (e) => {
        this.turnOpen = false;
        this.teardownAudio();
        if (e.code === 4403 || e.reason === TRIAL_EXPIRED_DETAIL) {
          this.handleTrialExpired();
          return;
        }
        if (!this.stopped) {
          this.setReady({ status: "connecting" });
          setTimeout(() => {
            if (!this.stopped) this.connect();
          }, 2000);
        }
      };

      this.clearReconnect();
      this.reconnectTimer = setTimeout(() => {
        if (!this.stopped) {
          ws.close();
        }
      }, RECONNECT_BEFORE_MS);
    } catch (err) {
      console.error("[Live] connect error:", err);
      this.setReady({ status: "offline" });
      if (!this.stopped) {
        setTimeout(() => {
          if (!this.stopped) this.connect();
        }, 3000);
      }
    }
  }

  private handleEvent(
    ws: WebSocket,
    liveEvent: LiveEvent,
    authAccepted: boolean,
    setAuth: (value: boolean) => void,
  ): void {
    switch (liveEvent.type) {
      case "auth_ok":
        setAuth(true);
        return;
      case "trial_expired":
        this.handleTrialExpired();
        ws.close();
        return;
      case "setup_complete":
        if (!authAccepted) {
          console.error("[Live] setupComplete before auth_ok — closing");
          ws.close();
          return;
        }
        void (async () => {
          try {
            await this.startAudio(ws);
            if (!this.stopped && this.snapshot.ready.status !== "paused") {
              this.setReady({ status: "listening" });
            }
          } catch {
            if (!this.stopped) this.setReady({ status: "connecting" });
          }
        })();
        return;
      case "transcript":
        this.onTranscript(liveEvent.text);
        return;
      case "turn_complete":
        this.onTurnComplete();
        return;
      case "claim":
        this.onReportClaim(liveEvent);
        return;
      case "ignored":
        return;
      default: {
        const _exhaustive: never = liveEvent;
        return _exhaustive;
      }
    }
  }

  private handleTrialExpired(): void {
    if (this.trialEnded) return;
    this.trialEnded = true;
    this.stopped = true;
    this.onTrialExpired?.();
  }
}

function int16ToBase64(frame: Int16Array): string {
  const bytes = new Uint8Array(frame.buffer, frame.byteOffset, frame.byteLength);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i] ?? 0);
  return btoa(s);
}

function parseLiveMessage(raw: unknown): LiveEvent[] {
  if (!raw || typeof raw !== "object") return [{ type: "ignored" }];
  const msg = raw as Record<string, unknown>;
  const events: LiveEvent[] = [];

  if (msg.type === "auth_ok") events.push({ type: "auth_ok" });
  if (msg.type === TRIAL_EXPIRED_DETAIL) events.push({ type: "trial_expired" });
  if ("setupComplete" in msg) events.push({ type: "setup_complete" });

  const sc = msg.serverContent;
  if (sc && typeof sc === "object") {
    const content = sc as Record<string, unknown>;
    const it = content.inputTranscription;
    if (it && typeof it === "object") {
      const text = (it as { text?: unknown }).text;
      if (typeof text === "string" && text) events.push({ type: "transcript", text });
    }
    if (content.turnComplete) events.push({ type: "turn_complete" });
  }

  const tc = msg.toolCall;
  if (tc && typeof tc === "object") {
    const calls = (tc as { functionCalls?: unknown }).functionCalls;
    if (Array.isArray(calls)) {
      for (const call of calls) {
        if (!call || typeof call !== "object") continue;
        const row = call as Record<string, unknown>;
        if (row.name !== "report_claim" || typeof row.id !== "string") continue;
        const args =
          row.args && typeof row.args === "object" ? (row.args as Record<string, unknown>) : {};
        events.push({
          type: "claim",
          toolCallId: row.id,
          name: "report_claim",
          args,
        });
      }
    }
  }

  return events.length > 0 ? events : [{ type: "ignored" }];
}

function parseFactCheckResult(
  raw: unknown,
): Pick<FactCheckResult, "verdict" | "verdict_summary" | "source_name" | "source_url"> {
  if (!raw || typeof raw !== "object") throw new Error("invalid fact-check");
  const row = raw as Record<string, unknown>;
  const verdict = row.verdict;
  if (
    verdict !== "TRUE" &&
    verdict !== "FALSE" &&
    verdict !== "MISLEADING" &&
    verdict !== "UNVERIFIED"
  ) {
    throw new Error("invalid verdict");
  }
  const checked: Verdict = verdict;
  return {
    verdict: checked,
    verdict_summary: typeof row.verdict_summary === "string" ? row.verdict_summary : "",
    source_name: typeof row.source_name === "string" ? row.source_name : null,
    source_url: typeof row.source_url === "string" ? row.source_url : null,
  };
}

export function preloadSileroAssets(): Promise<void> {
  return import("@ricky0123/vad-web").then(() => undefined);
}
