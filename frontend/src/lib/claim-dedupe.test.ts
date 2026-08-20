import { describe, expect, it } from "vitest";
import { shouldCheckClaim } from "@/lib/claim-dedupe";

describe("shouldCheckClaim", () => {
  it("allows the first occurrence of a claim text", () => {
    const seen = new Set<string>();
    expect(shouldCheckClaim(seen, "Unemployment fell to 3%")).toBe(true);
    expect(seen.has("Unemployment fell to 3%")).toBe(true);
  });

  it("skips duplicate claim text", () => {
    const seen = new Set<string>(["Unemployment fell to 3%"]);
    expect(shouldCheckClaim(seen, "Unemployment fell to 3%")).toBe(false);
  });
});
