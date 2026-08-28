"use client";

import { useCallback, useEffect, useState } from "react";
import { SplashHero } from "@/components/splash-hero";
import { ContextSetup } from "@/components/context-setup";
import { AuthModal, type AuthIntent } from "@/components/auth-modal";
import { SiteHeader } from "@/components/site-header";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api";
import type { AccountStatus } from "@/types";

function headerShouldSolidate(headline: Element | null, setup: Element | null): boolean {
  if (setup) {
    const setupRect = setup.getBoundingClientRect();
    if (setupRect.top <= 96) return true;
  }

  if (headline) {
    const headlineRect = headline.getBoundingClientRect();
    if (headlineRect.bottom <= 88) return true;
  }

  return false;
}

export default function Home() {
  const { user, loading, accessToken, isAnonymous, hasAccount, signInAnonymously } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [authIntent, setAuthIntent] = useState<AuthIntent>("default");
  const [pendingBegin, setPendingBegin] = useState(false);
  const [showHeaderBrand, setShowHeaderBrand] = useState(false);
  const [scrollReady, setScrollReady] = useState(false);
  const [trialUsed, setTrialUsed] = useState<boolean | null>(null);
  const [beginError, setBeginError] = useState<string | null>(null);

  useEffect(() => {
    setScrollReady(true);
    const params = new URLSearchParams(window.location.search);
    if (params.get("auth_error") === "confirm") {
      setBeginError("That confirmation link is invalid or expired. Try creating an account again.");
      window.history.replaceState({}, "", "/");
    }
  }, []);

  useEffect(() => {
    if (!accessToken || !isAnonymous) {
      setTrialUsed(hasAccount ? false : null);
      return;
    }
    let cancelled = false;
    void apiFetch("/api/account", accessToken)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load account");
        return res.json() as Promise<AccountStatus>;
      })
      .then((data) => {
        if (!cancelled) setTrialUsed(data.trial_used);
      })
      .catch(() => {
        if (!cancelled) setTrialUsed(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, isAnonymous, hasAccount]);

  const canListen = hasAccount || (isAnonymous && trialUsed === false);

  useEffect(() => {
    if (!scrollReady) return;

    const headline = document.querySelector("#splash-hero h1");
    const setup = document.getElementById("setup-section");

    const update = () => {
      setShowHeaderBrand(headerShouldSolidate(headline, setup));
    };

    update();

    const observer = new IntersectionObserver(update, {
      threshold: [0, 0.01, 0.1, 0.25, 0.5, 0.75, 1],
      rootMargin: "-72px 0px 0px 0px",
    });

    if (headline) observer.observe(headline);
    if (setup) observer.observe(setup);

    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [scrollReady, user, loading, canListen]);

  const scrollToSetup = () => {
    document.getElementById("setup-section")?.scrollIntoView({ behavior: "smooth" });
  };

  const openConvert = useCallback(() => {
    setAuthIntent("convert");
    setAuthOpen(true);
  }, []);

  const openSignIn = useCallback(() => {
    setPendingBegin(false);
    setAuthIntent("default");
    setAuthOpen(true);
  }, []);

  useEffect(() => {
    if (!pendingBegin) return;
    if (canListen) {
      setPendingBegin(false);
      requestAnimationFrame(() => {
        setTimeout(scrollToSetup, 50);
      });
      return;
    }
    if (isAnonymous && trialUsed) {
      setPendingBegin(false);
      openConvert();
    }
  }, [pendingBegin, canListen, isAnonymous, trialUsed, openConvert]);

  const handleBeginClick = async () => {
    setBeginError(null);
    if (hasAccount || (isAnonymous && trialUsed === false)) {
      scrollToSetup();
      return;
    }
    if (isAnonymous && trialUsed) {
      openConvert();
      return;
    }
    if (user && trialUsed === null) {
      setPendingBegin(true);
      return;
    }
    setPendingBegin(true);
    const { error } = await signInAnonymously();
    if (error) {
      console.error("[Auth] Anonymous sign-in failed:", error);
      setPendingBegin(false);
      setBeginError("Preview isn’t available right now. Create an account to start listening.");
      openConvert();
    }
  };

  const handleAuthSuccess = () => {
    if (!pendingBegin) return;
    setPendingBegin(false);
    requestAnimationFrame(() => {
      setTimeout(scrollToSetup, 50);
    });
  };

  return (
    <>
      <SiteHeader showBrandTitle={showHeaderBrand} onSignInClick={openSignIn} />
      <main>
        <SplashHero onBeginClick={() => void handleBeginClick()} />
        {beginError ? (
          <p
            className="fixed bottom-6 left-1/2 z-[70] max-w-md -translate-x-1/2 px-4 py-3 text-center text-sm font-[family:var(--font-body)] text-white shadow-lg"
            style={{ backgroundColor: "var(--accent-red)" }}
            role="status"
          >
            {beginError}
          </p>
        ) : null}
        {!loading && canListen && (
          <div id="setup-section" className="scroll-mt-24">
            <ContextSetup onTrialUsed={openConvert} />
          </div>
        )}
      </main>
      <AuthModal
        open={authOpen}
        intent={authIntent}
        initialMode={authIntent === "convert" ? "signup" : "signin"}
        onClose={() => {
          setAuthOpen(false);
          setPendingBegin(false);
        }}
        onSuccess={handleAuthSuccess}
      />
    </>
  );
}
