import { describe, expect, it } from "vitest";
import { reduceClaims, UNCONFIRMED_HEARD_MS } from "@/lib/claim-machine";
import { pullCompletedSentences, pullRemainderOnSpeechEnd } from "@/lib/hear-sentences";
import type { Claim, ClaimId, TurnId } from "@/types/claim";

function claimId(value: string): ClaimId {
  return value as ClaimId;
}

function turnId(value: number): TurnId {
  return value as TurnId;
}

function hear(
  claims: Claim[],
  text: string,
  opts?: { id?: string; turnId?: number; nowMs?: number },
) {
  return reduceClaims(claims, {
    type: "hear",
    id: claimId(opts?.id ?? text.slice(0, 12)),
    claim_text: text,
    timestamp_seconds: 0,
    turnId: turnId(opts?.turnId ?? 1),
    nowMs: opts?.nowMs ?? 0,
  });
}

describe("heard cards from live STT", () => {
  it("paints a complete English sentence and drops screenshot fragments", () => {
    const complete = "Lewis Hamilton won the 2021 Saudi Arabian Grand Prix.";
    const fragments = [
      "ああ。 Max comes the closet.",
      "ton is the greatest F1 driver of all time.",
      "Louis Hamilton, one",
    ];
    let claims: Claim[] = [];
    claims = hear(claims, complete, { id: "complete" }).claims;
    for (const text of fragments) {
      claims = hear(claims, text, { id: text }).claims;
    }
    expect(claims.map((c) => c.claim_text)).toEqual([complete]);
    expect(claims[0]?.phase).toBe("heard");
  });

  it("still splits punctuated transcript into completed sentences", () => {
    const pulled = pullCompletedSentences(
      { buffer: "", turnId: turnId(1) },
      "ああ。 Max comes the closet.",
    );
    expect(pulled.sentences).toEqual(["ああ。 Max comes the closet."]);
    expect(hear([], pulled.sentences[0] ?? "").claims).toEqual([]);
  });

  it("does not paint an unpunctuated speech_end remainder as a Claim", () => {
    const pulled = pullRemainderOnSpeechEnd({
      buffer: "Louis Hamilton, one",
      turnId: turnId(1),
    });
    expect(pulled.sentences).toEqual(["Louis Hamilton, one"]);
    expect(hear([], pulled.sentences[0] ?? "").claims).toEqual([]);
  });

  it("promotes a complete claim without leaving a fragment card beside it", () => {
    const heard = hear([], "Louis Hamilton, one", { id: "frag" });
    expect(heard.claims).toEqual([]);
    const promoted = reduceClaims(heard.claims, {
      type: "promote",
      reportText: "Lewis Hamilton won the 2021 Saudi Arabian Grand Prix.",
      timestamp_seconds: 2,
    });
    expect(promoted.claims).toHaveLength(1);
    expect(promoted.claims[0]?.phase).toBe("checking");
    expect(promoted.claims[0]?.claim_text).toBe(
      "Lewis Hamilton won the 2021 Saudi Arabian Grand Prix.",
    );
  });

  it("retracts unconfirmed heard rows for the turn that produced them", () => {
    const heard = hear([], "Water boils at 100 degrees C.", {
      id: "frag",
      turnId: 1,
      nowMs: 0,
    });
    const afterPause = reduceClaims(heard.claims, {
      type: "retractUnconfirmed",
      turnId: turnId(1),
      nowMs: UNCONFIRMED_HEARD_MS,
    });
    expect(afterPause.claims).toEqual([]);
  });
});
