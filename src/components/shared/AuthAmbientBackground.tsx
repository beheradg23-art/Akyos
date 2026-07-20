import React from 'react';
import { GlyphMatrix } from '../ui/GlyphMatrix';

// The exact same background behind the real sign-in card (stage === 'auth'
// in AuthGate.tsx): a radially-masked, faded GlyphMatrix canvas — a grid of
// mutating monospace glyphs. Reused here for the auth flow's other blank
// single-card stages (Welcome Back, age gate, parental consent, passcode
// setup/recovery, etc.), which otherwise had nothing behind the card but
// flat bg-zinc-950. Pure decoration: pointer-events-none, and pinned behind
// everything else in its (already fixed/positioned) parent via -z-10.
export function AuthAmbientBackground({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 -z-10 overflow-hidden opacity-[0.14] ${className}`}
      style={{
        maskImage: 'radial-gradient(ellipse 70% 60% at 50% 42%, #000 35%, transparent 100%)',
        WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 42%, #000 35%, transparent 100%)',
      }}
    >
      <GlyphMatrix
        glyphs="01·•+*/\<>="
        cellSize={14}
        mutationRate={0.04}
        interval={90}
        fadeBottom={0.7}
        color="#a78bfa"
        className="h-full w-full"
      />
    </div>
  );
}
