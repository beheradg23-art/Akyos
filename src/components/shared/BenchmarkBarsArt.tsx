// A looping 3D bar-chart visual for the sign-in page's left panel —
// replaces the old "1% Better Every Day." panel readout. Columns of
// varying height continuously morph between an "arc" formation and an
// "M" formation (echoing a benchmark-style hero visual), rendered with
// the app's own liquid violet/indigo/fuchsia gradient treatment
// (see lib/liquidFill.ts) rather than a flat static bar chart, so it
// reads as the same brand material as every other glowing surface in
// the app instead of a one-off illustration.
import React, { useMemo } from 'react';
import { AkyosMark } from './AkyosMark';
import { LIQUID_GRADIENT_KEYFRAMES, LIQUID_ANIMATION } from '../../lib/liquidFill';

const BAR_COUNT = 11;
const BAR_WIDTH = 26; // px
const BAR_GAP = 14; // px
const STAGE_HEIGHT = 300; // px — height the tallest bar can reach
const MORPH_DURATION_S = 9; // one full arc -> M -> arc cycle

// Two target formations the bars morph between, each a 0..1 fraction of
// STAGE_HEIGHT: a single smooth arch, and a twin-peak "M" with a dip in
// the middle — the same pairing as the reference benchmark-art piece.
const ARC_FORMATION = [0.22, 0.38, 0.56, 0.74, 0.88, 0.96, 0.88, 0.74, 0.56, 0.38, 0.22];
const M_FORMATION = [0.28, 0.52, 0.82, 0.58, 0.34, 0.24, 0.34, 0.58, 0.82, 0.52, 0.28];

// Small forward/back push (px) per formation, applied as translateZ
// under the group's perspective — the arc's peak bulges gently toward
// the viewer, the M pulls back a touch at its central dip. Subtle on
// purpose; this is a light 3D cue; not a full isometric scene.
const ARC_DEPTH = [0, 4, 9, 14, 18, 20, 18, 14, 9, 4, 0];
const M_DEPTH = [2, 6, 12, 7, 3, 0, 3, 7, 12, 6, 2];

// Alternating accent used as each bar's top glow — cycles blue → violet
// → fuchsia so neighbouring columns catch slightly different light
// (the "prismatic" quality of the reference piece), while every bar's
// base gradient still resolves down into the app's own indigo/violet.
const ACCENTS = ['#7dd3fc', '#93c5fd', '#a78bfa', '#c084fc', '#f0abfc'];

function buildBarKeyframes(index: number): { name: string; css: string } {
  const name = `akyos-bench-bar-${index}`;
  const arcH = (ARC_FORMATION[index] * 100).toFixed(1);
  const mH = (M_FORMATION[index] * 100).toFixed(1);
  const arcZ = ARC_DEPTH[index];
  const mZ = M_DEPTH[index];
  const css = `
    @keyframes ${name} {
      0%, 22% { height: ${arcH}%; transform: translateZ(${arcZ}px); }
      50%, 78% { height: ${mH}%; transform: translateZ(${mZ}px); }
      100% { height: ${arcH}%; transform: translateZ(${arcZ}px); }
    }
  `;
  return { name, css };
}

export function BenchmarkBarsArt() {
  const bars = useMemo(
    () =>
      Array.from({ length: BAR_COUNT }, (_, i) => {
        const { name, css } = buildBarKeyframes(i);
        const accent = ACCENTS[i % ACCENTS.length];
        // Negative delay staggers each bar into a different point of the
        // same cycle so the morph reads as a wave passing through the
        // row rather than every column snapping in lockstep.
        const delay = -((i * MORPH_DURATION_S) / BAR_COUNT);
        return { index: i, keyframeName: name, keyframeCss: css, accent, delay };
      }),
    []
  );

  const stageWidth = BAR_COUNT * BAR_WIDTH + (BAR_COUNT - 1) * BAR_GAP;

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-zinc-950 px-6">
      <style>{LIQUID_GRADIENT_KEYFRAMES}</style>
      <style>{bars.map((b) => b.keyframeCss).join('\n')}</style>

      {/* Soft ambient glow behind the whole scene, matching the badge's
          own violet glow elsewhere in the app rather than a plain flat
          black backdrop. */}
      <div
        aria-hidden
        className="pointer-events-none absolute h-[420px] w-[420px] rounded-full bg-violet-600/20 blur-[100px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute h-[280px] w-[420px] translate-y-16 rounded-full bg-indigo-500/10 blur-[90px]"
      />

      {/* The bar stage itself, tilted slightly in 3D via perspective so
          the columns read as extruded blocks rather than flat rects. */}
      <div
        className="relative"
        style={{
          width: stageWidth,
          height: STAGE_HEIGHT,
          perspective: '1100px',
        }}
      >
        <div
          className="flex h-full items-end"
          style={{
            gap: BAR_GAP,
            transformStyle: 'preserve-3d',
            transform: 'rotateX(20deg) rotateY(-6deg)',
          }}
        >
          {bars.map((bar) => (
            <div
              key={bar.index}
              className="relative rounded-t-md"
              style={{
                width: BAR_WIDTH,
                backgroundImage:
                  `linear-gradient(100deg, transparent 8%, rgba(255,255,255,0.16) 28%, rgba(255,255,255,0.30) 42%, rgba(255,255,255,0.30) 50%, rgba(255,255,255,0.16) 58%, transparent 78%), ` +
                  `linear-gradient(180deg, ${bar.accent} 0%, #a78bfa 32%, #7c3aed 62%, #4f46e5 100%)`,
                backgroundSize: '340% 340%, 100% 220%',
                backgroundPosition: '0% 50%, 0% 100%',
                boxShadow: `0 0 22px -4px ${bar.accent}99, 0 0 44px -12px rgba(124,58,237,0.55)`,
                animation: `${bar.keyframeName} ${MORPH_DURATION_S}s ease-in-out infinite ${bar.delay}s, ${LIQUID_ANIMATION}`,
                transformStyle: 'preserve-3d',
              }}
            >
              {/* Bright top cap, echoing the reference art's glossy
                  column tops catching the light. */}
              <div
                aria-hidden
                className="absolute inset-x-0 top-0 h-1.5 rounded-t-md"
                style={{ background: bar.accent, opacity: 0.85, filter: 'blur(0.5px)' }}
              />
            </div>
          ))}
        </div>

        {/* Floor reflection: a soft, faded mirror of the bars fading
            into black, same idea as the reference piece's glowing
            floor rather than the columns just stopping dead. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-24 translate-y-full"
          style={{
            background: 'linear-gradient(180deg, rgba(124,58,237,0.16) 0%, transparent 80%)',
            maskImage: 'linear-gradient(180deg, black, transparent)',
            WebkitMaskImage: 'linear-gradient(180deg, black, transparent)',
          }}
        />
      </div>

      {/* Small static wordmark beneath — keeps the panel identifiably
          "Akyos" now that the animated counter/wordmark beat is gone,
          without competing with the looping bars for attention. */}
      <div className="relative mt-14 flex items-center gap-2 opacity-80">
        <AkyosMark className="h-4 w-4 text-neutral-500" />
        <span className="text-[12px] font-medium tracking-wide text-neutral-500">Akyos</span>
      </div>
    </div>
  );
}

export default BenchmarkBarsArt;
