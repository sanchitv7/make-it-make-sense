'use client';

import React, { useEffect, useState } from 'react';
import { motion, type Variants, AnimatePresence } from 'framer-motion';
import { Mic, Search, ShieldCheck, ArrowRight, CheckCircle, XCircle, AlertTriangle, HelpCircle, Quote } from 'lucide-react';

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

  const VERDICTS = [
    { color: '#B91C1C',             icon: <XCircle size={20} strokeWidth={2} />,      label: 'FALSE'      },
    { color: 'var(--accent-green)', icon: <CheckCircle size={20} strokeWidth={2} />,  label: 'TRUE'       },
    { color: 'var(--accent-amber)', icon: <AlertTriangle size={20} strokeWidth={2} />, label: 'MISLEADING' },
    { color: 'var(--accent-zinc)',  icon: <HelpCircle size={20} strokeWidth={2} />,   label: 'UNVERIFIED' },
  ];

  type CardPhase = 'verifying' | 'resolved';
  type Card = { verdictIdx: number; phase: CardPhase; key: number };

  const cardKeyRef = React.useRef(0);
  const newCard = (verdictIdx: number): Card => ({ verdictIdx, phase: 'verifying', key: ++cardKeyRef.current });

  const [cards, setCards] = useState<Card[]>([
    newCard(0), newCard(1), newCard(2), newCard(3),
  ]);

  useEffect(() => {
    let cancelled = false;
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    const shuffled = () => [0,1,2,3].sort(() => Math.random() - 0.5);

    const run = () => {
      if (cancelled) return;
      const verdicts = shuffled();

      // Replace each card one by one with a fresh key (triggers exit/enter animation), staggered
      verdicts.forEach((v, i) => {
        timeouts.push(setTimeout(() => {
          if (cancelled) return;
          const card = newCard(v);
          setCards(prev => prev.map((c, idx) => idx === i ? card : c));

          // Resolve this card after verifying delay
          timeouts.push(setTimeout(() => {
            if (cancelled) return;
            setCards(prev => prev.map((c) => c.key === card.key ? { ...c, phase: 'resolved' } : c));
          }, 1800));
        }, i * 800));
      });

      // After last card resolved + hold, restart
      timeouts.push(setTimeout(run, 3 * 800 + 1800 + 2000));
    };

    timeouts.push(setTimeout(run, 400));
    return () => { cancelled = true; timeouts.forEach(clearTimeout); };
  }, []);

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

        {/* Live Demo — 2×2 fixed grid */}
        <motion.div variants={fadeUpVariants} className="w-full"
          style={{ border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-card)', borderRadius: 0, padding: '12px' }}
        >
          <div className="grid grid-cols-2 gap-3">
            {cards.map((card, i) => (
              <div key={i} style={{ height: '110px', position: 'relative', overflow: 'hidden' }}>
              <AnimatePresence mode="wait">
              <motion.div
                key={card.key}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-0 flex flex-col justify-between overflow-hidden"
                style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 0, padding: '14px 14px 14px 22px' }}
              >
                {/* left accent bar */}
                <motion.div
                  animate={{ backgroundColor: card.phase === 'resolved' ? VERDICTS[card.verdictIdx].color : 'var(--border-active)' }}
                  transition={{ duration: 0.6 }}
                  style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px' }}
                />

                {/* skeleton lines */}
                <div className="flex flex-col gap-2">
                  {[90, 68, 45].map((w, j) => (
                    <motion.div
                      key={j}
                      animate={card.phase === 'verifying' ? { opacity: [0.12, 0.36, 0.12] } : { opacity: 0.14 }}
                      transition={card.phase === 'verifying'
                        ? { repeat: Infinity, duration: 1.8, delay: j * 0.2, ease: 'easeInOut' }
                        : { duration: 0.5 }}
                      style={{ height: j === 0 ? '6px' : '4px', width: `${w}%`, backgroundColor: 'var(--text-muted)', borderRadius: 0 }}
                    />
                  ))}
                </div>

                {/* bottom: verifying label or verdict */}
                <div className="flex items-center justify-between">
                  <AnimatePresence mode="wait">
                    {card.phase === 'verifying' ? (
                      <motion.div key="v" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="flex items-center gap-1.5">
                        <motion.span
                          animate={{ opacity: [0.4, 1, 0.4] }}
                          transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
                          style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: 'var(--accent-red)', display: 'inline-block', flexShrink: 0 }}
                        />
                        <motion.span
                          className="font-[family:var(--font-mono)] uppercase tracking-widest"
                          animate={{ backgroundPosition: ['200% center', '-200% center'] }}
                          transition={{ repeat: Infinity, duration: 2.2, ease: 'linear' }}
                          style={{ fontSize: '0.55rem', background: 'linear-gradient(90deg, var(--text-muted) 20%, var(--accent-gold) 50%, var(--text-muted) 80%)', backgroundSize: '200% auto', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
                        >
                          Verifying…
                        </motion.span>
                      </motion.div>
                    ) : <span />}
                  </AnimatePresence>
                  <AnimatePresence mode="wait">
                    {card.phase === 'resolved' && (
                      <motion.div
                        key={`r-${card.verdictIdx}`}
                        initial={{ opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 350, damping: 24 }}
                        className="flex items-center gap-1.5 font-[family:var(--font-mono)] font-bold uppercase"
                        style={{ color: VERDICTS[card.verdictIdx].color, fontSize: '0.6rem', letterSpacing: '0.12em' }}
                      >
                        {VERDICTS[card.verdictIdx].icon}
                        <span>{VERDICTS[card.verdictIdx].label}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
              </AnimatePresence>
              </div>
            ))}
          </div>
        </motion.div>

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
