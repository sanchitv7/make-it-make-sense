'use client';

import { motion, type TargetAndTransition } from 'framer-motion';

interface ListeningIndicatorProps {
  isConnected: boolean;
  isPaused: boolean;
}

export function ListeningIndicator({
  isConnected,
  isPaused,
}: ListeningIndicatorProps) {
  const getLineStyles = (): { color: string; opacity: number; animate: TargetAndTransition; backgroundImage?: string; backgroundSize?: string; glow?: string } => {
    if (!isConnected) {
      return { color: 'var(--text-muted)', opacity: 0.3, animate: {} };
    }
    if (isPaused) {
      return { color: 'var(--accent-amber)', opacity: 0.6, animate: {}, glow: '0 0 8px rgba(251,191,36,0.4)' };
    }
    return {
      color: 'var(--accent-red)',
      opacity: 1,
      animate: {
        backgroundPosition: ['0% 50%', '200% 50%'],
        transition: { duration: 3, repeat: Infinity, ease: 'linear' },
      },
      backgroundImage: `linear-gradient(90deg, transparent, rgba(185, 28, 28, 1), rgba(185, 28, 28, 0.9), transparent)`,
      backgroundSize: '200% 100%',
      glow: '0 0 10px rgba(185,28,28,0.5)',
    };
  };

  const styles = getLineStyles();

  return (
    <div className="w-full">
      <motion.div
        className="w-full relative bg-[var(--border-active)] overflow-hidden"
        animate={{ boxShadow: styles.glow || 'none' }}
        transition={{ duration: 0.4 }}
        style={{ height: '3px' }}
      >
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
      </motion.div>
    </div>
  );
}
