import React, { useId, useMemo, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { motion } from '../styles/motion';
import { liquidFillStyle, SWEEP_REVEAL_STYLE, useSweepReveal } from '../lib/liquidFill';

// ---------------------------------------------------------------------------
// Drop-in replacement for a bare <input type="password" />.
//
// Adds a show/hide eye toggle (defaults every password field to masked, one
// click reveals it) and an optional strength meter for the "choose a new
// password" cases (signup, change password, reset password) — pass
// `showStrength` to turn it on. Plain sign-in fields should leave it off,
// since judging the strength of an *existing* password is meaningless.
//
// Usage:
//   <PasswordField
//     value={newPassword}
//     onChange={setNewPassword}
//     placeholder="New password (min 6 characters)"
//     autoComplete="new-password"
//     showStrength
//   />
// ---------------------------------------------------------------------------

function scorePassword(pw: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  if (!pw) return { score: 0, label: '' };
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;

  const clamped = Math.min(score, 4) as 0 | 1 | 2 | 3 | 4;
  const labels = ['Too short', 'Weak', 'Okay', 'Good', 'Strong'];
  return { score: clamped, label: labels[clamped] };
}

const BAR_COLORS = [
  'bg-neutral-800', // 0 — unfilled
  'bg-rose-500',    // 1 — weak
  'bg-amber-500',   // 2 — okay
  'bg-lime-500',    // 3 — good
  'bg-violet-500',  // 4 — strong
];

export interface PasswordFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  showStrength?: boolean;
  className?: string;
  style?: React.CSSProperties;
  inputRef?: React.Ref<HTMLInputElement>;
}

export default function PasswordField({
  value,
  onChange,
  placeholder,
  autoComplete = 'current-password',
  required,
  minLength,
  showStrength = false,
  className = '',
  style,
  inputRef,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  // True while the field has keyboard focus (cursor typing in it) — drives
  // the animated gradient sweep border, same hover-gated overlay <Card>
  // uses in Primitives.tsx, but focus-gated here since it's an input.
  const [focused, setFocused] = useState(false);
  const sweep = useSweepReveal(focused);
  const id = useId();
  const { score, label } = useMemo(() => scorePassword(value), [value]);

  return (
    <div className="w-full">
      <div className="relative" style={style}>
        <input
          ref={inputRef}
          id={id}
          type={visible ? 'text' : 'password'}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          className={
            className ||
            'w-full rounded-xl border border-neutral-800 bg-neutral-900/80 px-4 py-3 pr-11 text-[13px] text-neutral-100 placeholder-neutral-600 outline-none transition-colors'
          }
        />
        {sweep.mounted && (
          // Same animated gradient sweep border as the dashboard's <Card>
          // bento boxes, Master Timeline blocks, and header badges —
          // ring-only cutout filled with the shared moving
          // liquidFillStyle() brand gradient, revealed via the
          // corner-to-corner --akyos-sweep mask, but gated on focus
          // (cursor in the field) instead of hover since this is a
          // text input. Faded back out (no re-sweep) via useSweepReveal
          // on blur.
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-xl"
            style={{ animation: sweep.animation, ...SWEEP_REVEAL_STYLE }}
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
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-neutral-500 transition-colors hover:text-neutral-300"
        >
          {visible ? <EyeOff className="h-4 w-4" strokeWidth={2} /> : <Eye className="h-4 w-4" strokeWidth={2} />}
        </button>
      </div>

      {showStrength && value.length > 0 && (
        <div className="mt-2 flex items-center gap-2" style={{ transition: `opacity ${motion.fast}` }}>
          <div className="flex flex-1 gap-1">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full ${i <= score ? BAR_COLORS[score] : BAR_COLORS[0]}`}
                style={{ transition: `background-color ${motion.base}` }}
              />
            ))}
          </div>
          <span className="w-12 shrink-0 text-right text-[10.5px] font-medium text-neutral-500">{label}</span>
        </div>
      )}
    </div>
  );
}