import React, { useEffect, useRef, useState } from 'react';
import { Lock, Mail, Loader2, ShieldCheck, CheckCircle2 } from 'lucide-react';
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

// Soft blurred color fields that make up the animated liquid gradient on
// the left half of the desktop sign-in screen. Colors match the app's
// existing sky -> violet -> fuchsia brand gradient used on every button
// and icon badge in this file, so the panel feels native rather than
// bolted on. Each blob drifts on its own lazy sine path and gently
// "breathes" (scales up/down); base positions/sizes are percentages of
// the panel so it reflows cleanly at any height.
const LIQUID_BLOBS = [
  { baseXPct: 30, baseYPct: 30, sizeVmin: 46, color: 'bg-sky-400', opacity: 'opacity-70', speed: 0.00017, driftX: 70, driftY: 50, pulseSpeed: 0.0009, phase: 0 },
  { baseXPct: 72, baseYPct: 24, sizeVmin: 54, color: 'bg-violet-500', opacity: 'opacity-70', speed: 0.00013, driftX: 90, driftY: 60, pulseSpeed: 0.0007, phase: 2.1 },
  { baseXPct: 60, baseYPct: 72, sizeVmin: 60, color: 'bg-fuchsia-500', opacity: 'opacity-60', speed: 0.00011, driftX: 80, driftY: 70, pulseSpeed: 0.0006, phase: 4.2 },
  { baseXPct: 20, baseYPct: 78, sizeVmin: 42, color: 'bg-indigo-500', opacity: 'opacity-60', speed: 0.0002, driftX: 60, driftY: 45, pulseSpeed: 0.001, phase: 1.3 },
];

// The left-half "liquid gradient" panel for the desktop sign-in layout.
// Pure CSS blur + a small rAF loop — no canvas needed. The blobs drift on
// their own slow paths and also lean toward the cursor (a cheap lerp
// toward normalized mouse position gives a "reacting to you" feel
// without anything twitchy). Only animates on lg+ screens; stays fully
// inert (no listeners, no rAF) below that since it's hidden there anyway.
function LiquidGradientPanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const blobElRefs = useRef<(HTMLDivElement | null)[]>([]);
  const targetMouse = useRef({ x: 0.5, y: 0.5 });
  const smoothMouse = useRef({ x: 0.5, y: 0.5 });

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    let raf = 0;
    let active = mq.matches;
    const startTime = performance.now();

    const tick = (now: number) => {
      if (!active) return;
      const elapsed = now - startTime;

      // Ease the raw cursor position toward a smoothed one so the panel
      // glides rather than snaps.
      smoothMouse.current.x += (targetMouse.current.x - smoothMouse.current.x) * 0.035;
      smoothMouse.current.y += (targetMouse.current.y - smoothMouse.current.y) * 0.035;
      const mx = (smoothMouse.current.x - 0.5) * 2; // -1..1
      const my = (smoothMouse.current.y - 0.5) * 2;

      LIQUID_BLOBS.forEach((b, i) => {
        const el = blobElRefs.current[i];
        if (!el) return;
        const dx = Math.sin(elapsed * b.speed + b.phase) * b.driftX + mx * (b.driftX * 0.9);
        const dy = Math.cos(elapsed * b.speed * 0.85 + b.phase) * b.driftY + my * (b.driftY * 0.9);
        const scale = 1 + Math.sin(elapsed * b.pulseSpeed + b.phase) * 0.12;
        el.style.transform = `translate3d(${dx}px, ${dy}px, 0) translate(-50%, -50%) scale(${scale})`;
      });

      raf = requestAnimationFrame(tick);
    };

    const start = () => {
      if (!active || raf) return;
      raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    const handleChange = (e: MediaQueryListEvent) => {
      active = e.matches;
      if (active) start(); else stop();
    };
    mq.addEventListener('change', handleChange);
    if (active) start();

    return () => {
      mq.removeEventListener('change', handleChange);
      stop();
    };
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    targetMouse.current = {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="relative hidden h-full overflow-hidden bg-zinc-950 lg:block lg:w-1/2"
    >
      {LIQUID_BLOBS.map((b, i) => (
        <div
          key={i}
          ref={(el) => { blobElRefs.current[i] = el; }}
          className={`pointer-events-none absolute rounded-full blur-[90px] mix-blend-screen ${b.color} ${b.opacity}`}
          style={{
            left: `${b.baseXPct}%`,
            top: `${b.baseYPct}%`,
            width: `${b.sizeVmin}vmin`,
            height: `${b.sizeVmin}vmin`,
            transform: 'translate(-50%, -50%)',
          }}
        />
      ))}
      {/* Keeps the blobs from washing out to pure white where they overlap,
          and grounds the panel back to the app's near-black base. */}
      <div className="pointer-events-none absolute inset-0 bg-zinc-950/35" />
    </div>
  );
}

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
        <LiquidGradientPanel />

        <div className="flex h-full w-full flex-col items-center justify-center px-6 lg:w-1/2">
          <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 via-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/20">
            <Mail className="h-5 w-5 text-neutral-950" strokeWidth={2} />
          </div>

          <h1 className="mb-1.5 text-[15px] font-semibold tracking-tight text-neutral-50">
            {authMode === 'signin' ? 'Sign In' : 'Create Account'}
          </h1>
          <p className="mb-8 max-w-xs text-center text-[12.5px] leading-relaxed text-neutral-500">
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
            />

            {authError && <p className="text-[12px] text-rose-400">{authError}</p>}
            {signupNotice && <p className="text-[12px] text-violet-400">{signupNotice}</p>}

            <button
              type="submit"
              disabled={authBusy}
              className="w-full rounded-xl bg-gradient-to-br from-sky-400 via-violet-500 to-fuchsia-500 py-3 text-[13px] font-semibold text-neutral-950 transition-opacity disabled:opacity-60"
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
        <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 via-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/20">
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
        <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 via-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/20">
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
              className="w-full rounded-xl bg-gradient-to-br from-sky-400 via-violet-500 to-fuchsia-500 py-3 text-[13px] font-semibold text-neutral-950 transition-opacity disabled:opacity-60"
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
        <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 via-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/20">
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
            className="w-full rounded-xl bg-gradient-to-br from-sky-400 via-violet-500 to-fuchsia-500 py-3 text-[13px] font-semibold text-neutral-950 transition-opacity disabled:opacity-60"
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
      <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 via-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/20">
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
}