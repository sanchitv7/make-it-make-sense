import { afterEach, describe, expect, it } from "vitest";
import {
  PENDING_CONVERT_PASSWORD_MAX_AGE_MS,
  clearPendingConvertPassword,
  stashPendingConvertPassword,
  takePendingConvertPassword,
} from "@/lib/pending-convert-password";

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

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: mockStorage,
});

afterEach(() => {
  store.clear();
});

describe("pending convert password", () => {
  it("round-trips a stashed password", () => {
    stashPendingConvertPassword("secret-pass");
    expect(takePendingConvertPassword()).toBe("secret-pass");
    expect(takePendingConvertPassword()).toBeNull();
  });

  it("drops expired stashes", () => {
    stashPendingConvertPassword("secret-pass");
    const later = Date.now() + PENDING_CONVERT_PASSWORD_MAX_AGE_MS + 1;
    expect(takePendingConvertPassword(later)).toBeNull();
  });

  it("clears without taking", () => {
    stashPendingConvertPassword("secret-pass");
    clearPendingConvertPassword();
    expect(takePendingConvertPassword()).toBeNull();
  });

  it("ignores malformed storage", () => {
    store.set("mims.pending_convert_password", "not-json");
    expect(takePendingConvertPassword()).toBeNull();
  });
});
