"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Landmark, Newspaper, MessageSquare, Mic2, ArrowRight } from "lucide-react";
import type { ContextPreset, ContextPresetOption } from "@/types";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api";

const PRESETS: (ContextPresetOption & { icon: React.ReactNode })[] = [
  {
    key: "political",
    emoji: "",
    title: "Political Speech",
    description: "Statistics, historical facts, policy claims, economic figures",
    icon: <Landmark size={22} strokeWidth={2} />,
  },
  {
    key: "news",
    emoji: "",
    title: "News Broadcast",
    description: "Figures, dates, attributed statements, reported events",
    icon: <Newspaper size={22} strokeWidth={2} />,
  },
  {
    key: "general",
    emoji: "",
    title: "General Conversation",
    description: "Statistics, history, science, health, geography, attribution",
    icon: <MessageSquare size={22} strokeWidth={2} />,
  },
  {
    key: "podcast",
    emoji: "",
    title: "Podcast / Talk",
    description: "Statistics, historical events, scientific claims",
    icon: <Mic2 size={22} strokeWidth={2} />,
  },
];

const containerVariants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
};

const itemVariants = {
  initial: { opacity: 0, y: 20 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  },
};

export function ContextSetup() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [selected, setSelected] = useState<ContextPreset | null>(null);
  const [contextDetail, setContextDetail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleStart = async () => {
    if (!selected || !accessToken) return;
    setIsLoading(true);
    try {
      const res = await apiFetch("/api/session", accessToken, {
        method: "POST",
        body: JSON.stringify({
          context_preset: selected,
          context_detail: contextDetail || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to create session");
      const { session_id } = await res.json();
      const params = new URLSearchParams({ preset: selected });
      if (contextDetail) params.set("context", contextDetail);
      router.push(`/session/${session_id}?${params.toString()}`);
    } catch (err) {
      console.error(err);
      setIsLoading(false);
    }
  };

  return (
    <div
      className="flex min-h-screen w-full items-center justify-center px-6 pt-28 pb-20 md:px-12 md:pt-32"
      style={{ backgroundColor: "var(--bg-primary)" }}
    >
      <motion.div
        className="flex w-full max-w-[900px] flex-col gap-12"
        variants={containerVariants}
        initial="initial"
        animate="animate"
      >
        <motion.header variants={itemVariants}>
          <h1 className="text-[2rem] leading-tight font-[family:var(--font-display)] font-bold text-[var(--text-primary)] md:text-[2.5rem]">
            What are you listening to?
          </h1>
          <p className="mt-2 text-base font-[family:var(--font-body)] text-[var(--text-secondary)]">
            Pick a setting so we know which claims matter most.
          </p>
        </motion.header>

        <motion.div className="grid grid-cols-1 gap-4 md:grid-cols-2" variants={containerVariants}>
          {PRESETS.map((preset, index) => {
            const isSelected = selected === preset.key;
            return (
              <motion.button
                key={preset.key}
                variants={itemVariants}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => setSelected(preset.key)}
                className="group flex cursor-pointer flex-col p-6 text-left transition-colors duration-200"
                style={{
                  backgroundColor: isSelected ? "var(--bg-tertiary)" : "var(--bg-card)",
                  border: "1px solid var(--border-subtle)",
                  borderLeft: isSelected
                    ? "3px solid var(--accent-gold)"
                    : "1px solid var(--border-subtle)",
                  borderRadius: 0,
                }}
              >
                <div className="mb-4 flex items-center gap-3">
                  <span className="text-xs font-[family:var(--font-mono)] tracking-widest text-[var(--accent-gold)]">
                    {(index + 1).toString().padStart(2, "0")}
                  </span>
                  <span className="text-[var(--text-muted)] transition-colors group-hover:text-[var(--text-secondary)]">
                    {preset.icon}
                  </span>
                </div>
                <div
                  className="mb-4 h-[1px] w-full"
                  style={{
                    background: "linear-gradient(to right, var(--border-active), transparent)",
                  }}
                />
                <h3 className="mb-2 text-lg font-[family:var(--font-display)] font-bold text-[var(--text-primary)]">
                  {preset.title}
                </h3>
                <p className="text-sm leading-relaxed font-[family:var(--font-body)] text-[var(--text-secondary)]">
                  {preset.description}
                </p>
              </motion.button>
            );
          })}
        </motion.div>

        <motion.div variants={itemVariants} className="flex flex-col gap-8">
          <input
            type="text"
            value={contextDetail}
            onChange={(e) => setContextDetail(e.target.value)}
            placeholder="Speaker, topic, or additional context..."
            className="w-full bg-transparent py-3 font-[family:var(--font-body)] text-[var(--text-primary)] transition-colors outline-none placeholder:text-[var(--text-muted)] placeholder:italic"
            style={{
              borderBottom: "1px solid var(--border-subtle)",
              borderRadius: 0,
            }}
          />

          <motion.button
            whileHover={selected && !isLoading ? { x: 4 } : {}}
            whileTap={selected && !isLoading ? { scale: 0.98 } : {}}
            disabled={!selected || isLoading}
            onClick={handleStart}
            className="inline-flex h-14 w-full cursor-pointer items-center justify-center gap-3 text-sm font-[family:var(--font-display)] font-bold tracking-[0.2em] uppercase transition-colors duration-200 disabled:cursor-not-allowed"
            style={{
              borderRadius: 0,
              backgroundColor: selected && !isLoading ? "var(--accent-red)" : "var(--bg-card)",
              color: selected && !isLoading ? "#FFFFFF" : "var(--text-muted)",
              border: "1px solid",
              borderColor: selected && !isLoading ? "transparent" : "var(--border-subtle)",
              opacity: !selected || isLoading ? 0.6 : 1,
            }}
          >
            {isLoading ? "STARTING..." : "BEGIN LISTENING"}
            {!isLoading && <ArrowRight size={16} strokeWidth={2} />}
          </motion.button>
        </motion.div>
      </motion.div>
    </div>
  );
}
