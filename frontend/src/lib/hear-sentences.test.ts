import { describe, expect, it } from "vitest";
import { pullCompletedSentences, pullRemainderOnSpeechEnd } from "@/lib/hear-sentences";
import type { TurnId } from "@/types/claim";

function turnId(value: number): TurnId {
  return value as TurnId;
}

describe("pullCompletedSentences", () => {
  it("emits completed sentences and leaves the unfinished tail", () => {
    const first = pullCompletedSentences(
      { buffer: "", turnId: turnId(4) },
      "Unemployment fell to 3 percent. The earth orbits the sun. Water boils",
    );
    expect(first.sentences).toEqual([
      "Unemployment fell to 3 percent.",
      "The earth orbits the sun.",
    ]);
    expect(first.next).toEqual({ buffer: "Water boils", turnId: 4 });

    const second = pullCompletedSentences(first.next, " at 100 degrees C. And then");
    expect(second.sentences).toEqual(["Water boils at 100 degrees C."]);
    expect(second.next.buffer).toBe("And then");
    expect(second.next.turnId).toBe(4);
  });

  it("emits a punctuated sentence at the end of a chunk", () => {
    const pulled = pullCompletedSentences({ buffer: "The sky is blue", turnId: turnId(1) }, ".");
    expect(pulled.sentences).toEqual(["The sky is blue."]);
    expect(pulled.next.buffer).toBe("");
  });
});

describe("pullRemainderOnSpeechEnd", () => {
  it("emits the unpunctuated remainder and clears the tail", () => {
    const pulled = pullRemainderOnSpeechEnd({
      buffer: "  unemployment is four percent  ",
      turnId: turnId(2),
    });
    expect(pulled.sentences).toEqual(["unemployment is four percent"]);
    expect(pulled.next).toEqual({ buffer: "", turnId: 2 });
  });

  it("emits nothing when the tail is empty", () => {
    const pulled = pullRemainderOnSpeechEnd({ buffer: "   ", turnId: turnId(2) });
    expect(pulled.sentences).toEqual([]);
    expect(pulled.next.buffer).toBe("");
  });
});
