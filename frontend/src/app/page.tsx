"use client";

import { useEffect, useState } from "react";
import { SplashHero } from "@/components/splash-hero";
import { ContextSetup } from "@/components/context-setup";
import { AuthModal } from "@/components/auth-modal";
import { SiteHeader } from "@/components/site-header";
import { useAuth } from "@/components/auth-provider";

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
  const { user, loading } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [pendingBegin, setPendingBegin] = useState(false);
  const [showHeaderBrand, setShowHeaderBrand] = useState(false);
  const [scrollReady, setScrollReady] = useState(false);

  useEffect(() => {
    setScrollReady(true);
  }, []);

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
  }, [scrollReady, user, loading]);

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
    if (!pendingBegin) return;
    setPendingBegin(false);
    requestAnimationFrame(() => {
      setTimeout(scrollToSetup, 50);
    });
  };

  return (
    <>
      <SiteHeader
        showBrandTitle={showHeaderBrand}
        onSignInClick={() => {
          setPendingBegin(false);
          setAuthOpen(true);
        }}
      />
      <main>
        <SplashHero onBeginClick={handleBeginClick} />
        {!loading && user && (
          <div id="setup-section" className="scroll-mt-24">
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
