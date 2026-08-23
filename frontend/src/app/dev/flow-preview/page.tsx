"use client";

import { useState } from "react";
import { TopBar } from "@/components/top-bar";
import { SessionExitDialog } from "@/components/session-exit-dialog";

/** Local-only page for UI demos and screen recordings. Not linked in the app. */
export default function FlowPreviewPage() {
  const [exitOpen, setExitOpen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  return (
    <div className="min-h-dvh" style={{ backgroundColor: "var(--bg-primary)" }}>
      <TopBar
        isConnected
        isPaused={isPaused}
        verdictCounts={{ TRUE: 1, FALSE: 0, MISLEADING: 0, UNVERIFIED: 1 }}
        totalClaims={2}
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
      <div className="mx-auto max-w-[900px] px-6 py-8 font-[family:var(--font-body)] text-[var(--text-secondary)]">
        Demo: click the title to pause and open the exit dialog.
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
