// ---------------------------------------------------------------------------
// Shared typography scale.
//
// The app currently sizes text with arbitrary Tailwind values scattered
// everywhere (text-[11px], text-[11.5px], text-[12px], text-[12.5px],
// text-[13px], text-[13.5px], text-[15px]...) with no naming or hierarchy.
// That's not broken, but it means there's no shared vocabulary for "this is
// a label" vs "this is a value" vs "this is a heading", and near-duplicate
// sizes (12px vs 12.5px) creep in by accident rather than on purpose.
//
// This file gives every size a name and a job. It's plain Tailwind class
// strings (not a Tailwind config change), so it drops in anywhere with zero
// build setup:
//
//   import { type } from '../styles/type';
//   <h3 className={type.label}>Change Password</h3>
//   <p className={type.body}>Everything here lives only in this browser.</p>
//
// This ships alongside a few components as a working example (Toast,
// PasswordField, PasscodeChangeCard) rather than a full app-wide find/replace
// — swapping the other ~6,700 lines over is a mechanical follow-up you can
// do incrementally, file by file, whenever you touch that component next.
// ---------------------------------------------------------------------------

export const type = {
    /** Tiny meta text: "Auto" badges, timestamps, char counters. */
    micro: 'text-[10px] font-medium tracking-wide',
    /** Uppercase eyebrow / overline labels. */
    eyebrow: 'text-[10.5px] font-bold uppercase tracking-wider',
    /** Field labels, helper text, secondary captions. */
    caption: 'text-[11.5px] text-neutral-500',
    /** Small UI labels — button text, list item labels. */
    label: 'text-[12px] font-medium',
    /** Default body copy inside cards. */
    body: 'text-[12.5px] leading-relaxed text-neutral-400',
    /** Form input text. */
    input: 'text-[13px]',
    /** Card / section sub-heading. */
    subheading: 'text-[13.5px] font-bold text-neutral-100',
    /** Page-level heading. */
    heading: 'text-[15px] font-semibold tracking-tight text-neutral-50',
    /** Large numeric / hero display (timers, streak counts). */
    display: 'text-[28px] font-bold tabular-nums tracking-tight',
  } as const;