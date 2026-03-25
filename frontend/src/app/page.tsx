'use client';

import { SplashHero } from '@/components/splash-hero';
import { ContextSetup } from '@/components/context-setup';

export default function Home() {
  const handleBeginClick = () => {
    document.getElementById('setup-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <main>
      <SplashHero onBeginClick={handleBeginClick} />
      <div id="setup-section">
        <ContextSetup />
      </div>
    </main>
  );
}
