'use client';

import React from 'react';
import { motion, type Variants } from 'framer-motion';
import { Mic, Search, ShieldCheck, ArrowRight } from 'lucide-react';

interface SplashHeroProps {
  onBeginClick: () => void;
}

export function SplashHero({ onBeginClick }: SplashHeroProps) {
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15, delayChildren: 0.2 },
    },
  };

  const wordVariants: Variants = {
    hidden: { opacity: 0, y: 50 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
    },
  };

  const fadeUpVariants: Variants = {
    hidden: { opacity: 0, y: 40 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: 'easeOut' },
    },
  };

  const lineVariants = (index: number): Variants => ({
    hidden: { opacity: 0, scaleX: 0 },
    visible: {
      opacity: [0.3, 0.8, 0.3],
      scaleX: 1,
      transition: {
        repeat: Infinity,
        duration: 2 + index * 0.5,
        ease: 'easeInOut' as const,
        delay: 0.8 + index * 0.2,
      },
    },
  });

  const steps = [
    {
      num: '01',
      title: 'LISTEN',
      desc: 'Capture live audio from any source',
      icon: <Mic size={22} strokeWidth={2} />,
    },
    {
      num: '02',
      title: 'DETECT',
      desc: 'AI identifies factual claims in real time',
      icon: <Search size={22} strokeWidth={2} />,
    },
    {
      num: '03',
      title: 'VERIFY',
      desc: 'Each claim cross-referenced with live sources',
      icon: <ShieldCheck size={22} strokeWidth={2} />,
    },
  ];

  const headline = 'MAKE IT MAKE SENSE';

  return (
    <motion.section
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="relative min-h-screen w-full flex flex-col justify-center items-center bg-[var(--bg-primary)] px-6 md:px-12 py-20 overflow-hidden"
    >
      <div className="w-full max-w-[900px] flex flex-col items-start space-y-12">
        {/* Headline */}
        <motion.h1
          className="w-full text-[var(--text-primary)] font-[family:var(--font-display)] font-bold leading-none tracking-tight"
          style={{ fontSize: 'clamp(2.5rem, 8vw, 6rem)' }}
        >
          {headline.split(' ').map((word, i) => (
            <motion.span
              key={i}
              variants={wordVariants}
              className="inline-block mr-[0.3em] last:mr-0"
            >
              {word}
            </motion.span>
          ))}
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          variants={fadeUpVariants}
          className="text-[var(--text-secondary)] font-[family:var(--font-body)] text-xl md:text-2xl max-w-2xl leading-relaxed"
        >
          Real-time AI fact-checking for live audio
        </motion.p>

        {/* Abstract Visualization */}
        <div className="w-full space-y-4 py-8">
          {[0.85, 0.4, 0.9, 0.55, 0.3, 0.75, 0.45].map((width, i) => (
            <motion.div
              key={i}
              custom={i}
              variants={lineVariants(i)}
              className="h-[1px] bg-[var(--text-muted)] origin-left"
              style={{ width: `${width * 100}%` }}
            />
          ))}
        </div>

        {/* Editorial Divider */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] as [number, number, number, number], delay: 1 }}
          className="h-[1px] w-full origin-left"
          style={{ background: 'linear-gradient(to right, var(--accent-red), var(--accent-gold))' }}
        />

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 w-full pt-4">
          {steps.map((step, i) => (
            <motion.div
              key={step.num}
              variants={fadeUpVariants}
              transition={{ delay: 1.2 + i * 0.1 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-3">
                <span className="font-[family:var(--font-mono)] text-[var(--accent-gold)] text-xs tracking-widest">
                  {step.num}
                </span>
                <span className="text-[var(--text-muted)]">{step.icon}</span>
              </div>
              <h3 className="text-[var(--text-primary)] font-[family:var(--font-display)] font-bold text-xl tracking-wide">
                {step.title}
              </h3>
              <p className="text-[var(--text-secondary)] font-[family:var(--font-body)] text-base leading-relaxed">
                {step.desc}
              </p>
            </motion.div>
          ))}
        </div>

        {/* CTA Button */}
        <motion.div variants={fadeUpVariants} transition={{ delay: 1.8 }} className="pt-12">
          <motion.button
            onClick={onBeginClick}
            whileHover={{ x: 6 }}
            whileTap={{ scale: 0.97 }}
            className="inline-flex items-center gap-3 px-10 py-5 bg-[var(--accent-red)] text-white font-[family:var(--font-display)] font-bold uppercase tracking-[0.2em] text-sm cursor-pointer"
            style={{ borderRadius: 0 }}
          >
            Begin Session
            <ArrowRight size={20} strokeWidth={2} />
          </motion.button>
        </motion.div>
      </div>

      {/* Background asymmetric accent */}
      <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-[var(--bg-card)] to-transparent opacity-20 pointer-events-none" />
    </motion.section>
  );
}
