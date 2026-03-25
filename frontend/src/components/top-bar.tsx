'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, AlertTriangle, HelpCircle, Square, Play, Pause, Radio } from 'lucide-react';
import type { Verdict } from '@/types';
import { ListeningIndicator } from '@/components/listening-indicator';

interface TopBarProps {
  isConnected: boolean;
  isPaused: boolean;
  verdictCounts: Record<Verdict, number>;
  totalClaims: number;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

export function TopBar({
  isConnected,
  isPaused,
  verdictCounts,
  totalClaims,
  onPause,
  onResume,
  onStop,
}: TopBarProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isConnected && !isPaused) {
      interval = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isConnected, isPaused]);

  useEffect(() => {
    if (!isConnected) {
      setElapsed(0);
    }
  }, [isConnected]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return [hrs, mins, secs].map((v) => v.toString().padStart(2, '0')).join(':');
  };

  const hasVerdicts = Object.values(verdictCounts).some(count => count > 0);

  return (
    <header className='sticky top-0 z-50 w-full bg-[var(--bg-card)] border-t-[6px] border-[var(--border-active)]' style={{ borderRadius: 0 }}>
      <div className='flex items-center justify-between px-4 py-3 md:px-6'>
        <div className='flex items-baseline overflow-hidden'>
          <h1
            className='font-[family:var(--font-display)] font-black tracking-tighter text-[var(--text-primary)] leading-none select-none whitespace-nowrap'
            style={{ fontSize: 'clamp(1.8rem, 4.5vw, 3rem)', borderRadius: 0 }}
          >
            <span className='hidden sm:inline'>MAKE IT MAKE SENSE</span>
            <span className='sm:hidden'>M·I·M·S</span>
          </h1>
        </div>

        <div className='flex items-center gap-4 md:gap-8'>
          <div className='flex items-center gap-3 font-[family:var(--font-mono)] tabular-nums'>
            <AnimatePresence mode='wait'>
              {isConnected ? (
                <motion.div
                  key="connected"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className='flex items-center gap-3 text-xs md:text-sm font-bold'
                >
                  <div className='flex items-center gap-1.5'>
                    <motion.div
                      animate={isPaused ? { opacity: 1 } : { opacity: [1, 0.4, 1] }}
                      transition={isPaused ? { duration: 0 } : { repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
                      className='flex items-center justify-center'
                    >
                      <Radio
                        size={12}
                        className={isPaused ? 'text-[var(--accent-amber)]' : 'text-[#B91C1C]'}
                      />
                    </motion.div>
                    <span className={isPaused ? 'text-[var(--accent-amber)]' : 'text-[#B91C1C]'}>
                      {isPaused ? 'PAUSED' : 'LIVE'}
                    </span>
                  </div>
                  <span className='text-[var(--text-primary)] border-l border-[var(--border-subtle)] pl-3 inline-block w-[5.5ch]'>
                    {formatTime(elapsed)}
                  </span>
                </motion.div>
              ) : (
                <motion.span
                  key="offline"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className='text-[var(--text-muted)] text-xs uppercase tracking-widest font-bold'
                >
                  OFFLINE
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          <div className='flex items-center gap-1 border-l border-[var(--border-active)] pl-4'>
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={isPaused ? onResume : onPause}
              disabled={!isConnected}
              className='h-8 w-8 flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--text-primary)] hover:text-[var(--bg-card)] transition-colors border border-[var(--border-active)] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer'
              aria-label={isPaused ? 'Resume' : 'Pause'}
              style={{ borderRadius: 0 }}
            >
              {isPaused ? <Play size={16} strokeWidth={2} /> : <Pause size={16} strokeWidth={2} />}
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={onStop}
              className='h-8 flex items-center gap-1.5 px-3 font-[family:var(--font-mono)] text-xs tracking-widest uppercase text-white cursor-pointer hover:opacity-80 transition-opacity'
              aria-label='End Session'
              style={{ borderRadius: 0, backgroundColor: '#B91C1C' }}
            >
              <Square size={14} strokeWidth={2} />
              <span>END</span>
            </motion.button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isConnected && hasVerdicts && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className='overflow-hidden border-t border-[var(--border-subtle)]'
          >
            <div className='flex divide-x divide-[var(--border-subtle)] text-[10px] md:text-xs font-[family:var(--font-mono)] uppercase tracking-tighter md:tracking-widest text-[var(--text-secondary)]'>
              <div
                className='px-3 py-1.5 flex items-center gap-2 font-black text-[var(--bg-card)]'
                style={{ backgroundColor: 'var(--text-primary)', borderRadius: 0 }}
              >
                VERDICTS
              </div>
              <div className='px-3 py-1.5 flex items-center gap-2 flex-1 sm:flex-none'>
                <span className='text-[var(--text-muted)]'>CLAIMS:</span>
                <motion.span
                  key={totalClaims}
                  initial={{ opacity: 0.5 }}
                  animate={{ opacity: 1 }}
                  className='text-[var(--text-primary)] font-bold'
                >
                  {totalClaims}
                </motion.span>
              </div>
              <div className='px-3 py-1.5 flex items-center gap-2'>
                <CheckCircle size={13} className='text-[var(--accent-green)]' />
                <span className='hidden md:inline text-[var(--text-muted)]'>TRUE:</span>
                <motion.span key={verdictCounts.TRUE} initial={{ scale: 1.2 }} animate={{ scale: 1 }} className='text-[var(--text-primary)] font-bold'>
                  {verdictCounts.TRUE}
                </motion.span>
              </div>
              <div className='px-3 py-1.5 flex items-center gap-2'>
                <XCircle size={13} style={{ color: '#B91C1C' }} />
                <span className='hidden md:inline text-[var(--text-muted)]'>FALSE:</span>
                <motion.span key={verdictCounts.FALSE} initial={{ scale: 1.2 }} animate={{ scale: 1 }} className='text-[var(--text-primary)] font-bold'>
                  {verdictCounts.FALSE}
                </motion.span>
              </div>
              <div className='px-3 py-1.5 flex items-center gap-2'>
                <AlertTriangle size={13} className='text-[var(--accent-amber)]' />
                <span className='hidden md:inline text-[var(--text-muted)]'>MISLEADING:</span>
                <motion.span key={verdictCounts.MISLEADING} initial={{ scale: 1.2 }} animate={{ scale: 1 }} className='text-[var(--text-primary)] font-bold'>
                  {verdictCounts.MISLEADING}
                </motion.span>
              </div>
              <div className='px-3 py-1.5 flex items-center gap-2'>
                <HelpCircle size={13} className='text-[var(--text-muted)]' />
                <span className='hidden md:inline text-[var(--text-muted)]'>UNVERIFIED:</span>
                <motion.span key={verdictCounts.UNVERIFIED} initial={{ scale: 1.2 }} animate={{ scale: 1 }} className='text-[var(--text-primary)] font-bold'>
                  {verdictCounts.UNVERIFIED}
                </motion.span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <ListeningIndicator isConnected={isConnected} isPaused={isPaused} />
    </header>
  );
}
