// Shared "liquid" animated gradient fill used across icon badges, primary
// buttons, avatars, and progress fills throughout the app (same treatment
// as AuthGate). Split out of the old App.tsx monolith so any component
// that wants the liquid-fill look can import it directly instead of
// relying on a function defined 1000+ lines away in the same file.
import React from 'react';

// --- shared "liquid" animated gradient fill (same treatment as AuthGate) --
//
// Every icon badge, primary button, avatar, and progress fill that used to
// be a flat static gradient (bg-gradient-to-br from-indigo-600 via-violet-
// 600 to-fuchsia-500) is filled with this instead: the brand color stops
// slowly drift via an animated background-position, and a soft diagonal
// light sheen is layered on top (as a second background-image) so it
// periodically glides across the shape for a glossy, liquid feel — all on
// one element, no extra DOM needed. The shine layer is built from several
// close, low-contrast stops (rather than a hard jump straight to a bright
// peak) so it reads as a gentle glow passing through, not a visible seam.
export const LIQUID_GRADIENT_KEYFRAMES = `
  @keyframes akyos-liquid-fill {
    0%   { background-position: 0% 50%, 0% 50%; }
    50%  { background-position: 100% 50%, 100% 50%; }
    100% { background-position: 0% 50%, 0% 50%; }
  }
`;
export const LIQUID_ANIMATION = 'akyos-liquid-fill 6s ease-in-out infinite';
export const LIQUID_GRADIENT_FILL: React.CSSProperties = {
  backgroundImage:
    'linear-gradient(100deg, transparent 8%, rgba(255,255,255,0.16) 28%, rgba(255,255,255,0.30) 42%, rgba(255,255,255,0.30) 50%, rgba(255,255,255,0.16) 58%, transparent 78%), ' +
    'linear-gradient(115deg, #4f46e5 0%, #7c3aed 22%, #d946ef 45%, #7c3aed 68%, #4f46e5 85%, #d946ef 100%)',
  backgroundSize: '340% 340%, 300% 300%',
  backgroundPosition: '0% 50%, 0% 50%',
  animation: LIQUID_ANIMATION,
};

// --- one-shot "swipe reveal" played the instant a hover starts -----------
//
// Previously every hover-triggered gradient (icon badge fill, heading text
// fill, the card's animated ring) just snapped in at full opacity the
// moment `hovering` became true. This adds a single-play sweep that masks
// each of those in behind a soft, feathered edge that travels from the
// bottom-left corner to the top-right corner once, so the gradient reveals
// itself rather than appearing instantly — the "fade in swipe" effect
// layers on top of (not instead of) the existing infinite liquid drift,
// the same way a one-off entrance animation is combined with a looping one
// elsewhere in this file.
//
// Two earlier attempts at this didn't pan out, worth noting so they don't
// get re-tried: (1) animating the mask gradient's *stop offsets* directly
// across keyframes isn't reliably interpolated cross-browser — several
// engines just snap straight to the end frame instead of sweeping through
// it; (2) a `clip-path: polygon(...)` sweep interpolates fine and *did*
// visibly sweep, but a polygon clip is a hard geometric cut with no way to
// soften its edge — there's no such thing as a "feathered polygon".
//
// This version instead registers `--akyos-sweep` as a real animatable
// percentage via `@property` (supported in current Chrome/Edge/Safari;
// degrades to a single non-smooth jump on the rare browser without it,
// same as any progressive-enhancement custom-property animation) and
// keeps the gradient's own text completely static — only that one custom
// property changes across the keyframes, referenced through `calc()`. That
// sidesteps both earlier problems: a genuinely numeric value is what's
// being interpolated (not gradient syntax), and the gradient's transparent
// -> white transition zone (width set by SWEEP_FEATHER_PCT below) gives an
// actual soft edge rather than a hard line. White, not black, for the
// opaque stop — this file's other mask (the ring cutout, a few lines
// down) already uses `#fff` for the same reason: masking defaults to
// luminance mode in some engines, where transparent-to-*black* reads as
// "zero luminance either way" and never reveals anything.
//
// `to bottom left` is a real CSS gradient keyword, not an approximated
// angle — it points exactly from the top-right corner to the opposite
// corner regardless of the element's own aspect ratio, which is what was
// asked for (a 36px square icon badge and a wide card both get a true
// corner-to-corner sweep, not just a similar-looking one).
const SWEEP_FEATHER_PCT = 20; // half-width of the soft transition zone, in percent of the corner-to-corner gradient line

export const SWEEP_REVEAL_KEYFRAMES = `
  @property --akyos-sweep {
    syntax: '<percentage>';
    inherits: false;
    initial-value: 130%;
  }
  @keyframes akyos-sweep-reveal {
    0%   { opacity: 0; --akyos-sweep: 130%; }
    25%  { opacity: 1; }
    100% { opacity: 1; --akyos-sweep: -30%; }
  }
`;
// Total 3s so the sweep is clearly visible rather than a flicker; `both`
// fill-mode holds the fully-hidden state for the instant before playback
// starts, then the fully-revealed state once it's done.
export const SWEEP_REVEAL_ANIMATION = 'akyos-sweep-reveal 3s cubic-bezier(0.16, 1, 0.3, 1) both';

// The mask itself — static across the whole animation (only the
// `--akyos-sweep` custom property above changes), spread into an
// element's style alongside SWEEP_REVEAL_ANIMATION.
export const SWEEP_REVEAL_STYLE: React.CSSProperties = {
  WebkitMaskImage: `linear-gradient(to bottom left, transparent calc(var(--akyos-sweep) - ${SWEEP_FEATHER_PCT}%), white calc(var(--akyos-sweep) + ${SWEEP_FEATHER_PCT}%))`,
  maskImage: `linear-gradient(to bottom left, transparent calc(var(--akyos-sweep) - ${SWEEP_FEATHER_PCT}%), white calc(var(--akyos-sweep) + ${SWEEP_FEATHER_PCT}%))`,
  WebkitMaskSize: '100% 100%',
  maskSize: '100% 100%',
  WebkitMaskRepeat: 'no-repeat',
  maskRepeat: 'no-repeat',
} as React.CSSProperties;

// Merges the liquid gradient fill into an element's style, safely combining
// its infinite animation with any one-shot animation the element already
// has (e.g. a fade/slide-in) instead of one overwriting the other.
export function liquidFillStyle(extra: React.CSSProperties = {}): React.CSSProperties {
  const { animation: extraAnimation, ...rest } = extra;
  return {
    ...LIQUID_GRADIENT_FILL,
    animation: extraAnimation ? `${extraAnimation}, ${LIQUID_ANIMATION}` : LIQUID_ANIMATION,
    ...rest,
  };
}

// Same moving-sheen treatment as liquidFillStyle, but for the handful of
// spots that use a different (non brand-indigo/violet/fuchsia) color pair,
// e.g. the Pomodoro "break" state. Takes the base color stops only —
// the shine layer, sizing, and animation stay identical everywhere so
// every gradient in the app moves and blends the same way.
export function liquidFillStyleFor(baseGradient: string, extra: React.CSSProperties = {}): React.CSSProperties {
  const { animation: extraAnimation, ...rest } = extra;
  return {
    backgroundImage:
      'linear-gradient(100deg, transparent 8%, rgba(255,255,255,0.16) 28%, rgba(255,255,255,0.30) 42%, rgba(255,255,255,0.30) 50%, rgba(255,255,255,0.16) 58%, transparent 78%), ' +
      baseGradient,
    backgroundSize: '340% 340%, 300% 300%',
    backgroundPosition: '0% 50%, 0% 50%',
    animation: extraAnimation ? `${extraAnimation}, ${LIQUID_ANIMATION}` : LIQUID_ANIMATION,
    ...rest,
  };
}