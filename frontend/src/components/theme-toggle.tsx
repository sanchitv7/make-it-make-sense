'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { motion } from 'framer-motion';

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark') {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    }
  }, []);

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  return (
    <motion.button
      onClick={toggle}
      whileTap={{ scale: 0.95 }}
      className="fixed bottom-4 right-4 z-50 flex items-center gap-1.5 px-2.5 py-1.5 font-[family:var(--font-mono)] text-xs uppercase tracking-widest cursor-pointer transition-colors"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 0,
        color: 'var(--text-secondary)',
        boxShadow: 'var(--card-shadow)',
      }}
      aria-label="Toggle theme"
    >
      {isDark ? <Sun size={14} strokeWidth={2} /> : <Moon size={14} strokeWidth={2} />}
      {isDark ? 'Light' : 'Dark'}
    </motion.button>
  );
}
