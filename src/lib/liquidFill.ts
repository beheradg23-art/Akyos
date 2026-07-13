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
// moment `hovering` became true. This adds a single-play sweep that clips
// each of those in behind a slanted leading edge which grows across the
// element once, so the gradient reveals itself rather than appearing
// instantly — the "fade in swipe" effect layers on top of (not instead
// of) the existing infinite liquid drift, the same way a one-off entrance
// animation is combined with a looping one elsewhere in this file.
//
// This is `clip-path: polygon(...)`, not an animated mask gradient — a
// first attempt animated `mask-image` stop offsets directly, but that
// turned out to be unreliable on two counts: (1) unprefixed `mask-image`
// defaults to luminance-based masking in some engines, where a
// transparent-to-*black* gradient reads as "zero luminance either way" and
// never actually reveals anything (this file's other mask, a few lines
// down, sidesteps that by using `#fff`, not black); (2) animating a
// gradient's own stop offsets across keyframes isn't reliably interpolated
// cross-browser — several engines just snap straight to the end frame.
// clip-path polygons don't have either problem: two polygons with the same
// point count always interpolate smoothly, and it doesn't touch `mask` at
// all, so it layers cleanly on top of the ring's own content-box cutout
// mask with no wrapper element needed.
//
// SWEEP_SKEW is how many percentage points the leading edge's bottom point
// is offset from its top point — the diagonal "tilt" — approximating the
// requested 120°-anticlockwise travel. It's an approximation rather than a
// literal angle because clip-path percentages are relative to each
// element's own box, and a literal degree would look different on a 36px
// square icon badge than on a wide card. Flip the sign to tilt the other
// way; the polygon's other coordinates (-50%/250%/150%) are just generous
// overshoot so the sweep is fully off-box at 0% and fully on-box at 100%
// regardless of the element's aspect ratio.
const SWEEP_SKEW = 80;

export const SWEEP_REVEAL_KEYFRAMES = `
  @keyframes akyos-sweep-reveal {
    0% {
      opacity: 0;
      clip-path: polygon(-50% -50%, -50% -50%, ${-50 - SWEEP_SKEW}% 150%, -50% 150%);
    }
    35% { opacity: 1; }
    100% {
      opacity: 1;
      clip-path: polygon(-50% -50%, 250% -50%, ${250 - SWEEP_SKEW}% 150%, -50% 150%);
    }
  }
`;
// Single play, holds its end state (fully unclipped) once done — `both`
// fill-mode so the element sits at 0% opacity/fully-clipped for the instant
// before the animation engine kicks in, then stays fully revealed after.
export const SWEEP_REVEAL_ANIMATION = 'akyos-sweep-reveal 620ms cubic-bezier(0.16, 1, 0.3, 1) both';

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