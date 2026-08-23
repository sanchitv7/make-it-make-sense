"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandTitle } from "@/components/brand-title";
import { AccountChip } from "@/components/account-chip";
import { useAuth } from "@/components/auth-provider";
import { accountFullNameFromMetadata } from "@/lib/account-display-name";
import { prefetchSessionList } from "@/lib/session-cache";
import { headerAuthControlClassName } from "@/lib/header-auth-control";

interface SiteHeaderProps {
  onSignInClick?: () => void;
  showBrandTitle?: boolean;
}

const authPlaceholder = <div className="min-h-10 min-w-[5.5rem]" aria-hidden="true" />;

export function SiteHeader({ onSignInClick, showBrandTitle = true }: SiteHeaderProps) {
  const { user, loading, signOut, accessToken } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const authReady = mounted && !loading;

  return (
    <header
      className="app-header-frost fixed top-0 right-0 left-0 z-[60] w-full"
      style={{
        borderRadius: 0,
        borderTop: showBrandTitle ? "6px solid var(--border-active)" : "6px solid transparent",
      }}
    >
      <div
        className={`flex items-center px-4 pb-3 md:px-6 ${
          showBrandTitle ? "justify-between" : "justify-end"
        }`}
      >
        {showBrandTitle ? (
          <div className="flex items-baseline overflow-hidden">
            <BrandTitle />
          </div>
        ) : (
          <div className="min-w-0 flex-1" aria-hidden="true" />
        )}

        <div className="flex items-center gap-4">
          {!authReady ? (
            authPlaceholder
          ) : user ? (
            <>
              <AccountChip fullName={accountFullNameFromMetadata(user.user_metadata)} />
              <Link
                href="/sessions"
                className={headerAuthControlClassName}
                onPointerEnter={() => {
                  if (accessToken) prefetchSessionList(accessToken);
                }}
                onFocus={() => {
                  if (accessToken) prefetchSessionList(accessToken);
                }}
              >
                Sessions
              </Link>
              <button
                type="button"
                onClick={() => void signOut()}
                className={headerAuthControlClassName}
              >
                Sign out
              </button>
            </>
          ) : onSignInClick ? (
            <button type="button" onClick={onSignInClick} className={headerAuthControlClassName}>
              Sign in
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
