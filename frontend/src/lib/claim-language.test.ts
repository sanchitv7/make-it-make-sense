import { describe, expect, it } from "vitest";
import { isCompleteHeardText, isEnglishClaimText } from "@/lib/claim-language";

describe("isEnglishClaimText", () => {
  it("accepts ordinary English claims", () => {
    expect(isEnglishClaimText("Donald Trump is the 31st President of the United States")).toBe(
      true,
    );
  });

  it("rejects STT noise tags", () => {
    expect(isEnglishClaimText("<noise> something")).toBe(false);
    expect(isEnglishClaimText("<noise> డానియల్ ట్రంప్")).toBe(false);
  });

  it("rejects mostly non-Latin transcripts", () => {
    expect(isEnglishClaimText("नरेंद्र मोदी डस नॉट इंडलज इन रिलिजन")).toBe(false);
  });

  it("rejects empty or punctuation-only text", () => {
    expect(isEnglishClaimText("   ")).toBe(false);
    expect(isEnglishClaimText("...")).toBe(false);
  });
});

describe("isCompleteHeardText", () => {
  it("accepts a punctuated English sentence that starts with a capital", () => {
    expect(isCompleteHeardText("Lewis Hamilton won the 2021 Saudi Arabian Grand Prix.")).toBe(true);
    expect(isCompleteHeardText('"The sky is blue."')).toBe(true);
  });

  it("rejects mid-word STT, mixed-script noise, and unpunctuated remainders", () => {
    expect(isCompleteHeardText("ton is the greatest F1 driver of all time.")).toBe(false);
    expect(isCompleteHeardText("ああ。 Max comes the closet.")).toBe(false);
    expect(isCompleteHeardText("Louis Hamilton, one")).toBe(false);
    expect(isCompleteHeardText("unemployment is four percent")).toBe(false);
  });
});
