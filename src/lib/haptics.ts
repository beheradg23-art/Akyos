// ---------------------------------------------------------------------------
// Haptic feedback — thin wrapper around navigator.vibrate().
//
// Feature-detected: only fires on Android/Chrome (and other browsers that
// implement the Vibration API). iOS Safari and desktop browsers simply don't
// have the method, so this is a silent no-op there — safe to call anywhere,
// on every platform, with no guards needed at the call site.
//
// Usage:
//   import { haptic } from '../lib/haptics';
//   haptic.light();    // checking off a tracker item
//   haptic.success();  // pomodoro session cleared
//   haptic.error();    // wrong passcode / failed save
// ---------------------------------------------------------------------------

const canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

const vibrate = (pattern: number | number[]) => {
  if (!canVibrate) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Some browsers throw if called outside a user gesture — never let a
    // haptic ping break the actual interaction it's attached to.
  }
};

export const haptic = {
  /** Smallest possible tick — checking off a tracker item, toggling a switch. */
  light: () => vibrate(10),
  /** A touch more presence — button presses, tab switches. */
  medium: () => vibrate(18),
  /** Two quick pulses — a completed action (pomodoro session cleared, item saved). */
  success: () => vibrate([12, 40, 12]),
  /** A single firmer buzz — something went wrong (failed save, wrong passcode). */
  error: () => vibrate(35),
};