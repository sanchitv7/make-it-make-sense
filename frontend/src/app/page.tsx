"use client";

import { useState } from "react";
import { SplashHero } from "@/components/splash-hero";
import { ContextSetup } from "@/components/context-setup";
import { AuthModal } from "@/components/auth-modal";
import { SiteHeader } from "@/components/site-header";
import { useAuth } from "@/components/auth-provider";

export default function Home() {
  const { user, loading } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [pendingBegin, setPendingBegin] = useState(false);

  const scrollToSetup = () => {
    document.getElementById("setup-section")?.scrollIntoView({ behavior: "smooth" });
  };

  const handleBeginClick = () => {
    if (user) {
      scrollToSetup();
      return;
    }
    setPendingBegin(true);
    setAuthOpen(true);
  };

  const handleAuthSuccess = () => {
    if (pendingBegin) {
      setPendingBegin(false);
      // Wait a tick for ContextSetup to mount after auth state updates.
      requestAnimationFrame(() => {
        setTimeout(scrollToSetup, 50);
      });
    }
  };

  return (
    <>
      <SiteHeader
        onSignInClick={() => {
          setPendingBegin(false);
          setAuthOpen(true);
        }}
      />
      <main>
        <SplashHero onBeginClick={handleBeginClick} />
        {!loading && user && (
          <div id="setup-section">
            <ContextSetup />
          </div>
        )}
      </main>
      <AuthModal
        open={authOpen}
        onClose={() => {
          setAuthOpen(false);
          setPendingBegin(false);
        }}
        onSuccess={handleAuthSuccess}
      />
    </>
  );
}
