'use client';

import type { DetectedClaim, FactCheckResult, Verdict } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, AlertTriangle, HelpCircle, ExternalLink, Quote } from 'lucide-react';

interface ClaimCardProps {
  claim: DetectedClaim;
  result?: FactCheckResult;
  isChecking: boolean;
}

const VERDICT_CONFIG: Record<Verdict, { color: string; bg: string; icon: React.ReactNode; label: string; className: string }> = {
  TRUE:       { color: 'var(--accent-green)', bg: 'rgba(52,211,153,0.15)',  icon: <CheckCircle  size={16} strokeWidth={2} />, label: 'TRUE',       className: 'verdict-true'       },
  FALSE:      { color: '#B91C1C',             bg: 'rgba(185,28,28,0.1)',   icon: <XCircle      size={16} strokeWidth={2} />, label: 'FALSE',      className: 'verdict-false'      },
  MISLEADING: { color: 'var(--accent-amber)', bg: 'rgba(251,191,36,0.15)', icon: <AlertTriangle size={16} strokeWidth={2} />, label: 'MISLEADING', className: 'verdict-misleading' },
  UNVERIFIED: { color: 'var(--accent-zinc)',  bg: 'rgba(107,114,128,0.15)',icon: <HelpCircle   size={16} strokeWidth={2} />, label: 'UNVERIFIED',  className: 'verdict-unverified' },
};

const formatTimestamp = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export function ClaimCard({ claim, result, isChecking }: ClaimCardProps) {
  const config = result ? VERDICT_CONFIG[result.verdict] : null;
  const accentColor = config ? config.color : isChecking ? 'var(--accent-blue)' : 'var(--border-active)';

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="relative w-full"
    >
      <div
        className="relative overflow-hidden"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 0,
          padding: 'clamp(16px, 4vw, 28px) clamp(16px, 4vw, 28px) clamp(16px, 4vw, 28px) clamp(24px, 5vw, 40px)',
          boxShadow: 'var(--card-shadow)',
        }}
      >
        {/* Left Accent Bar */}
        <motion.div
          animate={{ backgroundColor: accentColor }}
          transition={{ duration: 0.4 }}
          className="absolute left-0 top-0 bottom-0"
          style={{ width: '3px' }}
        />

        {/* Content */}
        <div className="relative flex flex-col gap-4" style={{ zIndex: 1 }}>
          {/* Top row: quote icon (left) + timestamp (right) */}
          <div className="flex items-start justify-between">
            <span className="pointer-events-none select-none" style={{ color: 'var(--accent-gold)', opacity: 0.4 }}>
              <Quote size={32} strokeWidth={1.5} style={{ transform: 'scaleX(-1)' }} />
            </span>
            <div className="font-[family:var(--font-mono)] text-[var(--text-muted)]" style={{ fontSize: '0.65rem' }}>
              {formatTimestamp(claim.timestamp_seconds)}
            </div>
          </div>

          {/* Claim Text */}
          <p
            className="font-[family:var(--font-display)] text-[var(--text-primary)]"
            style={{ fontStyle: 'italic', fontSize: 'clamp(1.1rem, 3.5vw, 1.45rem)', lineHeight: 1.6 }}
          >
            &#x201C;{claim.claim_text}&#x201D;
          </p>

          {/* Bottom: summary/source + verdict badge bottom-right */}
          <AnimatePresence mode="wait">
            {result ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col gap-2"
              >
                {result.verdict_summary && (
                  <p
                    className="font-[family:var(--font-body)] text-[var(--text-secondary)]"
                    style={{ fontSize: '1rem', lineHeight: 1.65 }}
                  >
                    {result.verdict_summary}
                  </p>
                )}

                <div className="flex items-center justify-between gap-4 mt-1">
                  {result.source_name ? (
                    <a
                      href={result.source_url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 hover:underline underline-offset-2 font-[family:var(--font-mono)]"
                      style={{ color: 'var(--accent-blue)', fontSize: '0.8rem' }}
                    >
                      <ExternalLink size={14} strokeWidth={2} />
                      {result.source_name}
                    </a>
                  ) : <span />}

                  {/* Verdict badge — prominent bottom-right */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 font-[family:var(--font-mono)] uppercase font-bold ${config!.className}`}
                    style={{ borderRadius: 0, fontSize: '0.8rem', letterSpacing: '0.15em' }}
                  >
                    {config!.icon}
                    {config!.label}
                  </motion.div>
                </div>
              </motion.div>
            ) : isChecking ? (
              <motion.div
                key="checking"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-2"
              >
                {/* Skeleton lines */}
                {[100, 85, 60].map((widthPct, i) => (
                  <motion.div
                    key={i}
                    animate={{ opacity: [0.25, 0.6, 0.25] }}
                    transition={{ repeat: Infinity, duration: 1.6, delay: i * 0.15, ease: 'easeInOut' }}
                    style={{
                      height: '8px',
                      width: `${widthPct}%`,
                      backgroundColor: 'var(--border-active)',
                      borderRadius: 0,
                    }}
                  />
                ))}
                {/* Verifying label */}
                <div className="flex items-center gap-2.5 mt-3">
                  <motion.span
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
                    style={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: 'var(--accent-red)', display: 'inline-block', flexShrink: 0 }}
                  />
                  <motion.span
                    className="font-[family:var(--font-mono)] uppercase tracking-widest"
                    animate={{ backgroundPosition: ['200% center', '-200% center'] }}
                    transition={{ repeat: Infinity, duration: 2.4, ease: 'linear' }}
                    style={{
                      fontSize: '0.9rem',
                      background: 'linear-gradient(90deg, var(--text-muted) 20%, var(--accent-gold) 50%, var(--text-muted) 80%)',
                      backgroundSize: '200% auto',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      backgroundPosition: '200% center',
                    }}
                  >
                    Verifying…
                  </motion.span>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
