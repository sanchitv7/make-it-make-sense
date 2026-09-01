import { describe, expect, it } from "vitest";
import { isEnglishClaimText } from "@/lib/claim-language";

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
