import { describe, expect, it } from "vitest";
import { accountDisplayName } from "@/lib/account-display-name";

describe("accountDisplayName", () => {
  it("returns the first token of a full name", () => {
    expect(accountDisplayName("Sanchit Verma")).toBe("Sanchit");
  });

  it("returns a single-token name unchanged", () => {
    expect(accountDisplayName("Madonna")).toBe("Madonna");
  });

  it("returns empty string when name is missing or whitespace", () => {
    expect(accountDisplayName(undefined)).toBe("");
    expect(accountDisplayName(null)).toBe("");
    expect(accountDisplayName("")).toBe("");
    expect(accountDisplayName("   ")).toBe("");
  });

  it("trims surrounding whitespace before taking the first token", () => {
    expect(accountDisplayName("  Sanchit Verma  ")).toBe("Sanchit");
  });
});
