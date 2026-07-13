import React, { useEffect, useRef, useState } from 'react';
import { Lock, Mail, Loader2, ShieldCheck, CheckCircle2, GraduationCap, BookOpen, Sparkles, Zap } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import {
  pullFromCloud,
  pushToCloud,
  hashPasscode,
  setPasscodeHash,
  getPasscodeHash,
  ensureAccountIsolation,
  resetLocalAccountState,
  LAST_ACTIVE_USER_KEY,
  PASSCODE_HASH_KEY,
} from '../lib/cloudSync';
import PasswordField from './PasswordField';
import { NO_SELECT_CSS } from '../styles/noSelect';
import { SWEEP_REVEAL_ANIMATION, SWEEP_REVEAL_STYLE, SWEEP_REVEAL_KEYFRAMES } from '../lib/liquidFill';

const PASSCODE_LENGTH = 6;

// A quiet grain texture (classic Linear/Vercel/Stripe touch) — a tiny
// inline SVG turbulence filter turned into a repeating background image,
// kept at very low opacity so it just adds a bit of tooth to the flat
// dark panel instead of reading as pure noise.
const GRAIN_DATA_URI =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E";

// Keyframes for the two ambient glows below — defined once, referenced
// via Tailwind's arbitrary `animate-[name_time_...]` syntax. The browser
// resolves the keyframe name from any stylesheet on the page, so this
// plain <style> tag is all that's needed (no tailwind.config changes).
const AMBIENT_DRIFT_KEYFRAMES = `
  @keyframes akyos-drift-a { 0% { transform: translate(0, 0); } 100% { transform: translate(-4%, 3%); } }
  @keyframes akyos-drift-b { 0% { transform: translate(0, 0); } 100% { transform: translate(3%, -4%); } }
`;

// Slow up/down levitation for the metallic decorative icons in
// SignInVisualPanel — a gentle bob, not a bounce, so it reads as "floating
// object" rather than an active UI animation. Each icon runs this at its
// own duration/delay (set inline) so the four never sync up and drift in
// and out of phase with each other, the way real floating objects would.
//
// `--mx`/`--my` are the horizontal/vertical parallax offset driven by
// mouse position across the whole window (see SignInVisualPanel below) —
// registering them via `@property` makes them real animatable values
// rather than plain strings, which is what lets the `transition: --mx,
// --my ...` on each icon smooth out the mouse updates instead of the icon
// snapping to each new position. The bob itself is layered on top of
// `--my` (rather than replacing it) so the icon still floats up/down on
// its own even while the mouse sits still.
const METAL_FLOAT_KEYFRAMES = `
  @property --mx {
    syntax: '<length>';
    inherits: true;
    initial-value: 0px;
  }
  @property --my {
    syntax: '<length>';
    inherits: true;
    initial-value: 0px;
  }
  @keyframes akyos-metal-float {
    0%, 100% { transform: translate(var(--mx, 0px), var(--my, 0px)) rotate(var(--float-rot, 0deg)); }
    50% { transform: translate(var(--mx, 0px), calc(var(--my, 0px) - 16px)) rotate(var(--float-rot, 0deg)); }
  }
`;

// --- shared "liquid" animated gradient fill ------------------------------
//
// Every icon badge and primary button used to be filled with a flat static
// gradient (bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500).
// This replaces all of those with the same moving, shiny gradient treatment
// used on the "1%" counter: the brand color stops slowly drift via an
// animated background-position, and a soft diagonal light streak is layered
// on top (as a second background-image, with its own background-size) so
// it periodically sweeps across the shape for a glossy, liquid feel — all
// on one element, no extra DOM needed.
const LIQUID_GRADIENT_KEYFRAMES = `
  @keyframes akyos-liquid-fill {
    0%   { background-position: 0% 50%, 0% 50%; }
    50%  { background-position: 100% 50%, 100% 50%; }
    100% { background-position: 0% 50%, 0% 50%; }
  }
`;
const LIQUID_ANIMATION = 'akyos-liquid-fill 6s ease-in-out infinite';
// The shine layer used to jump straight from transparent to a 0.5-opacity
// peak over a short span, which read as a hard, distinct "line" sliding
// through the gradient rather than a soft sheen. It's now built from more,
// closer stops that ramp gradually up to a lower peak and back down again
// (transparent -> faint -> peak -> faint -> transparent), and spread over a
// larger background-size so the whole thing glides through slower and
// blends into the base gradient instead of visibly seaming.
const LIQUID_GRADIENT_FILL: React.CSSProperties = {
  backgroundImage:
    'linear-gradient(100deg, transparent 8%, rgba(255,255,255,0.16) 28%, rgba(255,255,255,0.30) 42%, rgba(255,255,255,0.30) 50%, rgba(255,255,255,0.16) 58%, transparent 78%), ' +
    'linear-gradient(115deg, #4f46e5 0%, #7c3aed 22%, #d946ef 45%, #7c3aed 68%, #4f46e5 85%, #d946ef 100%)',
  backgroundSize: '340% 340%, 300% 300%',
  backgroundPosition: '0% 50%, 0% 50%',
  animation: LIQUID_ANIMATION,
};

// Merges the liquid gradient fill into an element's style, safely combining
// its infinite animation with any one-shot animation the element already
// has (e.g. the cascade-in slide-in) instead of one overwriting the other.
function liquidFillStyle(extra: React.CSSProperties = {}): React.CSSProperties {
  const { animation: extraAnimation, ...rest } = extra;
  return {
    ...LIQUID_GRADIENT_FILL,
    animation: extraAnimation ? `${extraAnimation}, ${LIQUID_ANIMATION}` : LIQUID_ANIMATION,
    ...rest,
  };
}

// Standard Google "G" mark, used by the "Continue with Google" button.
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </svg>
  );
}

// A single decorative icon rendered in a shiny animated silver gradient
// (both stroked AND filled, so it reads as a solid cast object rather than
// an outline) — achieved with CSS `stroke`/`fill: url(#id)`, referencing
// the shared <linearGradient> defined once in SignInVisualPanel — plus a
// drop-shadow so it reads as an object resting in front of the panel
// rather than a flat line icon. Wrapped in its own bobbing div (forwarded
// via `wrapRef`) so each can float at a different speed/phase, and shift
// with the rest of the group as the mouse moves across the whole page
// (both horizontally and vertically).
const MetallicFloatIcon = React.forwardRef<HTMLDivElement, {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  style: React.CSSProperties; size?: number; duration?: number; delay?: number; rotate?: number;
}>(function MetallicFloatIcon({ icon: Icon, style, size = 44, duration = 6, delay = 0, rotate = 0 }, wrapRef) {
  return (
    <div
      ref={wrapRef}
      className="pointer-events-none absolute"
      style={{
        ...style,
        animation: `akyos-metal-float ${duration}s ease-in-out infinite`,
        animationDelay: `${delay}s`,
        transition: '--mx 150ms ease-out, --my 150ms ease-out',
        ['--float-rot' as any]: `${rotate}deg`,
      }}
    >
      <Icon
        className="drop-shadow-[0_10px_18px_rgba(0,0,0,0.55)]"
        style={{
          width: size,
          height: size,
          stroke: 'url(#akyos-metal-shine)',
          fill: 'url(#akyos-metal-shine)',
          fillOpacity: 0.85,
          strokeWidth: 1.2,
          transform: `rotate(${rotate}deg)`,
        } as React.CSSProperties}
      />
    </div>
  );
});

// Which icon, where, how big, and how far it parallaxes relative to the
// mouse (`reachX`/`reachY`, in px at the extreme edge of the window) —
// kept as data so the mousemove handler in SignInVisualPanel can walk the
// same list the JSX renders from instead of duplicating it.
const FLOAT_ICONS = [
  { icon: Sparkles, style: { left: '30%', top: '8%' }, size: 92, duration: 6.5, delay: 0, rotate: -8, reachX: 22, reachY: 16 },
  { icon: BookOpen, style: { left: '6%', top: '42%' }, size: 158, duration: 7.5, delay: 0.8, rotate: -14, reachX: 34, reachY: 24 },
  { icon: Zap, style: { left: '80%', top: '46%' }, size: 138, duration: 6, delay: 1.6, rotate: 10, reachX: 34, reachY: 24 },
  { icon: GraduationCap, style: { left: '46%', top: '74%' }, size: 148, duration: 8, delay: 0.3, rotate: -6, reachX: 28, reachY: 20 },
];

// The left-half visual panel for the desktop sign-in layout.
//
// A near-black panel with a faint grain texture, two very soft, slow-
// drifting brand-colored glows in the corners for a hint of color and
// depth, and four slowly-levitating shiny-silver icons (book, sparkle,
// bolt, grad cap) that bob up and down at their own pace and drift with
// the cursor — both horizontally and vertically — as it moves across the
// whole page, a gentle parallax rather than anything that tracks the
// cursor precisely.
function SignInVisualPanel() {
  const iconRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    let rafId = 0;
    const handleMove = (e: MouseEvent) => {
      if (rafId) return; // coalesce to at most one update per frame
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        // -1 at the far left/top edge of the window, +1 at the far
        // right/bottom — each icon's own reachX/reachY just scales how
        // far it drifts in that direction.
        const normX = (e.clientX / window.innerWidth) * 2 - 1;
        const normY = (e.clientY / window.innerHeight) * 2 - 1;
        FLOAT_ICONS.forEach((cfg, i) => {
          const el = iconRefs.current[i];
          if (!el) return;
          el.style.setProperty('--mx', `${normX * cfg.reachX}px`);
          el.style.setProperty('--my', `${normY * cfg.reachY}px`);
        });
      });
    };
    window.addEventListener('mousemove', handleMove);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div className="relative hidden h-full overflow-hidden bg-zinc-950 lg:flex lg:w-1/2 lg:items-center lg:justify-center">
      <style>{AMBIENT_DRIFT_KEYFRAMES}</style>
      <style>{METAL_FLOAT_KEYFRAMES}</style>

      {/* Shared shiny-silver gradient definition, referenced by every
          MetallicFloatIcon below via `stroke`/`fill: url(#akyos-metal-
          shine)`. Lives in a zero-size <svg> since it has nothing to
          render on its own — it just holds the <defs> the icons point
          at. The <animateTransform> slowly slides the gradient across
          itself so the "shine" sweeps along the icons over time instead
          of sitting static. */}
      <svg width="0" height="0" className="absolute">
        <defs>
          <linearGradient id="akyos-metal-shine" x1="0%" y1="0%" x2="100%" y2="100%" gradientUnits="objectBoundingBox">
            <stop offset="0%" stopColor="#cbd5e1" />
            <stop offset="20%" stopColor="#64748b" />
            <stop offset="40%" stopColor="#f8fafc" />
            <stop offset="50%" stopColor="#ffffff" />
            <stop offset="60%" stopColor="#f1f5f9" />
            <stop offset="80%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#e2e8f0" />
            <animateTransform
              attributeName="gradientTransform"
              type="translate"
              values="-0.4 0; 0.4 0; -0.4 0"
              dur="5s"
              repeatCount="indefinite"
            />
          </linearGradient>
        </defs>
      </svg>

      {/* Two soft, mostly-static brand-colored glows for a touch of color
          and depth. Slow enough that they read as "alive" without being
          distracting next to a login form. */}
      <div className="pointer-events-none absolute -top-1/4 left-1/4 h-[55vmin] w-[55vmin] rounded-full bg-violet-600/[0.10] blur-[130px] animate-[akyos-drift-a_24s_ease-in-out_infinite_alternate]" />
      <div className="pointer-events-none absolute bottom-[-10%] right-[-5%] h-[48vmin] w-[48vmin] rounded-full bg-indigo-500/[0.09] blur-[130px] animate-[akyos-drift-b_28s_ease-in-out_infinite_alternate]" />

      {/* Faint grain for texture. */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-overlay"
        style={{ backgroundImage: `url("${GRAIN_DATA_URI}")` }}
      />

      {/* Four slowly-levitating liquid-gradient decorative icons, roughly
          matching the sparkle/book/bolt/cap arrangement sketched out for
          this panel — each floats on its own duration/delay so they never
          bob in sync, and all drift left/right together as the mouse
          moves across the whole page. */}
      {FLOAT_ICONS.map((cfg, i) => (
        <MetallicFloatIcon
          key={i}
          ref={(el) => (iconRefs.current[i] = el)}
          icon={cfg.icon}
          style={cfg.style}
          size={cfg.size}
          duration={cfg.duration}
          delay={cfg.delay}
          rotate={cfg.rotate}
        />
      ))}

      {/* The actual brand mark, centered — same icon badge + name used in
          the app's own header, so this panel reads as unmistakably
          "this app" rather than generic decoration. */}
      <div className="relative flex flex-col items-center gap-3">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-xl shadow-lg shadow-violet-500/20"
          style={liquidFillStyle()}
        >
          <GraduationCap className="h-5 w-5 text-neutral-950" strokeWidth={2} />
        </div>
        <div className="text-center">
          <p className="text-[13px] font-semibold tracking-tight text-neutral-200">Akyos</p>
          <p className="text-[11.5px] text-neutral-600">Your Answer to Chaos</p>
        </div>
      </div>
    </div>
  );
}

const INTRO_PULSE_KEYFRAMES = `
  @keyframes akyos-intro-pulse {
    0% { transform: scale(0.85); opacity: 0.5; }
    70% { transform: scale(1.35); opacity: 0; }
    100% { transform: scale(1.35); opacity: 0; }
  }
`;

// How long each phase of the intro holds, in ms. Kept in one place so the
// timers below and the CSS transition/animation durations stay honest
// with each other.
const INTRO_ENTER_MS = 650; // badge + wordmark fade/scale in, stroke draws itself in over roughly this + hold
const INTRO_HOLD_MS = 700; // sits fully visible
const INTRO_EXIT_MS = 600; // whole overlay fades out

// The moment (ms after mount) the intro starts handing off to the real
// screen underneath — shared by the overlay's fade-out and the sign-in
// boxes' cascade-in below so the two are timed to happen together.
const INTRO_REVEAL_AT_MS = INTRO_ENTER_MS + INTRO_HOLD_MS;

// A one-time, full-screen branded reveal shown on mount, before the real
// AuthGate content underneath is visible — a Strava-post-run-style beat:
// the badge and wordmark build up center-stage, hold for a moment, then
// the whole overlay fades away to hand off to the real screen underneath
// (which animates its own elements in — see cascadeStyle() below).
//
// Structurally this sits in its own fixed layer at a higher z-index than
// every AuthGate stage screen (all z-[999]), so whatever stage has
// actually resolved underneath (checking/auth/passcode/etc.) is already
// there and ready the instant the overlay clears.
function IntroReveal({ onComplete }: { onComplete: () => void }) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    // Double rAF so the browser commits the initial (hidden) styles on
    // one frame before flipping to the visible styles on the next — skip
    // this and some browsers coalesce both states into a single paint
    // and nothing actually animates.
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setVisible(true));
    });

    const exitTimer = setTimeout(() => setExiting(true), INTRO_REVEAL_AT_MS);
    const doneTimer = setTimeout(onComplete, INTRO_REVEAL_AT_MS + INTRO_EXIT_MS);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(exitTimer);
      clearTimeout(doneTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={`fixed inset-0 z-[1000] flex items-center justify-center bg-zinc-950 transition-opacity ease-out ${exiting ? 'pointer-events-none' : ''}`}
      style={{ transitionDuration: `${INTRO_EXIT_MS}ms`, opacity: exiting ? 0 : 1 }}
      aria-hidden="true"
    >
      <style>{INTRO_PULSE_KEYFRAMES}</style>

      {/* Centered branding. */}
      <div
        className="pointer-events-none relative flex flex-col items-center justify-center gap-4 transition-all ease-out"
        style={{
          transitionDuration: `${INTRO_ENTER_MS}ms`,
          opacity: visible ? 1 : 0,
          transform: visible ? 'scale(1)' : 'scale(0.85)',
        }}
      >
        {/* Soft expanding ripple behind the badge, echoing a completed-
            activity celebration beat rather than decoration for its own
            sake. Runs continuously while the intro is on screen. */}
        {!exiting && (
          <div className="absolute h-24 w-24 rounded-full bg-violet-600/25 blur-2xl animate-[akyos-intro-pulse_1.6s_ease-out_infinite]" />
        )}

        <div
          className="relative flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg shadow-violet-500/30"
          style={liquidFillStyle()}
        >
          <GraduationCap className="h-7 w-7 text-neutral-950" strokeWidth={2} />
        </div>

        <div className="text-center">
          <p className="text-[17px] font-semibold tracking-tight text-neutral-50">Akyos</p>
          <p className="mt-1 text-[12.5px] text-neutral-500">Your Answer to Chaos</p>
        </div>
      </div>
    </div>
  );
}

// --- "1% Better Every Day." pre-intro ------------------------------------
//
// Plays first, before IntroReveal / the sign-in page itself. "1%" counts
// up smoothly — frame by frame, eased, the same way a real loading-percent
// counter moves — rather than snapping between discrete values, rendered
// as an animated liquid gradient with a soft glow for a premium feel.
// "Better Every Day." then drifts in one word at a time, slowly, starting
// from "Better".
//
// The exit is its own multi-beat sequence rather than a single fade:
//   1. "Better Every Day." collapses away (fade + shrink), which lets "1%"
//      glide back to dead-center as the row re-centers around it.
//   2. "1%" dissolves as the same liquid gradient quietly fades into view,
//      already covering the whole screen — a plain crossfade, no scaling,
//      so there's no sudden "zoom in" moment.
//   3. After a brief hold at full screen, that same gradient eases smoothly
//      all the way down — one unhurried "zoom out" — into the exact
//      size/shape of the badge.
//   4. Once it's settled into that badge shape, the logo mark and wordmark
//      fade in inside it — the "reveal" — before the whole thing hands off
//      to whatever was already sitting underneath (IntroReveal, then the
//      real stage).
const ONE_PCT_KEYFRAMES = `
  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;800&display=swap');

  @keyframes akyos-liquid-gradient {
    0%   { background-position: 0% 50%; }
    50%  { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }

  @keyframes akyos-glow-pulse {
    0%, 100% { filter: drop-shadow(0 0 6px rgba(167,139,250,0.5)) drop-shadow(0 0 16px rgba(129,140,248,0.3)); }
    50%      { filter: drop-shadow(0 0 10px rgba(217,70,239,0.55)) drop-shadow(0 0 22px rgba(167,139,250,0.35)); }
  }

  @keyframes akyos-word-fade-in {
    from { opacity: 0; transform: translateY(16px); filter: blur(6px); }
    to   { opacity: 1; transform: translateY(0); filter: blur(0); }
  }
`;

// Target value the counter eases up to. Displayed with one decimal place
// while still counting (so the motion actually reads as a sweep, the same
// way a real loading-percentage counter shows fractional progress), then
// snapped to a clean whole-number "1%" the instant it settles.
const ONE_PCT_TARGET = 1;
const ONE_PCT_COUNT_MS = 1250; // duration of the smooth count-up
const ONE_PCT_COUNT_PAUSE_MS = 350; // "1%" sits settled before the words start
const ONE_PCT_WORD_START_MS = ONE_PCT_COUNT_MS + ONE_PCT_COUNT_PAUSE_MS;
const ONE_PCT_WORD_STAGGER_MS = 420; // gap between each word starting its drift-in — slow and deliberate
const ONE_PCT_WORD_FADE_MS = 1150; // how long a single word takes to fully resolve — long, slow, cinematic
const ONE_PCT_HOLD_MS = 550; // full line sits fully visible before the exit sequence begins
const ONE_PCT_WORDS = ['Better', 'Every', 'Day.'];
const ONE_PCT_TOTAL_MS =
  ONE_PCT_WORD_START_MS +
  (ONE_PCT_WORDS.length - 1) * ONE_PCT_WORD_STAGGER_MS +
  ONE_PCT_WORD_FADE_MS +
  ONE_PCT_HOLD_MS;

// --- exit sequence timings (each beat described above) ---
// No more "grow from 1% to cover the screen" beat — that scale-up read as
// a bulky, sudden zoom-in. Instead the full-bleed gradient simply
// dissolves into view (a plain opacity crossfade — it's already sitting
// at full size underneath, just invisible), holds for a breath, then the
// whole thing eases smoothly back down — a single unhurried "zoom out" —
// into the badge shape. One continuous deceleration, no grow-then-shrink.
const ONE_PCT_WORDS_OUT_MS = 520; // "Better Every Day." collapses, "1%" glides to center
const ONE_PCT_GRADIENT_IN_MS = 780; // full-screen gradient quietly dissolves into view (opacity only — no scaling)
const ONE_PCT_GRADIENT_HOLD_MS = 260; // brief hold at full-screen coverage before easing out
const ONE_PCT_ZOOM_OUT_MS = 1050; // gradient eases smoothly back down into the badge shape — a bit longer so the settle isn't rushed
const ONE_PCT_BADGE_REVEAL_MS = 420; // logo mark + wordmark fade in inside the settled badge
const ONE_PCT_BADGE_HOLD_MS = 480; // badge sits revealed for a beat
const ONE_PCT_FINAL_FADE_MS = 480; // whole overlay fades, handing off to IntroReveal
type OnePctPhase = 'intro' | 'wordsOut' | 'gradientIn' | 'zoomOut' | 'badgeReveal' | 'finalFade';

// Standard "ease out cubic" — fast start, long smooth deceleration into
// the landing value, same shape most real counters/progress bars use.
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

// --- custom "hold → spike → hold" easing for the zoom-out beat ----------
// The requested speed profile isn't a plain symmetric bell: it holds low
// for a while, ramps UP gradually over a fairly long stretch, spikes narrow
// and sharp, then falls back down to a low hold noticeably *faster* than
// it climbed. That asymmetry can't come from a single cubic-bezier (or
// even a symmetric sigmoid) — so instead we describe the *speed* directly
// as a handful of (time, relative-speed) control points tracing that
// exact shape, then numerically integrate them once (at module load) into
// a lookup table for position-over-time. zoomOutEase(t) just reads that
// table each frame. Tweak the points below to reshape the curve directly.
const ZOOM_SPEED_CONTROL_POINTS: [number, number][] = [
  [0.0, 0.04], // slow hold
  [0.1, 0.05],
  [0.22, 0.09], // gentle ramp begins
  [0.34, 0.18],
  [0.44, 0.4],
  [0.52, 0.85],
  [0.57, 1.0], // peak — sharp, narrow
  [0.63, 0.55], // drops off the peak faster than it climbed...
  [0.7, 0.24],
  [0.78, 0.1],
  [0.87, 0.045], // ...but keeps easing down well past where it used to bottom out,
  [1.0, 0.02], // so the very last stretch into the badge is a slow, gentle settle
];

function sampleSpeed(t: number): number {
  const pts = ZOOM_SPEED_CONTROL_POINTS;
  if (t <= pts[0][0]) return pts[0][1];
  if (t >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
  for (let i = 0; i < pts.length - 1; i++) {
    const [t0, v0] = pts[i];
    const [t1, v1] = pts[i + 1];
    if (t >= t0 && t <= t1) {
      const f = (t - t0) / (t1 - t0);
      return v0 + (v1 - v0) * f;
    }
  }
  return pts[pts.length - 1][1];
}

// Integrate the speed curve into a position lookup table exactly once
// (module load, not per-frame/per-render) — this cumulative curve IS the
// eased position-over-time whose derivative matches the shape above.
const ZOOM_EASE_SAMPLES = 400;
const ZOOM_EASE_TABLE: number[] = (() => {
  const table: number[] = [0];
  let cumulative = 0;
  for (let i = 1; i <= ZOOM_EASE_SAMPLES; i++) {
    const t = i / ZOOM_EASE_SAMPLES;
    const prevT = (i - 1) / ZOOM_EASE_SAMPLES;
    cumulative += ((sampleSpeed(t) + sampleSpeed(prevT)) / 2) * (1 / ZOOM_EASE_SAMPLES);
    table.push(cumulative);
  }
  const total = table[table.length - 1];
  return table.map((v) => v / total); // renormalize so it lands exactly on 0 and 1
})();

function zoomOutEase(t: number): number {
  const clamped = Math.min(Math.max(t, 0), 1);
  const pos = clamped * ZOOM_EASE_SAMPLES;
  const i0 = Math.floor(pos);
  const i1 = Math.min(i0 + 1, ZOOM_EASE_SAMPLES);
  const frac = pos - i0;
  return ZOOM_EASE_TABLE[i0] + (ZOOM_EASE_TABLE[i1] - ZOOM_EASE_TABLE[i0]) * frac;
}

// The shared big-text styling for both "1%" and the "Better Every Day."
// words, so they read as one continuous line at one consistent size. The
// lower end of the clamp is driven mostly by vw (rather than a large fixed
// rem floor) so the whole phrase can shrink enough to stay on one line on
// narrow phone widths instead of wrapping.
const ONE_PCT_TEXT_CLASS = 'text-[clamp(1.4rem,6.8vw,4.75rem)] leading-[1.15]';

// Style for the liquid blob. It no longer grows from "1%" to cover the
// screen — that scale-up read as a bulky, sudden zoom-in. Instead it sits
// at full-screen size the whole time and simply dissolves into view via
// opacity (see the 'gradientIn' phase below); the one real motion left is
// the "zoom out" down to the compact badge shape.
//
// That zoom is driven frame-by-frame from JS (via `zoomProgress`, a 0→1
// value produced by zoomOutEase — see above) rather than a CSS
// `transition`, because the desired speed profile (slow → sharp spike →
// slow, not a plain symmetric ease) isn't expressible as a single
// cubic-bezier. `fullSizePx` is computed from the viewport (the JS
// equivalent of the old `300vmax`) so the blob still comfortably covers
// the screen at every aspect ratio.
function onePctBlobStyle(phase: OnePctPhase, zoomProgress: number, fullSizePx: number): React.CSSProperties {
  const visible = phase === 'gradientIn' || phase === 'zoomOut' || phase === 'badgeReveal' || phase === 'finalFade';
  const settled = phase === 'badgeReveal' || phase === 'finalFade';
  const badgeSizePx = 56;
  // t: 0 = full screen, 1 = fully settled into the badge.
  const t = settled ? 1 : phase === 'zoomOut' ? zoomProgress : 0;
  const size = fullSizePx + (badgeSizePx - fullSizePx) * t;
  const radius = fullSizePx / 2 + (16 - fullSizePx / 2) * t; // circle -> 16px rounded square
  return {
    ...liquidFillStyle(),
    position: 'fixed',
    left: '50%',
    top: '50%',
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: `${radius}px`,
    transform: 'translate(-50%, -50%)',
    opacity: visible ? 1 : 0,
    boxShadow: settled ? '0 10px 30px -6px rgba(124,58,237,0.45)' : 'none',
    transition: `opacity ${ONE_PCT_GRADIENT_IN_MS}ms ease-in-out, box-shadow 380ms ease-out`,
    zIndex: 2,
  };
}

function OnePercentIntro({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<OnePctPhase>('intro');
  const [countLabel, setCountLabel] = useState('0.0%');
  // How many of ONE_PCT_WORDS are currently mounted. Words are only added
  // to the DOM when it's their turn to appear — NOT rendered up front with
  // opacity:0 — because invisible text still reserves its own width in the
  // flex row, which would pull the centered block off toward the left.
  const [visibleWordCount, setVisibleWordCount] = useState(0);
  // 0→1 progress through the "zoom out" beat, advanced every frame using
  // zoomOutEase (slow → sharp mid-speed spike → slow) instead of a plain
  // CSS transition — see zoomOutEase / onePctBlobStyle above for why.
  const [zoomProgress, setZoomProgress] = useState(0);
  // The JS equivalent of the old `300vmax` — but sized to the viewport's
  // actual corner-to-corner diagonal (plus a small safety margin) instead
  // of a blanket 3x oversize. That old 3x figure meant the blob was still
  // bigger than the screen for roughly the first two-thirds of the shrink,
  // so nothing was visibly happening on screen yet — by the time it got
  // small enough to see, most of the eased curve (including the "spike")
  // had already played out off-screen, and what was left just looked like
  // a plain, roughly-linear shrink. Starting right at the diagonal means
  // the blob's edge is visible (at least at the corners) from frame one,
  // so the full speed curve above is what actually gets seen.
  const [fullSizePx] = useState(() => {
    if (typeof window === 'undefined') return 1400;
    const diagonal = Math.sqrt(window.innerWidth ** 2 + window.innerHeight ** 2);
    return diagonal * 1.08; // small safety margin over the exact corner distance
  });

  // Drives the zoom-out size frame-by-frame (rather than letting the
  // browser interpolate a CSS transition) so the *speed* of the shrink can
  // follow a custom curve — slow at first, a sharp spike through the
  // middle, slow again as it settles — instead of a single, roughly-
  // symmetric cubic-bezier ease.
  useEffect(() => {
    if (phase !== 'zoomOut') return;
    let rafId = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min((now - start) / ONE_PCT_ZOOM_OUT_MS, 1);
      setZoomProgress(zoomOutEase(t));
      if (t < 1) {
        rafId = requestAnimationFrame(tick);
      }
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [phase]);

  // Smooth count-up, driven by requestAnimationFrame rather than a handful
  // of discrete setTimeout jumps — every frame nudges the number forward
  // slightly, which is what actually reads as "smooth" instead of "snappy".
  useEffect(() => {
    let rafId = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min((now - start) / ONE_PCT_COUNT_MS, 1);
      const eased = easeOutCubic(t);
      if (t >= 1) {
        setCountLabel(`${ONE_PCT_TARGET}%`);
        return;
      }
      setCountLabel(`${(eased * ONE_PCT_TARGET).toFixed(1)}%`);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    // Mount each word right as its turn comes up.
    ONE_PCT_WORDS.forEach((_, i) => {
      timers.push(
        setTimeout(() => setVisibleWordCount(i + 1), ONE_PCT_WORD_START_MS + i * ONE_PCT_WORD_STAGGER_MS)
      );
    });

    // Exit sequence — each beat scheduled off the end of the last. No grow
    // beat anymore: the gradient just dissolves in at full size, holds for
    // a breath, then eases straight down into the badge.
    const wordsOutAt = ONE_PCT_TOTAL_MS;
    const gradientInAt = wordsOutAt + ONE_PCT_WORDS_OUT_MS;
    const zoomOutAt = gradientInAt + ONE_PCT_GRADIENT_IN_MS + ONE_PCT_GRADIENT_HOLD_MS;
    const badgeRevealAt = zoomOutAt + ONE_PCT_ZOOM_OUT_MS;
    const finalFadeAt = badgeRevealAt + ONE_PCT_BADGE_REVEAL_MS + ONE_PCT_BADGE_HOLD_MS;
    const completeAt = finalFadeAt + ONE_PCT_FINAL_FADE_MS;

    timers.push(setTimeout(() => setPhase('wordsOut'), wordsOutAt));
    timers.push(setTimeout(() => setPhase('gradientIn'), gradientInAt));
    timers.push(setTimeout(() => setPhase('zoomOut'), zoomOutAt));
    timers.push(setTimeout(() => setPhase('badgeReveal'), badgeRevealAt));
    timers.push(setTimeout(() => setPhase('finalFade'), finalFadeAt));
    timers.push(setTimeout(onComplete, completeAt));

    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const wordsCollapsing = phase !== 'intro';
  const onePctVisible = phase === 'intro' || phase === 'wordsOut';
  const badgeContentVisible = phase === 'badgeReveal' || phase === 'finalFade';

  return (
    <div
      className={`fixed inset-0 z-[1001] flex items-center justify-center bg-zinc-950 px-4 sm:px-6 transition-opacity ease-out ${phase !== 'intro' ? 'pointer-events-none' : ''}`}
      style={{ transitionDuration: `${ONE_PCT_FINAL_FADE_MS}ms`, opacity: phase === 'finalFade' ? 0 : 1 }}
      aria-hidden="true"
    >
      <style>{ONE_PCT_KEYFRAMES}</style>
      <style>{INTRO_PULSE_KEYFRAMES}</style>

      {/* Soft glow echoing IntroReveal's own pulse, so the reveal feels
          continuous with what's coming next rather than a hard cut. */}
      <div
        className="fixed left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/25 blur-2xl animate-[akyos-intro-pulse_1.6s_ease-out_infinite] pointer-events-none"
        style={{ opacity: badgeContentVisible ? 1 : 0, transition: `opacity ${ONE_PCT_BADGE_REVEAL_MS}ms ease-out`, zIndex: 1 }}
      />

      {/* The liquid blob: dissolves into view already full-screen, then
          eases smoothly down (zooms out) into the badge shape. Its own
          background is the same moving/shining liquid gradient used
          everywhere else. */}
      <div style={onePctBlobStyle(phase, zoomProgress, fullSizePx)}>
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ opacity: badgeContentVisible ? 1 : 0, transition: `opacity ${ONE_PCT_BADGE_REVEAL_MS}ms ease-out` }}
        >
          <GraduationCap className="h-7 w-7 text-neutral-950" strokeWidth={2} />
        </div>
      </div>

      {/* Wordmark, revealed alongside the badge once it's settled — lands
          in the exact spot IntroReveal's own wordmark sits below its badge. */}
      <div
        className="fixed left-1/2 text-center"
        style={{
          top: 'calc(50% + 44px)',
          transform: 'translateX(-50%)',
          opacity: badgeContentVisible ? 1 : 0,
          transition: `opacity ${ONE_PCT_BADGE_REVEAL_MS}ms ease-out 90ms`,
          zIndex: 2,
        }}
      >
        <p className="text-[17px] font-semibold tracking-tight text-neutral-50">Akyos</p>
        <p className="mt-1 text-[12.5px] text-neutral-500">Your Answer to Chaos</p>
      </div>

      <div
        className="flex flex-nowrap items-baseline justify-center gap-x-1.5 sm:gap-x-3 text-center whitespace-nowrap"
        style={{ fontFamily: "'Poppins', sans-serif" }}
      >
        {/* "1%" — smooth eased count-up, rendered as a liquid, glowing
            animated gradient. Text content just updates in place each
            frame — nothing remounts, so there's no per-frame pop, only
            the number itself gliding forward. Dissolves away right as the
            blob above starts growing from the same spot. */}
        <span
          className="relative inline-block align-baseline"
          style={{
            animation: 'akyos-glow-pulse 2.2s ease-in-out infinite',
            opacity: onePctVisible ? 1 : 0,
            transition: 'opacity 180ms ease-out',
          }}
        >
          <span
            className={`inline-block min-w-[3ch] text-center tabular-nums font-extrabold ${ONE_PCT_TEXT_CLASS}`}
            style={{
              animation: 'akyos-liquid-gradient 3s ease-in-out infinite',
              backgroundImage:
                'linear-gradient(110deg, #a78bfa 0%, #f0abfc 25%, #818cf8 50%, #f0abfc 75%, #a78bfa 100%)',
              backgroundSize: '250% 100%',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              color: 'transparent',
            }}
          >
            {countLabel}
          </span>
        </span>

        {/* "Better Every Day." — each word mounts and slowly drifts/
            dissolves into view, one at a time, so words not yet due
            don't reserve any space. On exit the whole row collapses
            (fades + shrinks to 0 width) together, rather than each word
            fading independently, which is what lets "1%" glide smoothly
            back to dead-center as this shrinks beside it. */}
        <div
          className="flex items-baseline gap-x-1.5 sm:gap-x-3 overflow-hidden"
          style={{
            maxWidth: wordsCollapsing ? '0px' : '900px',
            opacity: wordsCollapsing ? 0 : 1,
            transition: `max-width ${ONE_PCT_WORDS_OUT_MS}ms cubic-bezier(0.65,0,0.35,1), opacity ${ONE_PCT_WORDS_OUT_MS}ms ease-in`,
          }}
        >
          {ONE_PCT_WORDS.slice(0, visibleWordCount).map((word) => (
            <span
              key={word}
              className={`inline-block text-white font-semibold ${ONE_PCT_TEXT_CLASS}`}
              style={{ animation: `akyos-word-fade-in ${ONE_PCT_WORD_FADE_MS}ms cubic-bezier(0.19,1,0.22,1) both` }}
            >
              {word}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// Keyframes + helper for the sign-in screen's own reveal: each box
// (badge, heading, inputs, button, links) slides in from the left with a
// short delay stacked on top of the previous one — a "staircase" cascade
// rather than everything popping in at once. Timed to start right as
// IntroReveal's overlay begins fading (INTRO_REVEAL_AT_MS), so the two
// handoffs read as one continuous motion instead of two separate beats.
// Pure CSS (animation-delay), so no state needs to be threaded down from
// IntroReveal — the delay clock starts the moment each element mounts,
// which happens in the same initial render as the overlay itself.
const CASCADE_KEYFRAMES = `
  @keyframes akyos-cascade-in {
    from { opacity: 0; transform: translateX(-22px); }
    to { opacity: 1; transform: translateX(0); }
  }
`;
const CASCADE_STEP_MS = 130; // was 90 — more breathing room between each element's turn
const cascadeStyle = (index: number): React.CSSProperties => ({
  animation: `akyos-cascade-in 750ms cubic-bezier(0.16,1,0.3,1) ${INTRO_REVEAL_AT_MS + index * CASCADE_STEP_MS}ms both`,
});

// Once cloud data is pulled into localStorage, every piece of state in
// JEEDashboard that reads localStorage.getItem(...) inside a useState
// initializer already ran BEFORE the pull finished (those initializers only
// run once, on mount). So instead of trying to force-update dozens of
// pieces of state, we do one clean reload after the pull — same pattern
// your own DataBackupCard import flow already uses. A sessionStorage flag
// stops it from looping.
const SYNCED_FLAG = 'dcc_cloud_synced_this_session';

type Stage = 'checking' | 'auth' | 'syncing' | 'setPasscode' | 'passcode' | 'forgotPassword' | 'resetPassword';

export default function AuthGate({ onUnlock }: { onUnlock: () => void }) {
  const [stage, setStage] = useState<Stage>('checking');
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  // Plays once on mount: a full-screen branded reveal (logo, then a split
  // "curtain" opening) that sits above whatever stage resolves underneath
  // it, so the app never flashes straight into a bare loading spinner.
  const [showIntro, setShowIntro] = useState(true);
  // Plays first, before IntroReveal — the "1% Better Every Day." beat.
  // Only once this clears does IntroReveal (and the stage cascade behind
  // it) start its own clock, so the two intros play back to back rather
  // than racing each other underneath an opaque screen.
  const [showOnePercentIntro, setShowOnePercentIntro] = useState(true);

  // --- email/password form state ---
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // True while the email field has keyboard focus (cursor typing in it) —
  // drives the animated gradient sweep border, same treatment
  // PasswordField now uses for its own focus state.
  const [emailFocused, setEmailFocused] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [signupNotice, setSignupNotice] = useState('');
  const emailInputRef = useRef<HTMLInputElement>(null);

  // --- Google OAuth state ---
  const [googleBusy, setGoogleBusy] = useState(false);
  // Hover flag for "Continue with Google" — drives the sweep overlay
  // below, same as the other hover-gated pills elsewhere in the app.
  const [googleHovered, setGoogleHovered] = useState(false);
  const [googleError, setGoogleError] = useState('');

  // --- "choose your passcode" (signup) state ---
  const [pcSetupPhase, setPcSetupPhase] = useState<'enter' | 'confirm'>('enter');
  const [pcSetupFirst, setPcSetupFirst] = useState('');
  const [pcSetupValue, setPcSetupValue] = useState('');
  const [pcSetupError, setPcSetupError] = useState('');
  const [pcSetupBusy, setPcSetupBusy] = useState(false);
  const pcSetupInputRef = useRef<HTMLInputElement>(null);

  // --- "enter your passcode" (returning) state ---
  const [pcValue, setPcValue] = useState('');
  const [pcError, setPcError] = useState(false);
  const [pcChecking, setPcChecking] = useState(false);
  const pcInputRef = useRef<HTMLInputElement>(null);

  // --- forgot-password (send reset email) state ---
  const [resetEmail, setResetEmail] = useState('');
  // Same focus-gated sweep as the sign-in email field, for the "Reset
  // Your Password" email box.
  const [resetEmailFocused, setResetEmailFocused] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSent, setResetSent] = useState(false);

  // --- set-new-password (after clicking the emailed recovery link) state ---
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [newPasswordBusy, setNewPasswordBusy] = useState(false);
  const [newPasswordError, setNewPasswordError] = useState('');

  // The staggered cascade-in (cascadeStyle) is only meant to play once, on
  // the initial page load. Stage state can flip to 'auth' while the "1%
  // Better Every Day" intro is still covering the screen, so this timer is
  // keyed off the sign-in screen's actual first mount (once that intro has
  // cleared) rather than off this component's own mount — otherwise the
  // "cascade already played" flag could flip before the cascade was ever
  // visible, and it would render as a flat fade instead of a stagger.
  const authCascadeStartedRef = useRef(false);
  const [authCascadeDone, setAuthCascadeDone] = useState(false);
  useEffect(() => {
    if (showOnePercentIntro || stage !== 'auth' || authCascadeStartedRef.current) return;
    authCascadeStartedRef.current = true;
    const totalMs = INTRO_REVEAL_AT_MS + 8 * CASCADE_STEP_MS + 750;
    const t = setTimeout(() => setAuthCascadeDone(true), totalMs);
    return () => clearTimeout(t);
  }, [stage, showOnePercentIntro]);
  const authCascadeStyle = (index: number): React.CSSProperties =>
    authCascadeDone ? {} : cascadeStyle(index);

  const decidePostSyncStage = (userId: string) => {
    setPendingUserId(userId);
    const cachedHash = localStorage.getItem(PASSCODE_HASH_KEY);
    setStage(cachedHash ? 'passcode' : 'setPasscode');
  };

  const syncThenContinue = async (userId: string) => {
    // PHASE 1 FIX: if this browser's local storage currently belongs to a
    // different account (or no account at all), wipe it before doing
    // anything else. Otherwise a returning account's sign-in could silently
    // keep whatever the previous account on this device left behind for any
    // key their own cloud snapshot doesn't happen to cover.
    const wasReset = ensureAccountIsolation(userId);
    if (wasReset) {
      // The local passcode hash (and everything else) was just wiped as
      // part of that reset — sessionStorage's "already synced" flag from a
      // previous account is now stale too, so force a real sync below
      // instead of trusting it.
      sessionStorage.removeItem(SYNCED_FLAG);
    }
    if (sessionStorage.getItem(SYNCED_FLAG) === 'true') {
      decidePostSyncStage(userId);
      return;
    }
    setStage('syncing');
    try {
      await pullFromCloud(userId);
    } catch (e) {
      console.error('[AuthGate] cloud pull failed', e);
      // Don't block the user out of their own app over a network hiccup —
      // fall through using whatever is already cached locally.
    }
    try {
      const hash = await getPasscodeHash(userId);
      if (hash) localStorage.setItem(PASSCODE_HASH_KEY, hash);
    } catch (e) {
      console.error('[AuthGate] passcode fetch failed', e);
    }
    sessionStorage.setItem(SYNCED_FLAG, 'true');
    window.location.reload();
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        syncThenContinue(data.session.user.id);
      } else {
        setStage('auth');
      }
    });

    // Clicking the "reset your password" link in the email lands back here
    // with a temporary recovery session. Supabase fires this event when
    // that happens — intercept it before the normal auth flow takes over.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setStage('resetPassword');
      }
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // renderStage() — and with it, every input below — only mounts once
    // the "1% Better Every Day." beat clears (see the render at the bottom
    // of this component). Focusing before that is a no-op on a ref that's
    // still null, and since this effect used to only depend on `stage`, it
    // never got a second chance once the input actually appeared. Keying
    // it on showOnePercentIntro too means it re-fires the moment the real
    // content mounts, so the cursor is guaranteed to land in the box
    // instead of the person needing to click in before they can type.
    if (showOnePercentIntro) return;
    if (stage === 'passcode') {
      const t = setTimeout(() => pcInputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
    if (stage === 'setPasscode') {
      const t = setTimeout(() => pcSetupInputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
    if (stage === 'auth') {
      // The email field cascades in with its own entrance animation (see
      // cascadeStyle below) — focusing it timed to land right as that
      // animation finishes means the cursor is already blinking inside the
      // box the instant it's visually settled, instead of the person having
      // to click into it first before they can type.
      const focusDelay = INTRO_REVEAL_AT_MS + 4 * CASCADE_STEP_MS + 750;
      const t = setTimeout(() => emailInputRef.current?.focus(), focusDelay);
      return () => clearTimeout(t);
    }
  }, [stage, showOnePercentIntro]);

  // --- returning-user passcode check ---
  useEffect(() => {
    if (pcValue.length !== PASSCODE_LENGTH || !pendingUserId) return;
    let cancelled = false;
    setPcChecking(true);
    (async () => {
      const hash = await hashPasscode(pcValue, pendingUserId);
      const cached = localStorage.getItem(PASSCODE_HASH_KEY);
      if (cancelled) return;
      setPcChecking(false);
      if (hash === cached) {
        onUnlock();
      } else {
        setPcError(true);
        setTimeout(() => {
          setPcValue('');
          setPcError(false);
          pcInputRef.current?.focus();
        }, 500);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pcValue, pendingUserId]);

  // --- new-account passcode setup (two-step: enter, then confirm) ---
  useEffect(() => {
    if (pcSetupValue.length !== PASSCODE_LENGTH) return;
    if (pcSetupPhase === 'enter') {
      setPcSetupFirst(pcSetupValue);
      setPcSetupValue('');
      setPcSetupPhase('confirm');
      return;
    }
    // confirm phase
    if (pcSetupValue === pcSetupFirst) {
      finalizeNewPasscode(pcSetupValue);
    } else {
      setPcSetupError("Those didn't match — let's try again.");
      setTimeout(() => {
        setPcSetupPhase('enter');
        setPcSetupFirst('');
        setPcSetupValue('');
        setPcSetupError('');
        pcSetupInputRef.current?.focus();
      }, 700);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pcSetupValue]);

  const finalizeNewPasscode = async (finalPasscode: string) => {
    if (!pendingUserId) return;
    setPcSetupBusy(true);
    setPcSetupError('');
    try {
      // Defensive re-check: this is the last moment before anything from
      // this device reaches the cloud under pendingUserId. ensureAccountIsolation
      // is a cheap no-op if this browser is already correctly bound to this
      // account (the normal case) — it only actually wipes anything if it
      // finds a mismatch that every earlier call in this flow should have
      // already caught. Kept here as a backstop, not the primary fix.
      ensureAccountIsolation(pendingUserId);
      const hash = await hashPasscode(finalPasscode, pendingUserId);
      await setPasscodeHash(pendingUserId, hash);
      localStorage.setItem(PASSCODE_HASH_KEY, hash);
      // Save whatever's currently on this device as the account's baseline
      // cloud copy (matters most for a brand-new signup with existing
      // local data already sitting in this browser).
      await pushToCloud(pendingUserId).catch(() => {});
      sessionStorage.setItem(SYNCED_FLAG, 'true');
      // Reload rather than calling onUnlock() directly. JEEDashboard reads
      // config/onboarding state from localStorage exactly once, at mount —
      // if this browser tab was already sitting open (and mounted) since
      // before this signup, flipping `unlocked` in place would leave it
      // holding whatever was in memory from before, even though
      // localStorage itself is now correctly wiped/scoped to this account.
      // Reloading forces a genuinely fresh mount that re-reads the
      // now-correct localStorage — the same reason the sign-in flow
      // (syncThenContinue, above) already reloads. The one cost: a
      // brand-new account has to re-enter the passcode it just set, once,
      // right after this reload — worth it for the guarantee.
      window.location.reload();
    } catch (e) {
      console.error('[AuthGate] failed to save passcode', e);
      setPcSetupError('Could not save your passcode — check your connection and try again.');
      setPcSetupPhase('enter');
      setPcSetupFirst('');
      setPcSetupValue('');
    } finally {
      setPcSetupBusy(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setSignupNotice('');
    setAuthBusy(true);
    try {
      if (authMode === 'signup') {
        if (password.length < 8) {
          setAuthError('Password must be at least 8 characters.');
          setAuthBusy(false);
          return;
        }
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.user && !data.session) {
          // Email confirmation is turned on in the Supabase dashboard, so
          // there's no session yet — but `data.user.id` (the new account's
          // real id) is already known. Wipe this browser's local storage
          // for it RIGHT NOW rather than waiting for the eventual sign-in
          // after confirming: leaving this branch without calling
          // ensureAccountIsolation() was exactly the gap that let a
          // previous account's leftover localStorage in this browser
          // (config, onboarding flag, etc.) sit untouched until sign-in,
          // and — worse — meant nothing had yet bound this browser to the
          // NEW account either.
          ensureAccountIsolation(data.user.id);
          setSignupNotice('Account created — check your email to confirm it, then sign in.');
          setAuthMode('signin');
          setAuthBusy(false);
          return;
        }
        if (data.session?.user) {
          // Brand new account — nothing to pull from the cloud, so skip
          // straight to "choose your passcode" instead of a sync cycle.
          //
          // PHASE 1 FIX: this used to be the exact spot where a previous
          // account's leftover localStorage (routine, config, calendar,
          // etc.) would get adopted as this brand-new account's data —
          // finalizeNewPasscode() below pushes whatever's currently in
          // localStorage to the cloud as this account's baseline. Wiping
          // first guarantees that baseline is genuinely empty/default for
          // every new signup, regardless of what account last used this
          // browser.
          ensureAccountIsolation(data.session.user.id);
          sessionStorage.setItem(SYNCED_FLAG, 'true');
          setPendingUserId(data.session.user.id);
          setStage('setPasscode');
          setAuthBusy(false);
          return;
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.session?.user) {
          await syncThenContinue(data.session.user.id);
          return;
        }
      }
    } catch (err: any) {
      setAuthError(err?.message || 'Something went wrong. Try again.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleError('');
    setGoogleBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
      // Supabase takes the browser to Google's consent screen and back —
      // there's nothing more to do here. The redirect back lands on a
      // fresh mount of this component, whose existing getSession() check
      // on mount picks up the new session and continues the normal flow.
    } catch (err: any) {
      setGoogleError(err?.message || 'Could not start Google sign-in. Try again.');
      setGoogleBusy(false);
    }
  };

  const handleSendResetEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      setResetSent(true);
    } catch (err: any) {
      setResetError(err?.message || 'Could not send the reset email. Try again.');
    } finally {
      setResetBusy(false);
    }
  };

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewPasswordError('');
    if (newPassword.length < 8) {
      setNewPasswordError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setNewPasswordError("Those didn't match — try again.");
      return;
    }
    setNewPasswordBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        await syncThenContinue(data.session.user.id);
      } else {
        setStage('auth');
      }
    } catch (err: any) {
      setNewPasswordError(err?.message || 'Could not update your password. Try again.');
    } finally {
      setNewPasswordBusy(false);
    }
  };

  const makeDigitHandler = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value.replace(/\D/g, '').slice(0, PASSCODE_LENGTH));
  };

  // ---------------- render ----------------

  const renderStage = (): React.ReactNode => {
  if (stage === 'checking' || stage === 'syncing') {
    return (
      <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-zinc-950 px-6 gap-3">
        <Loader2 className="h-6 w-6 text-violet-400 animate-spin" strokeWidth={2} />
        <p className="text-[12.5px] text-neutral-500">
          {stage === 'syncing' ? 'Syncing your data from the cloud…' : 'Loading…'}
        </p>
      </div>
    );
  }

  if (stage === 'auth') {
    return (
      <div className="fixed inset-0 z-[999] flex bg-zinc-950">
        <style>{CASCADE_KEYFRAMES}</style>
        <SignInVisualPanel />

        <div className="flex h-full w-full flex-col items-center justify-center px-6 lg:w-1/2">
          <div
            className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl shadow-lg shadow-violet-500/20"
            style={liquidFillStyle(authCascadeStyle(0))}
          >
            <Mail className="h-5 w-5 text-neutral-950" strokeWidth={2} />
          </div>

          <h1 className={`text-[15px] font-semibold tracking-tight text-neutral-50 ${authMode === 'signin' ? 'mb-8' : 'mb-1.5'}`} style={authCascadeStyle(1)}>
            {authMode === 'signin' ? 'Sign In' : 'Create Account'}
          </h1>
          {authMode !== 'signin' && (
            <p className="mb-8 max-w-xs text-center text-[12.5px] leading-relaxed text-neutral-500" style={authCascadeStyle(2)}>
              You'll pick your own passcode right after this.
            </p>
          )}

          <button
            type="button"
            onClick={handleGoogleSignIn}
            onMouseEnter={() => setGoogleHovered(true)}
            onMouseLeave={() => setGoogleHovered(false)}
            disabled={googleBusy}
            className="relative overflow-hidden mb-4 flex w-full max-w-xs items-center justify-center gap-2.5 rounded-xl border border-neutral-800 bg-neutral-900/80 py-3 text-[13px] font-semibold text-neutral-100 transition-colors hover:bg-neutral-900 disabled:opacity-60"
            style={authCascadeStyle(2)}
          >
            {googleHovered && !googleBusy && (
              // Same hover-gated sweep border as the rest of the app —
              // ring-only cutout filled with the local liquidFillStyle()
              // brand gradient, revealed via the --akyos-sweep mask
              // (keyframes already injected page-wide by the <style> tag
              // at the bottom of this component).
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-xl"
                style={{ animation: SWEEP_REVEAL_ANIMATION, ...SWEEP_REVEAL_STYLE }}
              >
                <div
                  className="absolute inset-0 rounded-xl"
                  style={{
                    padding: '1.5px',
                    WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                    WebkitMaskComposite: 'xor',
                    maskComposite: 'exclude',
                    ...liquidFillStyle(),
                  } as React.CSSProperties}
                />
              </div>
            )}
            <GoogleIcon className="h-4 w-4" />
            {googleBusy ? 'Connecting…' : 'Continue with Google'}
          </button>
          {googleError && <p className="mb-4 max-w-xs text-center text-[12px] text-rose-400">{googleError}</p>}

          <div className="mb-5 flex w-full max-w-xs items-center gap-3" style={authCascadeStyle(3)}>
            <div className="h-px flex-1 bg-neutral-800" />
            <span className="text-[10.5px] font-semibold uppercase tracking-wider text-neutral-600">or</span>
            <div className="h-px flex-1 bg-neutral-800" />
          </div>

          <form onSubmit={handleAuthSubmit} className="w-full max-w-xs space-y-3">
            <div className="relative">
              <input
                ref={emailInputRef}
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                placeholder="Email"
                className="w-full rounded-xl border border-neutral-800 bg-neutral-900/80 px-4 py-3 text-[13px] text-neutral-100 placeholder-neutral-600 outline-none transition-colors focus:border-violet-500/50"
                style={authCascadeStyle(4)}
              />
              {emailFocused && (
                // Same animated gradient sweep border as the dashboard's
                // <Card> bento boxes and header badges — ring-only cutout
                // filled with the local liquidFillStyle() brand gradient,
                // revealed via the --akyos-sweep mask, gated on focus
                // (cursor in the field) instead of hover since this is a
                // text input. PasswordField below gets the matching
                // treatment internally.
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-xl"
                  style={{ animation: SWEEP_REVEAL_ANIMATION, ...SWEEP_REVEAL_STYLE }}
                >
                  <div
                    className="absolute inset-0 rounded-xl"
                    style={{
                      padding: '1.5px',
                      WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                      WebkitMaskComposite: 'xor',
                      maskComposite: 'exclude',
                      ...liquidFillStyle(),
                    } as React.CSSProperties}
                  />
                </div>
              )}
            </div>
            <PasswordField
              value={password}
              onChange={setPassword}
              required
              minLength={8}
              autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'}
              placeholder="Password (min 8 characters)"
              showStrength={authMode === 'signup'}
              className="w-full rounded-xl border border-neutral-800 bg-neutral-900/80 px-4 py-3 pr-11 text-[13px] text-neutral-100 placeholder-neutral-600 outline-none transition-colors focus:border-violet-500/50"
              style={authCascadeStyle(5)}
            />

            {authError && <p className="text-[12px] text-rose-400">{authError}</p>}
            {signupNotice && <p className="text-[12px] text-violet-400">{signupNotice}</p>}

            <button
              type="submit"
              disabled={authBusy}
              className="w-full rounded-xl py-3 text-[13px] font-semibold text-neutral-950 transition-opacity disabled:opacity-60"
              style={liquidFillStyle(authCascadeStyle(6))}
            >
              {authBusy ? 'Please wait…' : authMode === 'signin' ? 'Sign In' : 'Sign Up'}
            </button>
          </form>

          {authMode === 'signin' && (
            <button
              onClick={() => {
                setResetEmail(email);
                setResetError('');
                setResetSent(false);
                setStage('forgotPassword');
              }}
              className="mt-4 text-[12px] font-medium text-neutral-500 hover:text-neutral-300"
              style={authCascadeStyle(7)}
            >
              Forgot password?
            </button>
          )}

          <button
            onClick={() => {
              setAuthMode(authMode === 'signin' ? 'signup' : 'signin');
              setAuthError('');
              setSignupNotice('');
            }}
            className="mt-5 text-[12px] font-medium text-violet-400 hover:text-violet-300"
            style={authCascadeStyle(8)}
          >
            {authMode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'setPasscode') {
    const boxes = Array.from({ length: PASSCODE_LENGTH });
    const value = pcSetupValue;
    return (
      <div
        className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-zinc-950 px-6"
        onClick={() => pcSetupInputRef.current?.focus()}
      >
        <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl shadow-lg shadow-violet-500/20" style={liquidFillStyle()}>
          <ShieldCheck className="h-5 w-5 text-neutral-950" strokeWidth={2} />
        </div>

        <h1 className="mb-1.5 text-[15px] font-semibold tracking-tight text-neutral-50">
          {pcSetupPhase === 'enter' ? 'Choose a Passcode' : 'Confirm Your Passcode'}
        </h1>
        <p className="mb-8 max-w-xs text-center text-[12.5px] leading-relaxed text-neutral-500">
          {pcSetupPhase === 'enter'
            ? "Pick 6 digits. This is what you'll use to unlock the app on this and every device — it's yours alone."
            : 'Enter it one more time to confirm.'}
        </p>

        <div className={`relative flex gap-2.5 ${pcSetupError ? 'animate-shake' : ''}`}>
          {boxes.map((_, i) => {
            const filled = i < value.length;
            const isCurrent = i === value.length;
            return (
              <div
                key={i}
                className={`flex h-12 w-10 items-center justify-center rounded-xl border text-lg font-semibold tabular-nums transition-colors duration-150 ${
                  pcSetupError
                    ? 'border-rose-500/50 bg-rose-500/[0.06] text-rose-300'
                    : isCurrent
                    ? 'border-violet-500/50 bg-neutral-900/80 text-neutral-100'
                    : filled
                    ? 'border-neutral-700 bg-neutral-900/80 text-neutral-100'
                    : 'border-neutral-800 bg-neutral-900/40 text-neutral-700'
                }`}
              >
                {filled ? '•' : ''}
              </div>
            );
          })}
          <input
            ref={pcSetupInputRef}
            value={value}
            onChange={makeDigitHandler(setPcSetupValue)}
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            disabled={pcSetupBusy}
            aria-label="New passcode"
            className="absolute inset-0 h-full w-full cursor-default opacity-0"
          />
        </div>

        <p className={`mt-5 h-4 text-[12px] font-medium text-rose-400 transition-opacity duration-150 ${pcSetupError ? 'opacity-100' : 'opacity-0'}`}>
          {pcSetupError || ' '}
        </p>
        {pcSetupBusy && <p className="text-[12px] text-neutral-500 -mt-2">Saving…</p>}
      </div>
    );
  }

  if (stage === 'forgotPassword') {
    return (
      <div className="fixed inset-0 z-[999] flex bg-zinc-950">
        <SignInVisualPanel />

        <div className="flex h-full w-full flex-col items-center justify-center px-6 lg:w-1/2">
          <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl shadow-lg shadow-violet-500/20" style={liquidFillStyle()}>
            <Mail className="h-5 w-5 text-neutral-950" strokeWidth={2} />
          </div>

          <h1 className="mb-1.5 text-[15px] font-semibold tracking-tight text-neutral-50">
            Reset Your Password
          </h1>
          <p className="mb-8 max-w-xs text-center text-[12.5px] leading-relaxed text-neutral-500">
            {resetSent
              ? "Check your inbox — we've sent a link to reset your password."
              : "Enter your account email and we'll send you a reset link."}
          </p>

          {!resetSent ? (
            <form onSubmit={handleSendResetEmail} className="w-full max-w-xs space-y-3">
              <div className="relative">
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  onFocus={() => setResetEmailFocused(true)}
                  onBlur={() => setResetEmailFocused(false)}
                  placeholder="Email"
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-900/80 px-4 py-3 text-[13px] text-neutral-100 placeholder-neutral-600 outline-none transition-colors focus:border-violet-500/50"
                />
                {resetEmailFocused && (
                  // Same focus-gated sweep as the sign-in email field —
                  // ring-only cutout filled with the local
                  // liquidFillStyle() brand gradient, revealed via the
                  // --akyos-sweep mask (keyframes already injected page-
                  // wide by the <style> tag at the bottom of this
                  // component).
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-xl"
                    style={{ animation: SWEEP_REVEAL_ANIMATION, ...SWEEP_REVEAL_STYLE }}
                  >
                    <div
                      className="absolute inset-0 rounded-xl"
                      style={{
                        padding: '1.5px',
                        WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                        WebkitMaskComposite: 'xor',
                        maskComposite: 'exclude',
                        ...liquidFillStyle(),
                      } as React.CSSProperties}
                    />
                  </div>
                )}
              </div>
              {resetError && <p className="text-[12px] text-rose-400">{resetError}</p>}
              <button
                type="submit"
                disabled={resetBusy}
                className="w-full rounded-xl py-3 text-[13px] font-semibold text-neutral-950 transition-opacity disabled:opacity-60"
                style={liquidFillStyle()}
              >
                {resetBusy ? 'Sending…' : 'Send Reset Link'}
              </button>
            </form>
          ) : (
            <CheckCircle2 className="h-8 w-8 text-violet-400" strokeWidth={2} />
          )}

          <button
            onClick={() => {
              setAuthError('');
              setStage('auth');
            }}
            className="mt-6 text-[12px] font-medium text-violet-400 hover:text-violet-300"
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'resetPassword') {
    return (
      <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-zinc-950 px-6">
        <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl shadow-lg shadow-violet-500/20" style={liquidFillStyle()}>
          <ShieldCheck className="h-5 w-5 text-neutral-950" strokeWidth={2} />
        </div>

        <h1 className="mb-1.5 text-[15px] font-semibold tracking-tight text-neutral-50">
          Set a New Password
        </h1>
        <p className="mb-8 max-w-xs text-center text-[12.5px] leading-relaxed text-neutral-500">
          Choose a new password for your account.
        </p>

        <form onSubmit={handleSetNewPassword} className="w-full max-w-xs space-y-3">
          <PasswordField
            value={newPassword}
            onChange={setNewPassword}
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="New password (min 8 characters)"
            showStrength
            className="w-full rounded-xl border border-neutral-800 bg-neutral-900/80 px-4 py-3 pr-11 text-[13px] text-neutral-100 placeholder-neutral-600 outline-none transition-colors focus:border-violet-500/50"
          />
          <PasswordField
            value={newPasswordConfirm}
            onChange={setNewPasswordConfirm}
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Confirm new password"
            className="w-full rounded-xl border border-neutral-800 bg-neutral-900/80 px-4 py-3 pr-11 text-[13px] text-neutral-100 placeholder-neutral-600 outline-none transition-colors focus:border-violet-500/50"
          />
          {newPasswordError && <p className="text-[12px] text-rose-400">{newPasswordError}</p>}
          <button
            type="submit"
            disabled={newPasswordBusy}
            className="w-full rounded-xl py-3 text-[13px] font-semibold text-neutral-950 transition-opacity disabled:opacity-60"
            style={liquidFillStyle()}
          >
            {newPasswordBusy ? 'Saving…' : 'Save New Password'}
          </button>
        </form>
      </div>
    );
  }

  // stage === 'passcode'
  const boxes = Array.from({ length: PASSCODE_LENGTH });
  return (
    <div
      className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-zinc-950 px-6"
      onClick={() => pcInputRef.current?.focus()}
    >
      <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl shadow-lg shadow-violet-500/20" style={liquidFillStyle()}>
        <Lock className="h-5 w-5 text-neutral-950" strokeWidth={2} />
      </div>

      <h1 className="mb-1.5 text-[15px] font-semibold tracking-tight text-neutral-50">Welcome Back</h1>
      <p className="mb-8 max-w-xs text-center text-[12.5px] leading-relaxed text-neutral-500">
        Enter your passcode to continue.
      </p>

      <div className={`relative flex gap-2.5 ${pcError ? 'animate-shake' : ''}`}>
        {boxes.map((_, i) => {
          const filled = i < pcValue.length;
          const isCurrent = i === pcValue.length;
          return (
            <div
              key={i}
              className={`flex h-12 w-10 items-center justify-center rounded-xl border text-lg font-semibold tabular-nums transition-colors duration-150 ${
                pcError
                  ? 'border-rose-500/50 bg-rose-500/[0.06] text-rose-300'
                  : isCurrent
                  ? 'border-violet-500/50 bg-neutral-900/80 text-neutral-100'
                  : filled
                  ? 'border-neutral-700 bg-neutral-900/80 text-neutral-100'
                  : 'border-neutral-800 bg-neutral-900/40 text-neutral-700'
              }`}
            >
              {filled ? '•' : ''}
            </div>
          );
        })}
        <input
          ref={pcInputRef}
          value={pcValue}
          onChange={makeDigitHandler(setPcValue)}
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          disabled={pcChecking}
          aria-label="Passcode"
          className="absolute inset-0 h-full w-full cursor-default opacity-0"
        />
      </div>

      <p className={`mt-5 h-4 text-[12px] font-medium text-rose-400 transition-opacity duration-150 ${pcError ? 'opacity-100' : 'opacity-0'}`}>
        Incorrect passcode
      </p>

      <button
        onClick={async () => {
          // PHASE 2 FIX: bring this in line with AccountPage's sign-out —
          // full wipe, not just the passcode hash, and sign-out happens
          // first so nothing can push stale/empty data mid-transition.
          sessionStorage.removeItem(SYNCED_FLAG);
          await supabase.auth.signOut();
          resetLocalAccountState();
          localStorage.removeItem(LAST_ACTIVE_USER_KEY);
          window.location.reload();
        }}
        className="mt-10 text-[11.5px] font-medium text-neutral-600 hover:text-neutral-400"
      >
        Not you? Sign out
      </button>
    </div>
  );
  }; // end renderStage

  return (
    <>
      <style>{NO_SELECT_CSS}</style>
      <style>{LIQUID_GRADIENT_KEYFRAMES}</style>
      {/* The `akyos-sweep-reveal` keyframes (and the `--akyos-sweep`
          @property they animate) live in lib/liquidFill.ts alongside the
          rest of the app's sweep effect, but AuthGate renders before the
          main App component ever mounts its own copy of these — so the
          Email/Password focus sweep added here needs its own injection,
          same as the liquid-fill keyframes just above. */}
      <style>{SWEEP_REVEAL_KEYFRAMES}</style>
      {/* Stage content (and its cascade-in) only mounts once the "1%
          Better Every Day." beat has cleared, so its cascade timers —
          and IntroReveal's — start together right after, instead of
          silently finishing underneath an opaque screen. */}
      {!showOnePercentIntro && renderStage()}
      {showOnePercentIntro ? (
        <OnePercentIntro onComplete={() => setShowOnePercentIntro(false)} />
      ) : (
        showIntro && <IntroReveal onComplete={() => setShowIntro(false)} />
      )}
    </>
  );
}