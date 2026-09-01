import { describe, expect, it } from "vitest";
import { reduceClaims, UNCONFIRMED_HEARD_MS } from "@/lib/claim-machine";
import { pullCompletedSentences } from "@/lib/hear-sentences";
import type { Claim, ClaimId, HeardClaim, TurnId } from "@/types/claim";

function claimId(value: string): ClaimId {
  return value as ClaimId;
}

function turnId(value: number): TurnId {
  return value as TurnId;
}

function hear(
  claims: Claim[],
  opts: {
    id: string;
    claim_text: string;
    turnId?: number;
    nowMs?: number;
    timestamp_seconds?: number;
  },
) {
  return reduceClaims(claims, {
    type: "hear",
    id: claimId(opts.id),
    claim_text: opts.claim_text,
    timestamp_seconds: opts.timestamp_seconds ?? 0,
    turnId: turnId(opts.turnId ?? 1),
    nowMs: opts.nowMs ?? 0,
  });
}

function heard(claims: Claim[]): HeardClaim[] {
  return claims.filter((c): c is HeardClaim => c.phase === "heard");
}

describe("reduceClaims hear", () => {
  it("drops claim_text shorter than 12 characters after trim", () => {
    const short = hear([], { id: "a", claim_text: "  too short  " });
    expect(short.claims).toEqual([]);
    expect(short.effect).toBe("none");

    const kept = hear([], { id: "b", claim_text: "Water boils at" });
    expect(kept.claims).toHaveLength(1);
    expect(kept.claims[0]?.phase).toBe("heard");
    expect(kept.claims[0]?.id).toBe("b");
  });

  it("drops a duplicate textKey in any phase", () => {
    const first = hear([], {
      id: "a",
      claim_text: "Unemployment fell to 3 percent.",
    });
    const dup = hear(first.claims, {
      id: "b",
      claim_text: "unemployment   fell to 3 percent.",
    });
    expect(dup.claims).toHaveLength(1);
    expect(dup.claims[0]?.id).toBe("a");
    expect(dup.effect).toBe("none");
  });
});

describe("reduceClaims promote", () => {
  it("drops non-English or noise report_claim text", () => {
    const noise = reduceClaims([], {
      type: "promote",
      reportText: "<noise> డానియల్ ట్రంప్ ఇస్ ద 3",
      timestamp_seconds: 1,
    });
    expect(noise.claims).toHaveLength(0);
    expect(noise.effect).toBe("none");

    const script = reduceClaims([], {
      type: "promote",
      reportText: "नरेंद्र मोदी डस नॉट इंडलज इन रिलिजन",
      timestamp_seconds: 2,
    });
    expect(script.claims).toHaveLength(0);
  });

  it("matches heard by textKey and keeps the same id", () => {
    const text = "The earth orbits the sun once a year.";
    const started = hear([], { id: "keep-me", claim_text: text });
    const promoted = reduceClaims(started.claims, {
      type: "promote",
      reportText: text,
      timestamp_seconds: 12,
    });
    expect(promoted.effect).toBe("fact-check");
    expect(promoted.promotedId).toBe("keep-me");
    expect(promoted.claims).toHaveLength(1);
    expect(promoted.claims[0]).toMatchObject({
      phase: "checking",
      id: "keep-me",
      claim_text: text,
    });
  });

  it("matches heard by containment when textKeys differ and keeps id", () => {
    const started = hear([], {
      id: "contain-me",
      claim_text: "the unemployment rate is 3 percent",
    });
    const promoted = reduceClaims(started.claims, {
      type: "promote",
      reportText: "The unemployment rate is 3 percent this year according to BLS",
      context: "BLS briefing",
      timestamp_seconds: 4,
    });
    expect(promoted.effect).toBe("fact-check");
    expect(promoted.promotedId).toBe("contain-me");
    expect(promoted.claims[0]).toMatchObject({
      phase: "checking",
      id: "contain-me",
      context: "BLS briefing",
    });
  });

  it("inserts checking when no heard match exists", () => {
    const promoted = reduceClaims([], {
      type: "promote",
      reportText: "Water boils at 100 degrees Celsius.",
      timestamp_seconds: 8,
    });
    expect(promoted.effect).toBe("fact-check");
    expect(promoted.promotedId).not.toBeNull();
    expect(promoted.claims).toHaveLength(1);
    expect(promoted.claims[0]?.phase).toBe("checking");
    expect(promoted.claims[0]?.claim_text).toBe("Water boils at 100 degrees Celsius.");
  });

  it("does not fact-check when the key is already checking or verdicted", () => {
    const inserted = reduceClaims([], {
      type: "promote",
      reportText: "Water boils at 100 degrees Celsius.",
      timestamp_seconds: 8,
    });
    const again = reduceClaims(inserted.claims, {
      type: "promote",
      reportText: "Water boils at 100 degrees Celsius.",
      timestamp_seconds: 9,
    });
    expect(again.effect).toBe("none");
    expect(again.promotedId).toBeNull();
    expect(again.claims).toHaveLength(1);
  });
});

describe("reduceClaims verdict", () => {
  it("only applies a verdict to a checking claim", () => {
    const started = hear([], {
      id: "heard-only",
      claim_text: "The earth orbits the sun once a year.",
    });
    const ignored = reduceClaims(started.claims, {
      type: "verdict",
      id: claimId("heard-only"),
      verdict: "TRUE",
      verdict_summary: "Yes.",
      source_name: null,
      source_url: null,
    });
    expect(ignored.claims[0]?.phase).toBe("heard");

    const checking = reduceClaims(started.claims, {
      type: "promote",
      reportText: "The earth orbits the sun once a year.",
      timestamp_seconds: 1,
    });
    const settled = reduceClaims(checking.claims, {
      type: "verdict",
      id: claimId("heard-only"),
      verdict: "TRUE",
      verdict_summary: "It does.",
      source_name: "NASA",
      source_url: "https://example.com",
    });
    expect(settled.claims[0]).toMatchObject({
      phase: "verdicted",
      id: "heard-only",
      verdict: "TRUE",
      verdict_summary: "It does.",
      source_name: "NASA",
    });
  });

  it("treats a failed search as a verdict action to UNVERIFIED", () => {
    const checking = reduceClaims([], {
      type: "promote",
      reportText: "Water boils at 100 degrees Celsius.",
      timestamp_seconds: 2,
    });
    const id = checking.promotedId;
    expect(id).not.toBeNull();
    const failed = reduceClaims(checking.claims, {
      type: "verdict",
      id: id as ClaimId,
      verdict: "UNVERIFIED",
      verdict_summary: "Failed to fact-check this claim",
      source_name: null,
      source_url: null,
    });
    expect(failed.claims[0]).toMatchObject({
      phase: "verdicted",
      id,
      verdict: "UNVERIFIED",
    });
  });
});

describe("reduceClaims retractUnconfirmed", () => {
  it("removes old heard rows for that turnId only", () => {
    const t1Old = hear([], {
      id: "t1-old",
      claim_text: "Unemployment fell to 3 percent.",
      turnId: 1,
      nowMs: 0,
    });
    const t1Recent = hear(t1Old.claims, {
      id: "t1-recent",
      claim_text: "The earth orbits the sun once a year.",
      turnId: 1,
      nowMs: 7_000,
    });
    const t2Old = hear(t1Recent.claims, {
      id: "t2-old",
      claim_text: "Water boils at 100 degrees Celsius.",
      turnId: 2,
      nowMs: 0,
    });
    const checking = reduceClaims(t2Old.claims, {
      type: "promote",
      reportText: "Unemployment fell to 3 percent.",
      timestamp_seconds: 0,
    });

    const stillFresh = reduceClaims(checking.claims, {
      type: "retractUnconfirmed",
      turnId: turnId(1),
      nowMs: 7_000,
    });
    expect(stillFresh.claims.map((c) => c.id)).toEqual(
      expect.arrayContaining(["t1-old", "t1-recent", "t2-old"]),
    );

    const afterWindow = reduceClaims(checking.claims, {
      type: "retractUnconfirmed",
      turnId: turnId(1),
      nowMs: 7_000 + UNCONFIRMED_HEARD_MS,
    });
    const afterIds = afterWindow.claims.map((c) => c.id);
    expect(afterIds).not.toContain("t1-recent");
    expect(afterIds).toContain("t1-old");
    expect(afterIds).toContain("t2-old");
    expect(afterWindow.claims.find((c) => c.id === "t1-old")?.phase).toBe("checking");
  });
});

describe("sentence hears before report_claim", () => {
  it("three completed sentences in one turn become three heard cards", () => {
    const pulled = pullCompletedSentences(
      { buffer: "", turnId: turnId(1) },
      "Unemployment fell to 3 percent. The earth orbits the sun. Water boils at 100 degrees C. ",
    );
    expect(pulled.sentences).toHaveLength(3);

    let claims: Claim[] = [];
    pulled.sentences.forEach((claim_text, index) => {
      const result = hear(claims, {
        id: `s${index}`,
        claim_text,
        turnId: 1,
      });
      claims = result.claims;
    });

    expect(heard(claims)).toHaveLength(3);
    expect(claims.every((c) => c.phase === "heard")).toBe(true);
  });
});
