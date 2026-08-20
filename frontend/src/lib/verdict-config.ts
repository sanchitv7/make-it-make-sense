import type { Verdict } from "@/types";

export const VERDICT_ORDER: Verdict[] = ["TRUE", "FALSE", "MISLEADING", "UNVERIFIED"];

export const VERDICT_CONFIG: Record<Verdict, { color: string; className: string; label: string }> =
  {
    TRUE: { color: "var(--accent-green)", className: "verdict-true", label: "TRUE" },
    FALSE: { color: "#B91C1C", className: "verdict-false", label: "FALSE" },
    MISLEADING: {
      color: "var(--accent-amber)",
      className: "verdict-misleading",
      label: "MISLEADING",
    },
    UNVERIFIED: {
      color: "var(--accent-zinc)",
      className: "verdict-unverified",
      label: "UNVERIFIED",
    },
  };

export const PRESET_LABELS: Record<string, string> = {
  political: "Political Speech",
  news: "News Broadcast",
  earnings: "Earnings Call",
  general: "General",
  podcast: "Podcast / Talk",
};
