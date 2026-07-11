import React, { useEffect, useRef, useState } from 'react';
import { Fingerprint } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { hashPasscode, setPasscodeHash, getPasscodeHash, PASSCODE_HASH_KEY } from '../lib/cloudSync';
import { toast } from '../lib/toast';
import { haptic } from '../lib/haptics';

// ---------------------------------------------------------------------------
// Lets a signed-in user change the 6-digit app passcode from the Account
// page, without going through "forgot my passcode" / sign-out-and-back-in.
//
// Flow: current passcode (verified against the cached/cloud hash) -> new
// passcode -> confirm new passcode -> hash + save (cloud + local cache),
// same hashPasscode/setPasscodeHash plumbing AuthGate already uses for
// first-time setup, so both stay in sync.
// ---------------------------------------------------------------------------

const PASSCODE_LENGTH = 6;
type Step = 'current' | 'new' | 'confirm';

function PasscodeBoxes({
  value,
  error,
  onChange,
  inputRef,
  label,
}: {
  value: string;
  error: boolean;
  onChange: (v: string) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  label: string;
}) {
  const boxes = Array.from({ length: PASSCODE_LENGTH });
  return (
    <div className={`relative flex gap-2 ${error ? 'animate-shake' : ''}`}>
      {boxes.map((_, i) => {
        const filled = i < value.length;
        const isCurrent = i === value.length;
        return (
          <div
            key={i}
            className={`flex h-11 w-9 items-center justify-center rounded-lg border text-[15px] font-semibold tabular-nums transition-colors duration-150 ${
              error
                ? 'border-rose-500/50 bg-rose-500/[0.06] text-rose-300'
                : isCurrent
                ? 'border-violet-500/50 bg-neutral-900/80 text-neutral-100'
                : filled
                ? 'border-neutral-700 bg-neutral-900/80 text-neutral-100'
                : 'border-neutral-800 bg-neutral-950/40 text-neutral-700'
            }`}
          >
            {filled ? '•' : ''}
          </div>
        );
      })}
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, PASSCODE_LENGTH))}
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        aria-label={label}
        className="absolute inset-0 h-full w-full cursor-default opacity-0"
      />
    </div>
  );
}

export default function PasscodeChangeCard() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('current');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const currentRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      if (step === 'current') currentRef.current?.focus();
      if (step === 'new') nextRef.current?.focus();
      if (step === 'confirm') confirmRef.current?.focus();
    }, 50);
    return () => clearTimeout(t);
  }, [open, step]);

  const reset = () => {
    setStep('current');
    setCurrent('');
    setNext('');
    setConfirm('');
    setError(false);
  };

  const closeCard = () => {
    setOpen(false);
    reset();
  };

  // --- step 1: verify current passcode ---
  useEffect(() => {
    if (step !== 'current' || current.length !== PASSCODE_LENGTH || !userId) return;
    let cancelled = false;
    (async () => {
      try {
        const hash = await hashPasscode(current, userId);
        const cached = localStorage.getItem(PASSCODE_HASH_KEY) || (await getPasscodeHash(userId).catch(() => null));
        if (cancelled) return;
        if (hash === cached) {
          setError(false);
          setStep('new');
        } else {
          haptic.error();
          setError(true);
          setTimeout(() => {
            if (cancelled) return;
            setCurrent('');
            setError(false);
            currentRef.current?.focus();
          }, 500);
        }
      } catch {
        if (cancelled) return;
        toast.error('Could not verify your passcode — check your connection.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [current, step, userId]);

  // --- step 2 -> 3: capture new passcode, then ask for confirmation ---
  useEffect(() => {
    if (step !== 'new' || next.length !== PASSCODE_LENGTH) return;
    setStep('confirm');
  }, [next, step]);

  // --- step 3: confirm + save ---
  useEffect(() => {
    if (step !== 'confirm' || confirm.length !== PASSCODE_LENGTH || !userId) return;
    if (confirm !== next) {
      haptic.error();
      setError(true);
      setTimeout(() => {
        setStep('new');
        setNext('');
        setConfirm('');
        setError(false);
      }, 600);
      return;
    }
    (async () => {
      setBusy(true);
      try {
        const hash = await hashPasscode(confirm, userId);
        await setPasscodeHash(userId, hash);
        localStorage.setItem(PASSCODE_HASH_KEY, hash);
        haptic.success();
        toast.success('Passcode updated.');
        closeCard();
      } catch (err: any) {
        toast.error(err?.message || 'Could not update your passcode.');
        reset();
      } finally {
        setBusy(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirm, step, userId]);

  const stepCopy: Record<Step, string> = {
    current: 'Enter your current passcode',
    new: 'Choose a new passcode',
    confirm: 'Confirm your new passcode',
  };

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4 sm:p-5">
      <button
        onClick={() => (open ? closeCard() : setOpen(true))}
        className="flex w-full items-center gap-3 text-left"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-900 border border-neutral-800">
          <Fingerprint className="h-4.5 w-4.5 text-neutral-300" strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[13.5px] font-bold text-neutral-100">Change Passcode</h3>
          <p className="text-[11.5px] text-neutral-500">Update the 6-digit code that unlocks the app</p>
        </div>
      </button>

      {open && (
        <div className="mt-4 flex flex-col items-start gap-3 animate-fadeIn">
          <p className="text-[12px] text-neutral-400">{busy ? 'Saving…' : stepCopy[step]}</p>
          {step === 'current' && (
            <PasscodeBoxes value={current} error={error} onChange={setCurrent} inputRef={currentRef} label="Current passcode" />
          )}
          {step === 'new' && (
            <PasscodeBoxes value={next} error={false} onChange={setNext} inputRef={nextRef} label="New passcode" />
          )}
          {step === 'confirm' && (
            <PasscodeBoxes value={confirm} error={error} onChange={setConfirm} inputRef={confirmRef} label="Confirm new passcode" />
          )}
          <button
            onClick={closeCard}
            className="text-[11.5px] font-medium text-neutral-500 hover:text-neutral-300"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}