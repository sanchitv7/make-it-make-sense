import { describe, expect, it } from "vitest";
import {
  authHeading,
  authModeSubtitle,
  authPendingConfirmMessage,
  splashCtaLabel,
  SPLASH_TRIAL_USED_HINT,
} from "@/lib/auth-copy";

describe("auth copy", () => {
  it("keeps convert copy for a preview that just ended", () => {
    expect(authHeading("signup", "convert")).toBe("Keep going");
    expect(authModeSubtitle("signup", "convert")).toMatch(/keep this session/i);
    expect(authPendingConfirmMessage("convert")).toMatch(/keep this session/i);
  });

  it("explains a used preview to a returning visitor", () => {
    expect(authHeading("signup", "trial_used")).toBe("Listen again");
    expect(authModeSubtitle("signup", "trial_used")).toMatch(/this device already used/i);
    expect(authModeSubtitle("signup", "trial_used")).not.toMatch(/keep this session/i);
    expect(authPendingConfirmMessage("trial_used")).not.toMatch(/keep this session/i);
  });

  it("leaves sign-in copy unchanged", () => {
    expect(authHeading("signin", "trial_used")).toBe("Sign in");
    expect(authModeSubtitle("signin", "trial_used")).toMatch(/email and password/i);
  });
});

describe("splash CTA", () => {
  it("does not say Begin after the preview is used", () => {
    expect(splashCtaLabel(false)).toBe("Begin");
    expect(splashCtaLabel(true)).toBe("Create account");
    expect(SPLASH_TRIAL_USED_HINT).toMatch(/this device already used/i);
  });
});
