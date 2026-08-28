import { afterEach, describe, expect, it } from "vitest";
import {
  clearTrialVerdictAccess,
  hasTrialVerdictAccess,
  markTrialVerdictAccess,
} from "@/lib/trial-verdict-access";

const store = new Map<string, string>();

const mockStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => {
    store.set(key, value);
  },
  removeItem: (key: string) => {
    store.delete(key);
  },
  clear: () => store.clear(),
  key: () => null,
  get length() {
    return store.size;
  },
} satisfies Storage;

Object.defineProperty(globalThis, "sessionStorage", {
  configurable: true,
  value: mockStorage,
});

afterEach(() => {
  store.clear();
});

describe("trial verdict access", () => {
  it("grants access only for the marked session", () => {
    markTrialVerdictAccess("session-a");
    expect(hasTrialVerdictAccess("session-a")).toBe(true);
    expect(hasTrialVerdictAccess("session-b")).toBe(false);
  });

  it("clears the pass so a returning visit cannot freeload", () => {
    markTrialVerdictAccess("session-a");
    clearTrialVerdictAccess();
    expect(hasTrialVerdictAccess("session-a")).toBe(false);
  });
});
