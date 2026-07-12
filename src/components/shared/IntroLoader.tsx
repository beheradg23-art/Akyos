// One-time animated splash screen shown while the app boots (progress line
// + upward curtain wipe reveal).
import React, { useState, useEffect } from 'react';
import { GraduationCap, Settings, Save } from 'lucide-react';
import { liquidFillStyle } from '../../lib/liquidFill';

export function IntroLoader({ onFinish }) {
  const [percent, setPercent] = useState(0);
  const [phase, setPhase] = useState('loading'); // loading -> collapsing -> wiping -> done

  useEffect(() => {
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion) {
      setPhase('done');
      onFinish();
      return;
    }

    const duration = 1900;
    const start = performance.now();
    let raf;

    const tick = (now) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic — settles gently near 100
      setPercent(Math.round(eased * 100));
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setPhase('collapsing');
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase === 'collapsing') {
      const t1 = setTimeout(() => setPhase('wiping'), 260);
      return () => clearTimeout(t1);
    }
    if (phase === 'wiping') {
      const t2 = setTimeout(() => setPhase('done'), 820);
      return () => clearTimeout(t2);
    }
    if (phase === 'done') {
      onFinish();
    }
  }, [phase, onFinish]);

  const handleSkip = () => {
    if (phase === 'loading') setPhase('collapsing');
  };

  if (phase === 'done') return null;

  return (
    <div
      onClick={handleSkip}
      role="presentation"
      className={`fixed inset-0 z-[999] flex flex-col items-center justify-center bg-zinc-950 transition-transform duration-[820ms] ease-[cubic-bezier(0.76,0,0.24,1)] cursor-pointer ${
        phase === 'wiping' ? '-translate-y-full' : 'translate-y-0'
      }`}
    >
      <div
        className={`flex flex-col items-center transition-all duration-300 ease-out ${
          phase === 'loading' ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.97]'
        }`}
      >
        <div className="mb-5 flex h-9 w-9 items-center justify-center rounded-lg shadow-lg shadow-violet-500/20" style={liquidFillStyle({ animation: 'fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both' })}>
          <GraduationCap className="h-4.5 w-4.5 text-neutral-950" strokeWidth={2} />
        </div>

        <span
          className="mb-6 text-[10px] font-medium uppercase tracking-[0.35em] text-neutral-500 animate-fadeInUp"
          style={{ animationDelay: '70ms' }}
        >
          Akyos
        </span>

        <div className="flex items-start leading-none tabular-nums">
          <span
            className="font-extralight text-transparent bg-clip-text bg-gradient-to-br from-neutral-50 to-neutral-500"
            style={{ fontSize: 'clamp(3.25rem, 13vw, 6rem)' }}
          >
            {percent}
          </span>
          <span
            className="mt-1 font-extralight text-neutral-600"
            style={{ fontSize: 'clamp(1.1rem, 3.4vw, 1.75rem)' }}
          >
            %
          </span>
        </div>

        <div className="mt-6 h-px w-36 sm:w-52 overflow-hidden rounded-full bg-neutral-800">
          <div
            className="h-full transition-[width] duration-100 ease-linear"
            style={liquidFillStyle({ width: `${percent}%` })}
          />
        </div>

        <span
          className="mt-5 text-[10px] font-medium uppercase tracking-[0.3em] text-neutral-600 animate-fadeInUp"
          style={{ animationDelay: '150ms' }}
        >
          Your Answer to Chaos
        </span>
      </div>
    </div>
  );
}

// ---------- Config Editor (Settings Tab) ----------
// Makes TRACKER_ITEMS, TIMELINE, and TRAINING editable in-app instead of
// requiring a source-code edit every time the routine changes. Each editor
// keeps a local draft copy so nothing is written to the live config (and
// therefore to every other tab reading it) until "Save" is pressed.

