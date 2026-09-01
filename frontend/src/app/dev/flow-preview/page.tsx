"use client";

import { useState } from "react";
import { TopBar } from "@/components/top-bar";
import { VerdictFeed } from "@/components/verdict-feed";
import { SessionExitDialog } from "@/components/session-exit-dialog";
import type { Claim, ClaimId, ClaimTextKey } from "@/types/claim";

const previewClaims: Claim[] = [
  {
    phase: "checking",
    id: "preview-checking" as ClaimId,
    claim_text: "The earth orbits the sun once a year.",
    textKey: "the earth orbits the sun once a year." as ClaimTextKey,
    timestamp_seconds: 8,
  },
  {
    phase: "verdicted",
    id: "preview-true" as ClaimId,
    claim_text: "The sky is blue because of Rayleigh scattering.",
    textKey: "the sky is blue because of rayleigh scattering." as ClaimTextKey,
    timestamp_seconds: 12,
    verdict: "TRUE",
    verdict_summary: "This matches established physics.",
    source_name: "NASA",
    source_url: "https://example.com",
  },
  {
    phase: "verdicted",
    id: "preview-unverified" as ClaimId,
    claim_text: "The moon is made of cheese.",
    textKey: "the moon is made of cheese." as ClaimTextKey,
    timestamp_seconds: 40,
    verdict: "UNVERIFIED",
    verdict_summary: "No trusted source confirmed this.",
    source_name: null,
    source_url: null,
  },
];

/** Local-only page for UI demos and screen recordings. Not linked in the app. */
export default function FlowPreviewPage() {
  const [exitOpen, setExitOpen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  return (
    <div className="min-h-dvh" style={{ backgroundColor: "var(--bg-primary)" }}>
      <TopBar
        ready={isPaused ? { status: "paused" } : { status: "listening" }}
        claims={previewClaims}
        accountFullName="Sanchit"
        onPause={() => setIsPaused(true)}
        onResume={() => setIsPaused(false)}
        onStop={() => setExitOpen(false)}
        onSignOut={() => {}}
        onTitleClick={() => {
          if (!isPaused) setIsPaused(true);
          setExitOpen(true);
        }}
      />
      <div className="mx-auto w-full max-w-[900px] px-6 py-8 md:px-12">
        <VerdictFeed
          claims={previewClaims}
          ready={isPaused ? { status: "paused" } : { status: "listening" }}
        />
      </div>
      <SessionExitDialog
        open={exitOpen}
        onClose={() => setExitOpen(false)}
        onEndAndGoHome={() => setExitOpen(false)}
        onResume={() => {
          setIsPaused(false);
          setExitOpen(false);
        }}
      />
    </div>
  );
}
