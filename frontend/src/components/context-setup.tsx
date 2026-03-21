"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ContextPreset, ContextPresetOption } from "@/types";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

const PRESETS: ContextPresetOption[] = [
  {
    key: "political",
    emoji: "🏛️",
    title: "Political Speech",
    description: "Statistics, historical facts, policy claims, economic figures",
  },
  {
    key: "news",
    emoji: "📰",
    title: "News Broadcast",
    description: "Figures, dates, attributed statements, reported events",
  },
  {
    key: "earnings",
    emoji: "📊",
    title: "Earnings Call",
    description: "Revenue, growth %, market share, product metrics",
  },
  {
    key: "podcast",
    emoji: "🎙️",
    title: "Podcast / Talk",
    description: "Statistics, historical events, scientific claims",
  },
];

export function ContextSetup() {
  const router = useRouter();
  const [selected, setSelected] = useState<ContextPreset | null>(null);
  const [contextDetail, setContextDetail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleStart = async () => {
    if (!selected) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context_preset: selected,
          context_detail: contextDetail || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to create session");
      const { session_id } = await res.json();
      router.push(`/session/${session_id}?preset=${selected}`);
    } catch (err) {
      console.error(err);
      setIsLoading(false);
    }
  };

  return (
    <div
      className="flex flex-col px-4 pt-safe-top pb-safe-bottom"
      style={{ minHeight: "100dvh" }}
    >
      <div
        className="w-full mx-auto flex flex-col flex-1 py-10"
        style={{ maxWidth: "512px" }}
      >
        {/* Header */}
        <div className="mb-8">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono tracking-wider uppercase mb-5"
            style={{
              background: "var(--glow-blue)",
              color: "var(--accent-blue)",
              border: "1px solid rgba(59,130,246,0.2)",
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"
            />
            Live Fact-Check
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">
            Make It{" "}
            <span style={{ color: "var(--accent-blue)" }}>Make Sense</span>
          </h1>
          <p
            className="text-base leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            Live fact-checking as you listen. Choose a context to begin.
          </p>
        </div>

        {/* Preset cards */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {PRESETS.map((preset) => (
            <button
              key={preset.key}
              onClick={() => setSelected(preset.key)}
              className="text-left p-4 rounded-xl border transition-all duration-200 cursor-pointer"
              style={{
                background:
                  selected === preset.key
                    ? "var(--bg-tertiary)"
                    : "var(--bg-card)",
                borderColor:
                  selected === preset.key
                    ? "var(--accent-blue)"
                    : "var(--border-subtle)",
                boxShadow:
                  selected === preset.key
                    ? "0 0 20px rgba(59,130,246,0.1)"
                    : "none",
              }}
            >
              <div className="text-xl mb-2">{preset.emoji}</div>
              <div className="font-semibold text-sm mb-1">{preset.title}</div>
              <div
                className="text-xs leading-relaxed"
                style={{ color: "var(--text-secondary)" }}
              >
                {preset.description}
              </div>
            </button>
          ))}
        </div>

        {/* Optional context */}
        <div className="mb-5">
          <input
            type="text"
            placeholder="Optional: speaker, topic, or other context…"
            value={contextDetail}
            onChange={(e) => setContextDetail(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-primary)",
            }}
          />
        </div>

        {/* Start button */}
        <button
          onClick={handleStart}
          disabled={!selected || isLoading}
          className="w-full flex items-center justify-center rounded-xl font-semibold text-sm transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            minHeight: "52px",
            background:
              selected && !isLoading ? "var(--accent-blue)" : "var(--bg-tertiary)",
            color: selected && !isLoading ? "#fff" : "var(--text-muted)",
            boxShadow:
              selected && !isLoading
                ? "0 0 24px rgba(59,130,246,0.25)"
                : "none",
          }}
        >
          {isLoading ? "Creating session…" : "Start Listening"}
        </button>
      </div>
    </div>
  );
}
