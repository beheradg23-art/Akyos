import React from 'react';

// A faint, tiled grid of the Akyos glyph (same mark as AkyosMark) sitting
// behind the auth flow's single-card stages — Welcome Back, age gate,
// parental consent, passcode setup/recovery, etc. Those are all just a
// small card centered on a big flat bg-zinc-950 rect, which is what read as
// "too much blank". This is pure decoration: pointer-events-none, and
// pinned behind everything else in its (already fixed/positioned) parent
// via -z-10, so it never has to be threaded through each stage's own
// z-index or interaction logic — drop it in as the first child and forget
// it. Rendered as one inline SVG pattern rather than N mapped React nodes,
// since some of these stages tile it across the full viewport.
export function GlyphMatrixBackground({ className = '' }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-0 -z-10 overflow-hidden ${className}`} aria-hidden="true">
      <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern
            id="akyos-glyph-matrix"
            width="72"
            height="72"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-10)"
          >
            <g fill="#a78bfa" opacity="0.05" transform="translate(18,10) scale(0.085) translate(-85,-231)">
              <path d="M173.7533,403.3044,85.308,580.195h106.15l106.17-212.34H231.1116A64.1286,64.1286,0,0,0,173.7533,403.3044Z" />
              <path d="M311.0844,261.695H244.568l159.25,318.5h106.15L368.4427,297.1444A64.1286,64.1286,0,0,0,311.0844,261.695Z" />
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#akyos-glyph-matrix)" />
      </svg>
    </div>
  );
}
