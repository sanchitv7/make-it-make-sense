import type { ContextPreset, CreateSessionResponse } from "@/types";
import { apiFetch } from "@/lib/api";
import { isTrialUsedDetail } from "@/lib/trial";
import { LiveSession, MIC_CONSTRAINTS, preloadSileroAssets } from "@/lib/live-session";

export type ListenIntent = {
  preset: ContextPreset;
  contextDetail: string;
  accessToken: string;
};

export const MIC_UNUSABLE_COPY =
  "Can't use the microphone. Allow access in the browser, and check that a microphone is connected.";

export class MicDeniedError extends Error {
  constructor() {
    super(MIC_UNUSABLE_COPY);
    this.name = "MicDeniedError";
  }
}

export class TrialUsedError extends Error {
  constructor() {
    super("trial used");
    this.name = "TrialUsedError";
  }
}

export type ListenStartFailure =
  { kind: "trial-used" } | { kind: "mic-unusable"; message: string } | { kind: "failed" };

export function interpretListenStartError(err: unknown): ListenStartFailure {
  if (err instanceof TrialUsedError) return { kind: "trial-used" };
  if (err instanceof MicDeniedError) {
    return { kind: "mic-unusable", message: err.message };
  }
  return { kind: "failed" };
}

type PreflightSlot =
  | { kind: "empty" }
  | {
      kind: "arming";
      intent: ListenIntent;
      promise: Promise<{ sessionId: string; startedAt: string }>;
    }
  | { kind: "held"; session: LiveSession };

let slot: PreflightSlot = { kind: "empty" };

async function armOnce(intent: ListenIntent): Promise<{ sessionId: string; startedAt: string }> {
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: MIC_CONSTRAINTS });
  } catch {
    slot = { kind: "empty" };
    throw new MicDeniedError();
  }

  const sileroAssets = preloadSileroAssets();

  try {
    const res = await apiFetch("/api/session", intent.accessToken, {
      method: "POST",
      body: JSON.stringify({
        context_preset: intent.preset,
        context_detail: intent.contextDetail || null,
      }),
    });
    if (!res.ok) {
      stream.getTracks().forEach((t) => t.stop());
      const body: unknown = await res.json().catch(() => null);
      const detail =
        body && typeof body === "object" && "detail" in body
          ? (body as { detail: unknown }).detail
          : null;
      slot = { kind: "empty" };
      if (res.status === 403 && isTrialUsedDetail(detail)) {
        throw new TrialUsedError();
      }
      throw new Error("Failed to create session");
    }
    const created = (await res.json()) as CreateSessionResponse;
    const session = LiveSession.connect({
      sessionId: created.session_id,
      preset: intent.preset,
      accessToken: intent.accessToken,
      speakerInfo: intent.contextDetail || undefined,
      stream,
      sileroAssets,
      startedAt: created.started_at,
      onStopped: () => {
        if (slot.kind === "held" && slot.session.sessionId === created.session_id) {
          slot = { kind: "empty" };
        }
      },
    });
    slot = { kind: "held", session };
    return { sessionId: created.session_id, startedAt: created.started_at };
  } catch (err) {
    if (!(err instanceof MicDeniedError) && !(err instanceof TrialUsedError)) {
      stream.getTracks().forEach((t) => t.stop());
    }
    if (slot.kind === "arming") slot = { kind: "empty" };
    throw err;
  }
}

export const ListenPreflight = {
  arm(intent: ListenIntent): Promise<{ sessionId: string; startedAt: string }> {
    if (slot.kind === "arming") {
      return slot.promise;
    }
    if (slot.kind === "held") {
      const startedAt = slot.session.startedAt;
      if (startedAt) {
        return Promise.resolve({
          sessionId: slot.session.sessionId,
          startedAt,
        });
      }
      heldStop(slot.session);
      slot = { kind: "empty" };
    }
    const promise = armOnce(intent);
    slot = { kind: "arming", intent, promise };
    return promise;
  },

  adopt(sessionId: string): LiveSession | null {
    if (slot.kind !== "held") return null;
    if (slot.session.sessionId !== sessionId) {
      heldStop(slot.session);
      slot = { kind: "empty" };
      return null;
    }
    slot.session.markAdopted();
    return slot.session;
  },

  dropIfUnused(sessionId: string): void {
    if (slot.kind !== "held") return;
    if (slot.session.sessionId !== sessionId) return;
    heldStop(slot.session);
    slot = { kind: "empty" };
  },
};

function heldStop(session: LiveSession): void {
  session.stop();
}

export function resetListenPreflightForTests(): void {
  slot = { kind: "empty" };
}
