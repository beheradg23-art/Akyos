// Shared "liquid" animated gradient fill used across icon badges, primary
// buttons, avatars, and progress fills throughout the app (same treatment
// as AuthGate). Split out of the old App.tsx monolith so any component
// that wants the liquid-fill look can import it directly instead of
// relying on a function defined 1000+ lines away in the same file.
import React, { useEffect, useRef, useState } from 'react';

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
  @keyframes akyos-sweep-fade-out {
    from { opacity: 1; --akyos-sweep: -30%; }
    to   { opacity: 0; --akyos-sweep: -30%; }
  }
`;
// Total 3s so the sweep is clearly visible rather than a flicker; `both`
// fill-mode holds the fully-hidden state for the instant before playback
// starts, then the fully-revealed state once it's done.
export const SWEEP_REVEAL_ANIMATION = 'akyos-sweep-reveal 3s cubic-bezier(0.16, 1, 0.3, 1) both';

// The "leaving" counterpart to SWEEP_REVEAL_ANIMATION. Deliberately just a
// plain opacity fade with `--akyos-sweep` pinned at its fully-revealed
// value throughout (rather than travelling back across the box) — the
// hover-out was asked to be a slow fade with "no sweep required", so the
// mask stays wide open and only opacity moves. Much shorter than the 3s
// entrance since a fade doesn't need to visibly travel anywhere, it just
// needs to read as a deliberate fade rather than a snap.
const SWEEP_FADE_OUT_MS = 450;
export const SWEEP_FADE_OUT_ANIMATION = `akyos-sweep-fade-out ${SWEEP_FADE_OUT_MS}ms ease-out both`;

// The heading's plain-white base copy needs the opposite fade from the
// gradient copy above: as the gradient fades OUT (opacity 1 -> 0), the
// base should simultaneously fade IN (opacity 0 -> 1), not stay hidden
// until the sweep overlay unmounts. Running the very same keyframes with
// `direction: reverse` gives exactly that — it starts at the "to" frame
// (opacity 0) and ends at the "from" frame (opacity 1) — while keeping
// the two perfectly in sync (same duration, same easing, same clock).
// This is only ever applied *without* SWEEP_REVEAL_STYLE_INVERSE's mask
// (see SectionHeading) — during hover-out the base text should just be a
// plain, unmasked fade-in; the masked/crossfade treatment is only needed
// for the corner-to-corner sweep on hover-*in*.
export const SWEEP_FADE_OUT_ANIMATION_INVERSE = `akyos-sweep-fade-out ${SWEEP_FADE_OUT_MS}ms ease-out reverse both`;

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

// The exact photographic-negative of SWEEP_REVEAL_STYLE above — same
// `--akyos-sweep` variable, same feather width, same direction, just with
// the transparent/white stops swapped. Used to hide the plain white base
// heading text in lockstep with the gradient copy revealing on top of it.
//
// Why this exists: the gradient copy's mask has a soft (feathered) edge,
// which is required so the sweep doesn't look like a hard clip. But a soft
// mask means there's a band, `SWEEP_FEATHER_PCT` wide, where the gradient
// copy sits at partial opacity — and previously the solid-white base text
// stayed at full opacity directly underneath it for that whole band.
// Alpha-blending a translucent colored glyph over a fully-opaque white
// glyph doesn't read as "gradient fading in", it reads as pale, washed-out
// white edges bleeding around every letter — worse on fine strokes, since
// the mask's feather and the glyph's own antialiasing are two independent
// soft edges compounding on each other. That's the "white leaking edgy
// text" this fixes.
// Feeding the same --akyos-sweep value into a complementary mask on the
// base layer means at any instant the two opacities sum to ~1 across the
// whole feather band (base goes white -> transparent exactly where the
// overlay goes transparent -> white), so there's never a moment where a
// translucent white glyph and a translucent gradient glyph occupy the same
// pixels at once — it reads as one continuous crossfade along the sweep
// line. And because both masks share the one custom property plus the
// identical animation string, they can never drift out of sync with each
// other, however long the hover lasts.
export const SWEEP_REVEAL_STYLE_INVERSE: React.CSSProperties = {
  WebkitMaskImage: `linear-gradient(to bottom left, white calc(var(--akyos-sweep) - ${SWEEP_FEATHER_PCT}%), transparent calc(var(--akyos-sweep) + ${SWEEP_FEATHER_PCT}%))`,
  maskImage: `linear-gradient(to bottom left, white calc(var(--akyos-sweep) - ${SWEEP_FEATHER_PCT}%), transparent calc(var(--akyos-sweep) + ${SWEEP_FEATHER_PCT}%))`,
  WebkitMaskSize: '100% 100%',
  maskSize: '100% 100%',
  WebkitMaskRepeat: 'no-repeat',
  maskRepeat: 'no-repeat',
} as React.CSSProperties;

// Drives every sweep overlay's mount + animation off of the same
// hovering/focused boolean the rest of the component already tracks,
// instead of that boolean gating the overlay's presence directly (which is
// what made hover-out snap the whole gradient away instantly — React just
// unmounts the node the instant `hovering` flips to false, animation or
// not). While `active` is true the overlay mounts right away and plays the
// corner-to-corner reveal, same as before. The moment `active` goes false,
// this switches the overlay to SWEEP_FADE_OUT_ANIMATION (a plain opacity
// fade, mask left fully open) and keeps it mounted for exactly as long as
// that fade takes, then unmounts it — so the box is back to its normal,
// un-hovered look only once the fade has actually finished, not before.
export function useSweepReveal(active: boolean): { mounted: boolean; animation: string } {
  const [mounted, setMounted] = useState(active);
  const [animation, setAnimation] = useState(active ? SWEEP_REVEAL_ANIMATION : SWEEP_FADE_OUT_ANIMATION);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    window.clearTimeout(timeoutRef.current);
    if (active) {
      setMounted(true);
      setAnimation(SWEEP_REVEAL_ANIMATION);
    } else {
      setAnimation(SWEEP_FADE_OUT_ANIMATION);
      timeoutRef.current = window.setTimeout(() => setMounted(false), SWEEP_FADE_OUT_MS);
    }
    return () => window.clearTimeout(timeoutRef.current);
  }, [active]);

  return { mounted, animation };
}

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