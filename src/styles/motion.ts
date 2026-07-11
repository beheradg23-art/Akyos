// ---------------------------------------------------------------------------
// Shared motion tokens.
//
// Every component in this app used to hand-pick its own duration (150 / 180 /
// 200 / 300 / 380 / 600 / 650ms...) and its own easing curve. That made small
// timing tweaks a search-and-replace across a dozen files instead of a
// one-line change. This file is the single source of truth going forward:
// change a value here and every component that imports it picks it up.
//
// Usage:
//   import { motion, durationMs } from '../styles/motion';
//   <div style={{ transition: `transform ${motion.base}` }} />
//   <div style={{ transition: `opacity ${durationMs.fast}ms ${motion.ease}` }} />
// ---------------------------------------------------------------------------

// Raw millisecond values, for places that need the number itself (setTimeout,
// animation-delay math, etc).
export const durationMs = {
    /** Micro-interactions: button presses, ripples, toggle fills. */
    instant: 100,
    /** Hover states, small color/opacity transitions. */
    fast: 150,
    /** The default — card hovers, tab switches, most UI transitions. */
    base: 200,
    /** Panel slide-ins, modal entrances, drawer open/close. */
    slow: 300,
    /** Larger choreographed moves — page transitions, the intro cascade. */
    slower: 450,
    /** Full-screen reveals, curtain wipes, splash sequences. */
    slowest: 650,
  } as const;
  
  // Standard easing curves. `standard` matches what's already used all over
  // the app (cubic-bezier(0.16, 1, 0.3, 1) — a soft, slightly overshooting
  // "ease-out-expo" feel); `linear` and `inOut` cover the rest.
  export const easing = {
    standard: 'cubic-bezier(0.16, 1, 0.3, 1)',
    inOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
    linear: 'linear',
  } as const;
  
  // Ready-to-drop-into-a-`transition` string values, for the common cases.
  export const motion = {
    instant: `${durationMs.instant}ms ${easing.standard}`,
    fast: `${durationMs.fast}ms ${easing.standard}`,
    base: `${durationMs.base}ms ${easing.standard}`,
    slow: `${durationMs.slow}ms ${easing.standard}`,
    slower: `${durationMs.slower}ms ${easing.standard}`,
    slowest: `${durationMs.slowest}ms ${easing.standard}`,
    ease: easing.standard,
  } as const;