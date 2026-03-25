'use client';

import React from 'react';
import { motion, type TargetAndTransition } from 'framer-motion';

interface ListeningIndicatorProps {
  isConnected: boolean;
  isPaused: boolean;
}

export function ListeningIndicator({
  isConnected,
  isPaused,
}: ListeningIndicatorProps) {
  const getLineStyles = (): { color: string; opacity: number; animate: TargetAndTransition; backgroundImage?: string; backgroundSize?: string } => {
    if (!isConnected) {
      return { color: 'var(--text-muted)', opacity: 0.3, animate: {} };
    }
    if (isPaused) {
      return { color: 'var(--accent-amber)', opacity: 0.5, animate: {} };
    }
    return {
      color: 'var(--accent-red)',
      opacity: 1,
      animate: {
        backgroundPosition: ['0% 50%', '200% 50%'],
        transition: { duration: 3, repeat: Infinity, ease: 'linear' },
      },
      backgroundImage: `linear-gradient(90deg, transparent, rgba(139, 26, 43, 1), rgba(139, 26, 43, 0.8), transparent)`,
      backgroundSize: '200% 100%',
    };
  };

  const getStatusText = () => {
    if (!isConnected) return 'CONNECTING...';
    if (isPaused) return 'PAUSED';
    return 'LISTENING';
  };

  const styles = getLineStyles();

  return (
    <div className="w-full py-4 flex flex-col items-center justify-center gap-2">
      <div className="w-full relative bg-[var(--border-subtle)] overflow-hidden" style={{ height: '3px' }}>
        <motion.div
          className="absolute inset-0 w-full h-full"
          initial={false}
          animate={styles.animate}
          style={{
            backgroundColor: styles.backgroundImage ? undefined : styles.color,
            backgroundImage: styles.backgroundImage,
            backgroundSize: styles.backgroundSize,
            opacity: styles.opacity,
          }}
        />
      </div>

      <div className="flex items-center gap-2">
        {!isPaused && isConnected && (
          <motion.span
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--accent-red)', flexShrink: 0 }}
          />
        )}
        <span className="font-[family:var(--font-mono)] text-xs tracking-[0.2em] text-[var(--text-secondary)] uppercase">
          {getStatusText()}
        </span>
      </div>
    </div>
  );
}
