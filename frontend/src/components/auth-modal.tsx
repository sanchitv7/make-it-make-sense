"use client";

import { FormEvent, useEffect, useId, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, EyeOff, X } from "lucide-react";
import { useAuth } from "@/components/auth-provider";

type AuthMode = "signin" | "signup" | "forgot";
export type AuthIntent = "default" | "convert";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  intent?: AuthIntent;
  initialMode?: AuthMode;
}

function modeTitle(mode: AuthMode): string {
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

function submitLabel(mode: AuthMode): string {
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

function modeSubtitle(mode: AuthMode, intent: AuthIntent): string {
  if (intent === "convert" && mode === "signup") {
    return "Create an account to keep this session, listen past 30 seconds, and copy a shareable link.";
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

function heading(mode: AuthMode, intent: AuthIntent): string {
  if (intent === "convert" && mode === "signup") return "Keep going";
  return modeTitle(mode);
}

export function AuthModal({
  open,
  onClose,
  onSuccess,
  intent = "default",
  initialMode = "signin",
}: AuthModalProps) {
  const { signIn, signUp, resetPassword } = useAuth();
  const titleId = useId();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
    setFullName("");
    setEmail("");
    setPassword("");
    setShowPassword(false);
    setError(null);
    setInfo(null);
    setSubmitting(false);
  }, [open, initialMode]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function switchMode(next: AuthMode) {
    setMode(next);
    setError(null);
    setInfo(null);
    setShowPassword(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      if (mode === "forgot") {
        const { error: err } = await resetPassword(email.trim());
        if (err) {
          setError(err);
          return;
        }
        setInfo("Check your email for a reset link.");
        return;
      }

      if (mode === "signup") {
        const name = fullName.trim();
        if (!name) {
          setError("Name is required.");
          return;
        }
        const { error: err, pendingConfirmation } = await signUp(email.trim(), password, name);
        if (err) {
          setError(err);
          return;
        }
        if (pendingConfirmation) {
          setInfo("Check your email to finish creating your account.");
          return;
        }
        onClose();
        onSuccess?.();
        return;
      }

      const { error: err } = await signIn(email.trim(), password);
      if (err) {
        setError(err);
        return;
      }
      onClose();
      onSuccess?.();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 cursor-pointer"
            style={{ backgroundColor: "rgba(12, 13, 16, 0.55)" }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-[380px] p-6"
            style={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              aria-label="Close dialog"
            >
              <X size={18} strokeWidth={2} />
            </button>

            <h2
              id={titleId}
              className="mb-1 pr-8 text-2xl font-[family:var(--font-display)] text-[var(--text-primary)]"
            >
              {heading(mode, intent)}
            </h2>
            <p className="mb-6 text-sm font-[family:var(--font-body)] text-[var(--text-secondary)]">
              {modeSubtitle(mode, intent)}
            </p>
            {intent === "convert" && mode === "signup" ? (
              <ul className="mb-6 list-disc space-y-1.5 pl-5 text-sm font-[family:var(--font-body)] text-[var(--text-secondary)]">
                <li>Listen past 30 seconds</li>
                <li>Revisit past sessions</li>
                <li>Copy a shareable verdict link</li>
              </ul>
            ) : null}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {mode === "signup" && (
                <label className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-[family:var(--font-mono)] tracking-widest text-[var(--text-muted)] uppercase">
                    Name
                  </span>
                  <input
                    type="text"
                    autoComplete="name"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="h-11 bg-[var(--bg-primary)] px-3 font-[family:var(--font-body)] text-[var(--text-primary)] outline-none"
                    style={{ border: "1px solid var(--border-subtle)" }}
                  />
                </label>
              )}

              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-[family:var(--font-mono)] tracking-widest text-[var(--text-muted)] uppercase">
                  Email
                </span>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 bg-[var(--bg-primary)] px-3 font-[family:var(--font-body)] text-[var(--text-primary)] outline-none"
                  style={{ border: "1px solid var(--border-subtle)" }}
                />
              </label>

              {mode !== "forgot" && (
                <label className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-[family:var(--font-mono)] tracking-widest text-[var(--text-muted)] uppercase">
                    Password
                  </span>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-11 w-full bg-[var(--bg-primary)] px-3 pr-11 font-[family:var(--font-body)] text-[var(--text-primary)] outline-none"
                      style={{ border: "1px solid var(--border-subtle)" }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff size={18} strokeWidth={2} />
                      ) : (
                        <Eye size={18} strokeWidth={2} />
                      )}
                    </button>
                  </div>
                </label>
              )}

              {error && (
                <p className="text-sm font-[family:var(--font-body)] text-[var(--accent-red)]">
                  {error}
                </p>
              )}
              {info && (
                <p className="text-sm font-[family:var(--font-body)] text-[var(--accent-green)]">
                  {info}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="mt-1 h-12 cursor-pointer text-sm font-[family:var(--font-display)] font-bold tracking-[0.15em] text-white uppercase disabled:opacity-60"
                style={{ backgroundColor: "var(--accent-red)" }}
              >
                {submitting ? "…" : submitLabel(mode)}
              </button>
            </form>

            <div className="mt-5 flex flex-col gap-2 text-sm font-[family:var(--font-body)] text-[var(--text-secondary)]">
              {mode === "signin" && (
                <>
                  <button
                    type="button"
                    className="cursor-pointer text-left underline underline-offset-2 hover:text-[var(--text-primary)]"
                    onClick={() => switchMode("forgot")}
                  >
                    Forgot password?
                  </button>
                  <button
                    type="button"
                    className="cursor-pointer text-left hover:text-[var(--text-primary)]"
                    onClick={() => switchMode("signup")}
                  >
                    Need an account?{" "}
                    <span className="underline underline-offset-2">Create one</span>
                  </button>
                </>
              )}
              {mode === "signup" && (
                <button
                  type="button"
                  className="cursor-pointer text-left hover:text-[var(--text-primary)]"
                  onClick={() => switchMode("signin")}
                >
                  Already have an account?{" "}
                  <span className="underline underline-offset-2">Sign in</span>
                </button>
              )}
              {mode === "forgot" && (
                <button
                  type="button"
                  className="cursor-pointer text-left underline underline-offset-2 hover:text-[var(--text-primary)]"
                  onClick={() => switchMode("signin")}
                >
                  Back to sign in
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
