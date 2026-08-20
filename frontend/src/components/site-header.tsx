"use client";

import Link from "next/link";
import { AccountChip } from "@/components/account-chip";
import { useAuth } from "@/components/auth-provider";
import { accountFullNameFromMetadata } from "@/lib/account-display-name";
import { prefetchSessionList } from "@/lib/session-cache";

interface SiteHeaderProps {
  onSignInClick?: () => void;
}

const authControlClassName =
  "inline-flex items-center justify-center min-h-10 min-w-[5.5rem] px-3 font-[family:var(--font-body)] text-sm text-[var(--text-primary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] hover:border-[var(--border-active)] cursor-pointer transition-colors";

export function SiteHeader({ onSignInClick }: SiteHeaderProps) {
  const { user, loading, signOut, accessToken } = useAuth();

  return (
    <header className="fixed top-0 right-0 left-0 z-40 flex items-center justify-end border-b border-[var(--border-subtle)] bg-[var(--bg-primary)] px-6 py-4 md:px-12">
      <div className="flex items-center gap-4">
        {loading ? (
          <div className="min-h-10 min-w-[5.5rem]" aria-hidden="true" />
        ) : user ? (
          <>
            <AccountChip fullName={accountFullNameFromMetadata(user.user_metadata)} />
            <Link
              href="/sessions"
              className={authControlClassName}
              onPointerEnter={() => {
                if (accessToken) prefetchSessionList(accessToken);
              }}
              onFocus={() => {
                if (accessToken) prefetchSessionList(accessToken);
              }}
            >
              Sessions
            </Link>
            <button type="button" onClick={() => void signOut()} className={authControlClassName}>
              Sign out
            </button>
          </>
        ) : onSignInClick ? (
          <button type="button" onClick={onSignInClick} className={authControlClassName}>
            Sign in
          </button>
        ) : null}
      </div>
    </header>
  );
}
