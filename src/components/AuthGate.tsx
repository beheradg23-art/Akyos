import React, { useEffect, useRef, useState } from 'react';
import { Lock, Mail, Loader2, ShieldCheck, CheckCircle2, GraduationCap } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import {
  pullFromCloud,
  pushToCloud,
  hashPasscode,
  setPasscodeHash,
  getPasscodeHash,
  PASSCODE_HASH_KEY,
} from '../lib/cloudSync';

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

// The left-half visual panel for the desktop sign-in layout.
//
// Deliberately calm rather than busy: a near-black panel with a faint
// grain texture, a dim dot grid, and two very soft, slow-drifting brand-
// colored glows in the corners for a hint of color and depth. The one
// interactive touch is a "spotlight" — a brighter patch of the same dot
// grid, masked to a soft circle that follows the cursor — the same
// technique behind the hero backgrounds on sites like Linear and Vercel.
// No animation loop is needed for the spotlight: a single CSS custom
// property is written directly on mousemove and a CSS mask does the rest,
// so this whole panel costs nothing when the mouse isn't moving.
function SignInVisualPanel() {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--spot-x', `${e.clientX - rect.left}px`);
    el.style.setProperty('--spot-y', `${e.clientY - rect.top}px`);
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="relative hidden h-full overflow-hidden bg-zinc-950 lg:flex lg:w-1/2 lg:items-center lg:justify-center"
      style={{ ['--spot-x' as any]: '50%', ['--spot-y' as any]: '50%' }}
    >
      <style>{AMBIENT_DRIFT_KEYFRAMES}</style>

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

      {/* Dim base dot grid. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.09) 1px, transparent 1px)', backgroundSize: '26px 26px' }}
      />

      {/* Brighter dot grid, masked to a soft circle that tracks the
          cursor — the "spotlight" reveal. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(rgba(196,181,253,0.85) 1px, transparent 1px)',
          backgroundSize: '26px 26px',
          WebkitMaskImage: 'radial-gradient(240px circle at var(--spot-x) var(--spot-y), black, transparent 72%)',
          maskImage: 'radial-gradient(240px circle at var(--spot-x) var(--spot-y), black, transparent 72%)',
        }}
      />

      {/* Oversized, near-invisible wordmark in the corner — a quiet
          branding touch borrowed from the same minimal-auth-page school
          (Linear, Raycast) rather than decoration for its own sake. */}
      <span className="pointer-events-none absolute -bottom-10 -left-4 select-none text-[210px] font-black leading-none tracking-tighter text-white/[0.035]">
        Akyos
      </span>

      {/* The actual brand mark, centered — same icon badge + name used in
          the app's own header, so this panel reads as unmistakably
          "this app" rather than generic decoration. */}
      <div className="relative flex flex-col items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500 shadow-lg shadow-violet-500/20">
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

        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500 shadow-lg shadow-violet-500/30">
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
    from { opacity: 0; transform: translateX(-28px); }
    to { opacity: 1; transform: translateX(0); }
  }
`;
const CASCADE_STEP_MS = 90;
const cascadeStyle = (index: number): React.CSSProperties => ({
  animation: `akyos-cascade-in 550ms cubic-bezier(0.16,1,0.3,1) ${INTRO_REVEAL_AT_MS + index * CASCADE_STEP_MS}ms both`,
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

  // --- email/password form state ---
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [signupNotice, setSignupNotice] = useState('');

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
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSent, setResetSent] = useState(false);

  // --- set-new-password (after clicking the emailed recovery link) state ---
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [newPasswordBusy, setNewPasswordBusy] = useState(false);
  const [newPasswordError, setNewPasswordError] = useState('');

  const decidePostSyncStage = (userId: string) => {
    setPendingUserId(userId);
    const cachedHash = localStorage.getItem(PASSCODE_HASH_KEY);
    setStage(cachedHash ? 'passcode' : 'setPasscode');
  };

  const syncThenContinue = async (userId: string) => {
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
    if (stage === 'passcode') pcInputRef.current?.focus();
    if (stage === 'setPasscode') pcSetupInputRef.current?.focus();
  }, [stage]);

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
      const hash = await hashPasscode(finalPasscode, pendingUserId);
      await setPasscodeHash(pendingUserId, hash);
      localStorage.setItem(PASSCODE_HASH_KEY, hash);
      // Save whatever's currently on this device as the account's baseline
      // cloud copy (matters most for a brand-new signup with existing
      // local data already sitting in this browser).
      await pushToCloud(pendingUserId).catch(() => {});
      sessionStorage.setItem(SYNCED_FLAG, 'true');
      onUnlock();
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
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.user && !data.session) {
          // Email confirmation is turned on in the Supabase dashboard.
          setSignupNotice('Account created — check your email to confirm it, then sign in.');
          setAuthMode('signin');
          setAuthBusy(false);
          return;
        }
        if (data.session?.user) {
          // Brand new account — nothing to pull from the cloud, so skip
          // straight to "choose your passcode" instead of a sync cycle.
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
    if (newPassword.length < 6) {
      setNewPasswordError('Password must be at least 6 characters.');
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
            className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500 shadow-lg shadow-violet-500/20"
            style={cascadeStyle(0)}
          >
            <Mail className="h-5 w-5 text-neutral-950" strokeWidth={2} />
          </div>

          <h1 className="mb-1.5 text-[15px] font-semibold tracking-tight text-neutral-50" style={cascadeStyle(1)}>
            {authMode === 'signin' ? 'Sign In' : 'Create Account'}
          </h1>
          <p className="mb-8 max-w-xs text-center text-[12.5px] leading-relaxed text-neutral-500" style={cascadeStyle(2)}>
            {authMode === 'signin'
              ? 'Sign in to sync your command center across devices.'
              : "You'll pick your own passcode right after this."}
          </p>

          <form onSubmit={handleAuthSubmit} className="w-full max-w-xs space-y-3">
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full rounded-xl border border-neutral-800 bg-neutral-900/80 px-4 py-3 text-[13px] text-neutral-100 placeholder-neutral-600 outline-none transition-colors focus:border-violet-500/50"
              style={cascadeStyle(3)}
            />
            <input
              type="password"
              required
              minLength={6}
              autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (min 6 characters)"
              className="w-full rounded-xl border border-neutral-800 bg-neutral-900/80 px-4 py-3 text-[13px] text-neutral-100 placeholder-neutral-600 outline-none transition-colors focus:border-violet-500/50"
              style={cascadeStyle(4)}
            />

            {authError && <p className="text-[12px] text-rose-400">{authError}</p>}
            {signupNotice && <p className="text-[12px] text-violet-400">{signupNotice}</p>}

            <button
              type="submit"
              disabled={authBusy}
              className="w-full rounded-xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500 py-3 text-[13px] font-semibold text-neutral-950 transition-opacity disabled:opacity-60"
              style={cascadeStyle(5)}
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
              style={cascadeStyle(6)}
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
            style={cascadeStyle(7)}
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
        <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500 shadow-lg shadow-violet-500/20">
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
                {filled ? value[i] : ''}
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
      <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-zinc-950 px-6">
        <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500 shadow-lg shadow-violet-500/20">
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
            <input
              type="email"
              required
              autoComplete="email"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              placeholder="Email"
              className="w-full rounded-xl border border-neutral-800 bg-neutral-900/80 px-4 py-3 text-[13px] text-neutral-100 placeholder-neutral-600 outline-none transition-colors focus:border-violet-500/50"
            />
            {resetError && <p className="text-[12px] text-rose-400">{resetError}</p>}
            <button
              type="submit"
              disabled={resetBusy}
              className="w-full rounded-xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500 py-3 text-[13px] font-semibold text-neutral-950 transition-opacity disabled:opacity-60"
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
    );
  }

  if (stage === 'resetPassword') {
    return (
      <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-zinc-950 px-6">
        <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500 shadow-lg shadow-violet-500/20">
          <ShieldCheck className="h-5 w-5 text-neutral-950" strokeWidth={2} />
        </div>

        <h1 className="mb-1.5 text-[15px] font-semibold tracking-tight text-neutral-50">
          Set a New Password
        </h1>
        <p className="mb-8 max-w-xs text-center text-[12.5px] leading-relaxed text-neutral-500">
          Choose a new password for your account.
        </p>

        <form onSubmit={handleSetNewPassword} className="w-full max-w-xs space-y-3">
          <input
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password (min 6 characters)"
            className="w-full rounded-xl border border-neutral-800 bg-neutral-900/80 px-4 py-3 text-[13px] text-neutral-100 placeholder-neutral-600 outline-none transition-colors focus:border-violet-500/50"
          />
          <input
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={newPasswordConfirm}
            onChange={(e) => setNewPasswordConfirm(e.target.value)}
            placeholder="Confirm new password"
            className="w-full rounded-xl border border-neutral-800 bg-neutral-900/80 px-4 py-3 text-[13px] text-neutral-100 placeholder-neutral-600 outline-none transition-colors focus:border-violet-500/50"
          />
          {newPasswordError && <p className="text-[12px] text-rose-400">{newPasswordError}</p>}
          <button
            type="submit"
            disabled={newPasswordBusy}
            className="w-full rounded-xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500 py-3 text-[13px] font-semibold text-neutral-950 transition-opacity disabled:opacity-60"
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
      <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500 shadow-lg shadow-violet-500/20">
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
              {filled ? pcValue[i] : ''}
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
          sessionStorage.removeItem(SYNCED_FLAG);
          localStorage.removeItem(PASSCODE_HASH_KEY);
          await supabase.auth.signOut();
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
      {renderStage()}
      {showIntro && <IntroReveal onComplete={() => setShowIntro(false)} />}
    </>
  );
}