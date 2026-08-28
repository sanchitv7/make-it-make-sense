import { describe, expect, it } from "vitest";
import type { User } from "@supabase/supabase-js";
import { isAnonymousAccount, isPermanentAccount } from "@/lib/account-kind";

function user(isAnonymous: boolean): User {
  return { is_anonymous: isAnonymous } as User;
}

describe("account kind", () => {
  it("treats missing users as neither anonymous nor permanent", () => {
    expect(isAnonymousAccount(null)).toBe(false);
    expect(isPermanentAccount(null)).toBe(false);
  });

  it("detects anonymous vs permanent Accounts", () => {
    expect(isAnonymousAccount(user(true))).toBe(true);
    expect(isPermanentAccount(user(true))).toBe(false);
    expect(isAnonymousAccount(user(false))).toBe(false);
    expect(isPermanentAccount(user(false))).toBe(true);
  });
});
