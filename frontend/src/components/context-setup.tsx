"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Landmark, Newspaper, MessageSquare, Mic2, ArrowRight } from "lucide-react";
import type { ContextPreset, ContextPresetOption } from "@/types";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

const PRESETS: (ContextPresetOption & { icon: React.ReactNode })[] = [
  {
    key: 'political',
    emoji: '',
    title: 'Political Speech',
    description: 'Statistics, historical facts, policy claims, economic figures',
    icon: <Landmark size={22} strokeWidth={2} />,
  },
  {
    key: 'news',
    emoji: '',
    title: 'News Broadcast',
    description: 'Figures, dates, attributed statements, reported events',
    icon: <Newspaper size={22} strokeWidth={2} />,
  },
  {
    key: 'general',
    emoji: '',
    title: 'General Conversation',
    description: 'Statistics, history, science, health, geography, attribution',
    icon: <MessageSquare size={22} strokeWidth={2} />,
  },
  {
    key: 'podcast',
    emoji: '',
    title: 'Podcast / Talk',
    description: 'Statistics, historical events, scientific claims',
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
      className="min-h-screen w-full flex items-center justify-center px-6 md:px-12 py-20"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      <motion.div
        className="w-full max-w-[900px] flex flex-col gap-12"
        variants={containerVariants}
        initial="initial"
        animate="animate"
      >
        <motion.header variants={itemVariants}>
          <h1 className="font-[family:var(--font-display)] font-bold text-[var(--text-primary)] text-[2rem] md:text-[2.5rem] leading-tight">
            Choose Your Context
          </h1>
          <p className="font-[family:var(--font-body)] text-[var(--text-secondary)] text-base mt-2">
            Select the type of audio you want to fact-check.
          </p>
        </motion.header>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
          variants={containerVariants}
        >
          {PRESETS.map((preset, index) => {
            const isSelected = selected === preset.key;
            return (
              <motion.button
                key={preset.key}
                variants={itemVariants}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => setSelected(preset.key)}
                className="group flex flex-col text-left p-6 cursor-pointer transition-colors duration-200"
                style={{
                  backgroundColor: isSelected ? 'var(--bg-tertiary)' : 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderLeft: isSelected ? '3px solid var(--accent-gold)' : '1px solid var(--border-subtle)',
                  borderRadius: 0,
                }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="font-[family:var(--font-mono)] text-[var(--accent-gold)] text-xs tracking-widest">
                    {(index + 1).toString().padStart(2, '0')}
                  </span>
                  <span className="text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] transition-colors">
                    {preset.icon}
                  </span>
                </div>
                <div className="w-full h-[1px] mb-4" style={{ background: 'linear-gradient(to right, var(--border-active), transparent)' }} />
                <h3 className="font-[family:var(--font-display)] font-bold text-[var(--text-primary)] text-lg mb-2">
                  {preset.title}
                </h3>
                <p className="font-[family:var(--font-body)] text-[var(--text-secondary)] text-sm leading-relaxed">
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
            className="w-full py-3 bg-transparent outline-none font-[family:var(--font-body)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] placeholder:italic transition-colors"
            style={{
              borderBottom: '1px solid var(--border-subtle)',
              borderRadius: 0,
            }}
          />

          <motion.button
            whileHover={selected && !isLoading ? { x: 4 } : {}}
            whileTap={selected && !isLoading ? { scale: 0.98 } : {}}
            disabled={!selected || isLoading}
            onClick={handleStart}
            className="w-full h-14 inline-flex items-center justify-center gap-3 font-[family:var(--font-display)] font-bold uppercase tracking-[0.2em] text-sm cursor-pointer disabled:cursor-not-allowed transition-colors duration-200"
            style={{
              borderRadius: 0,
              backgroundColor: selected && !isLoading ? 'var(--accent-red)' : 'var(--bg-card)',
              color: selected && !isLoading ? '#FFFFFF' : 'var(--text-muted)',
              border: '1px solid',
              borderColor: selected && !isLoading ? 'transparent' : 'var(--border-subtle)',
              opacity: !selected || isLoading ? 0.6 : 1,
            }}
          >
            {isLoading ? 'STARTING...' : 'BEGIN LISTENING'}
            {!isLoading && <ArrowRight size={16} strokeWidth={2} />}
          </motion.button>
        </motion.div>
      </motion.div>
    </div>
  );
}
