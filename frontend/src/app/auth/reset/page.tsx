"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const { user, loading, updatePassword } = useAuth();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [recovering, setRecovering] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function finishRecovery() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      if (code) {
        const { error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError && !cancelled) {
          setError(exchangeError.message);
        }
        window.history.replaceState({}, "", "/auth/reset");
      }
      if (!cancelled) setRecovering(false);
    }

    void finishRecovery();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      const { error: err } = await updatePassword(password);
      if (err) {
        setError(err);
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/"), 1500);
    } finally {
      setSubmitting(false);
    }
  }

  const busy = loading || recovering;

  return (
    <main
      className="min-h-screen flex items-center justify-center px-6"
      style={{ backgroundColor: "var(--bg-primary)" }}
    >
      <div
        className="w-full max-w-[380px] p-6"
        style={{
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <h1 className="font-[family:var(--font-display)] text-2xl text-[var(--text-primary)] mb-2">
          Set new password
        </h1>
        <p className="font-[family:var(--font-body)] text-sm text-[var(--text-secondary)] mb-6">
          Choose a new password for your account.
        </p>

        {busy ? (
          <p className="text-sm text-[var(--text-muted)]">Loading…</p>
        ) : !user ? (
          <p className="text-sm text-[var(--text-secondary)]">
            This reset link is invalid or expired.{" "}
            <Link href="/" className="underline underline-offset-2 text-[var(--accent-blue)]">
              Return home
            </Link>{" "}
            and try again.
            {error ? (
              <span className="block mt-2 text-[var(--accent-red)]">{error}</span>
            ) : null}
          </p>
        ) : done ? (
          <p className="text-sm text-[var(--accent-green)]">
            Password updated. Redirecting…
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="font-[family:var(--font-mono)] text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                New password
              </span>
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 px-3 outline-none font-[family:var(--font-body)] text-[var(--text-primary)] bg-[var(--bg-primary)]"
                style={{ border: "1px solid var(--border-subtle)" }}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="font-[family:var(--font-mono)] text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                Confirm
              </span>
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="h-11 px-3 outline-none font-[family:var(--font-body)] text-[var(--text-primary)] bg-[var(--bg-primary)]"
                style={{ border: "1px solid var(--border-subtle)" }}
              />
            </label>
            {error && (
              <p className="text-sm text-[var(--accent-red)]">{error}</p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="h-12 font-[family:var(--font-display)] font-bold uppercase tracking-[0.15em] text-sm text-white cursor-pointer disabled:opacity-60"
              style={{ backgroundColor: "var(--accent-red)" }}
            >
              {submitting ? "…" : "Update password"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
