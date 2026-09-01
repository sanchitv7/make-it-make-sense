export type AuthMode = "signin" | "signup" | "forgot";
export type AuthIntent = "default" | "convert" | "trial_used";

export function authModeTitle(mode: AuthMode): string {
  switch (mode) {
    case "signup":
      return "Create account";
    case "forgot":
      return "Reset password";
    case "signin":
      return "Sign in";
    default: {
      const _exhaustive: never = mode;
      return _exhaustive;
    }
  }
}

export function authSubmitLabel(mode: AuthMode): string {
  switch (mode) {
    case "forgot":
      return "Send reset link";
    case "signup":
      return "Create account";
    case "signin":
      return "Continue";
    default: {
      const _exhaustive: never = mode;
      return _exhaustive;
    }
  }
}

export function authHeading(mode: AuthMode, intent: AuthIntent): string {
  if (mode === "signup" && intent === "convert") return "Keep going";
  if (mode === "signup" && intent === "trial_used") return "Listen again";
  return authModeTitle(mode);
}

export function authModeSubtitle(mode: AuthMode, intent: AuthIntent): string {
  if (mode === "signup" && intent === "convert") {
    return "Keep this session, listen longer, and share the verdict.";
  }
  if (mode === "signup" && intent === "trial_used") {
    return "This device already used a one-minute preview. Create an account to listen again with no time limit.";
  }
  switch (mode) {
    case "forgot":
      return "We’ll email you a link to set a new password.";
    case "signup":
      return "Name, email, and password to start listening.";
    case "signin":
      return "Email and password to start listening.";
    default: {
      const _exhaustive: never = mode;
      return _exhaustive;
    }
  }
}

export function authPendingConfirmMessage(intent: AuthIntent): string {
  if (intent === "convert") {
    return "Check your email and open the confirmation link in this browser to keep this session.";
  }
  return "Check your email to finish creating your account.";
}

export const SPLASH_TRIAL_USED_HINT =
  "This device already used a one-minute preview. Create an account to listen again.";

export const CREATE_ACCOUNT_CTA = "CREATE ACCOUNT";

export function splashCtaLabel(trialUsed: boolean): string {
  return trialUsed ? "Create account" : "Begin";
}
