"use client";

import { useAuth } from "@/components/auth-provider";

interface SiteHeaderProps {
  onSignInClick: () => void;
}

const authControlClassName =
  "inline-flex items-center justify-center min-h-10 min-w-[5.5rem] px-3 font-[family:var(--font-body)] text-sm text-[var(--text-primary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] hover:border-[var(--border-active)] cursor-pointer transition-colors";

export function SiteHeader({ onSignInClick }: SiteHeaderProps) {
  const { user, loading, signOut } = useAuth();

  return (
    <header className="fixed top-0 left-0 right-0 z-40 flex items-center justify-end px-6 md:px-12 py-4 bg-[var(--bg-primary)] border-b border-[var(--border-subtle)]">
      <div className="flex items-center gap-4">
        {loading ? (
          <div className="min-h-10 min-w-[5.5rem]" aria-hidden="true" />
        ) : user ? (
          <>
            <span
              className="hidden sm:inline font-[family:var(--font-body)] text-sm text-[var(--text-secondary)] max-w-[200px] truncate"
              title={user.email ?? undefined}
            >
              {user.email}
            </span>
            <button
              type="button"
              onClick={() => void signOut()}
              className={authControlClassName}
            >
              Sign out
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onSignInClick}
            className={authControlClassName}
          >
            Sign in
          </button>
        )}
      </div>
    </header>
  );
}
