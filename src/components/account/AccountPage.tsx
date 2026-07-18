// Account tab: profile summary, password change, cloud
// sync card, and the performance calendar heatmap.
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Sun, Calendar, ArrowUpRight, ChevronLeft,
  Settings, UserCircle2, KeyRound, LogOut, Trash2, AlertTriangle,
} from 'lucide-react';
import { ConfigContext, SECTION_LABEL_ROWS, getLocalDateString, getDayName, DailyCheckLog } from '../../lib/appConfig';
import { liquidFillStyle } from '../../lib/liquidFill';
import { Card, RippleButton, SectionHeading, ModalData } from '../ui/Primitives';
import { EditableSectionHeading } from '../shared/EditableSectionHeading';
import CloudSyncCard from '../CloudSyncCard';
import { supabase } from '../../lib/supabaseClient';
import { toast } from '../../lib/toast';
import { haptic } from '../../lib/haptics';
import PasswordField from '../PasswordField';
import PasscodeChangeCard from '../PasscodeChangeCard';
import {
  resetLocalAccountState, LAST_ACTIVE_USER_KEY,
  verifyPasscode, getPasscodeHash, setPasscodeHash, PASSCODE_HASH_KEY,
  registerFailedPasscodeAttempt, clearPasscodeAttempts, usePasscodeLockoutMs,
} from '../../lib/cloudSync';

// ---------- Change Password (inside Account Menu) ----------

export function ChangePasswordCard() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  // Inline error stays for form validation (wrong length / mismatch) since
  // that's tied to a specific field the person needs to look at right now.
  // The final outcome (saved / failed) goes through the shared toast so it
  // reads the same way as every other "Saved ✓" moment in the app.
  const [fieldError, setFieldError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldError('');
    if (newPassword.length < 8) {
      setFieldError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setFieldError("Those didn't match — try again.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      haptic.success();
      toast.success('Password updated.');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      haptic.error();
      toast.error(err?.message || 'Could not update your password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4 sm:p-5">
      <div className="flex items-center gap-3 mb-3.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={liquidFillStyle()}>
          <KeyRound className="h-4.5 w-4.5 text-neutral-950" strokeWidth={2} />
        </div>
        <h3 className="text-[13.5px] font-bold text-neutral-100">Change Password</h3>
      </div>
      <form onSubmit={handleSubmit} className="space-y-2.5">
        <PasswordField
          value={newPassword}
          onChange={setNewPassword}
          placeholder="New password (min 8 characters)"
          autoComplete="new-password"
          minLength={8}
          showStrength
          className="w-full rounded-lg border border-neutral-800 bg-neutral-950/60 px-3 py-2.5 pr-11 text-[13px] text-neutral-100 placeholder:text-neutral-600 outline-none"
        />
        <PasswordField
          value={confirmPassword}
          onChange={setConfirmPassword}
          placeholder="Confirm new password"
          autoComplete="new-password"
          minLength={8}
          className="w-full rounded-lg border border-neutral-800 bg-neutral-950/60 px-3 py-2.5 pr-11 text-[13px] text-neutral-100 placeholder:text-neutral-600 outline-none"
        />
        {fieldError && <p className="text-[12px] text-rose-400">{fieldError}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg py-2.5 text-[12.5px] font-semibold text-neutral-950 transition-opacity disabled:opacity-50"
          style={liquidFillStyle()}
        >
          {busy ? 'Saving…' : 'Update Password'}
        </button>
      </form>
    </div>
  );
}

// ---------- Delete Account (inside Account Menu) ----------
//
// Required auth, three layers:
// 1. Client-side gate (this component): the person must re-enter their
//    current 6-digit app passcode — verified the same way
//    PasscodeChangeCard.tsx verifies it, against the cached/cloud hash —
//    and then type the literal word DELETE, before the delete request is
//    ever sent. Either step failing/being skipped means no request goes
//    out.
// 2. Server-side session gate (api/delete-account.ts): deleting a Supabase
//    Auth user requires the *service role* key, a secret that must never
//    reach the browser, so the actual deletion can only happen in that
//    serverless function. It independently re-verifies the caller's
//    Supabase session token (never trusting a user id from the request
//    body) before deleting anything — so even a request that somehow
//    skipped step 1 still can't delete an account without a currently
//    valid session for that exact account.
// 3. Server-side passcode gate (api/delete-account.ts): the passcode
//    entered in step 1 is sent along with the request and independently
//    re-verified server-side against the stored hash before anything is
//    deleted — so a bare stolen/leaked session token alone (e.g. via an
//    XSS payload reading localStorage) is no longer enough by itself to
//    delete the account.
//
// This is deliberately NOT reachable from ChangePasswordCard/PasscodeChangeCard
// above — it's its own card so the destructive action has its own,
// separate confirmation flow rather than living as a mode of something
// else.
const DELETE_PASSCODE_LENGTH = 6;
type DeleteStep = 'warning' | 'passcode' | 'confirm-text';

export function DeleteAccountCard() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<DeleteStep>('warning');
  const [passcode, setPasscode] = useState('');
  const [passcodeError, setPasscodeError] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const passcodeRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  const lockoutMs = usePasscodeLockoutMs(userId);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      if (step === 'passcode') passcodeRef.current?.focus();
      if (step === 'confirm-text') confirmRef.current?.focus();
    }, 50);
    return () => clearTimeout(t);
  }, [open, step]);

  const reset = () => {
    setStep('warning');
    setPasscode('');
    setPasscodeError(false);
    setConfirmText('');
  };

  const closeCard = () => {
    setOpen(false);
    reset();
  };

  // --- verify current passcode, same check PasscodeChangeCard uses ---
  useEffect(() => {
    if (step !== 'passcode' || passcode.length !== DELETE_PASSCODE_LENGTH || !userId) return;
    if (lockoutMs > 0) {
      setPasscodeError(true);
      setTimeout(() => setPasscode(''), 500);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const cached = localStorage.getItem(PASSCODE_HASH_KEY) || (await getPasscodeHash(userId).catch(() => null));
        const { valid, upgradedHash } = await verifyPasscode(passcode, userId, cached);
        if (cancelled) return;
        if (valid) {
          clearPasscodeAttempts(userId);
          setPasscodeError(false);
          if (upgradedHash) {
            localStorage.setItem(PASSCODE_HASH_KEY, upgradedHash);
            setPasscodeHash(userId, upgradedHash).catch(() => {});
          }
          setStep('confirm-text');
        } else {
          await registerFailedPasscodeAttempt(userId);
          haptic.error();
          setPasscodeError(true);
          setTimeout(() => {
            if (cancelled) return;
            setPasscode('');
            setPasscodeError(false);
            passcodeRef.current?.focus();
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
  }, [passcode, step, userId, lockoutMs]);

  const handleDelete = async () => {
    if (confirmText !== 'DELETE') return;
    setBusy(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('Your session has expired — sign in again and retry.');

      const res = await fetch('/api/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ passcode }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || 'Could not delete your account.');

      // Account is gone server-side — clear every local trace and the
      // (now-invalid) session, same order handleSignOut uses and for the
      // same reason: drop the session first, then wipe storage, so no
      // in-flight autosync can push a stray write anywhere.
      await supabase.auth.signOut();
      resetLocalAccountState();
      localStorage.removeItem(LAST_ACTIVE_USER_KEY);
      sessionStorage.removeItem('dcc_cloud_synced_this_session');
      haptic.success();
      toast.success('Your account has been deleted.');
      setTimeout(() => window.location.reload(), 900);
    } catch (err: any) {
      haptic.error();
      toast.error(err?.message || 'Could not delete your account. Try again.');
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-rose-900/40 bg-rose-950/[0.08] p-4 sm:p-5">
      <button
        onClick={() => (open ? closeCard() : setOpen(true))}
        className="flex w-full items-center gap-3 text-left"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-950/40 border border-rose-900/40">
          <Trash2 className="h-4.5 w-4.5 text-rose-300" strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[13.5px] font-bold text-rose-200">Delete Account</h3>
          <p className="text-[11.5px] text-neutral-500">Permanently erase your account and all synced data</p>
        </div>
      </button>

      {open && (
        <div className="mt-4 flex flex-col items-start gap-3 animate-fadeIn">
          {step === 'warning' && (
            <>
              <div className="flex gap-2.5 rounded-lg border border-rose-900/40 bg-rose-950/20 p-3">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                <p className="text-[12px] leading-relaxed text-rose-200/90">
                  This deletes your account, your cloud-synced data, and your passcode.
                  Anything only stored on THIS device is not touched by this.
                  This cannot be undone.
                </p>
              </div>
              <button
                onClick={() => setStep('passcode')}
                className="rounded-lg border border-rose-800/60 bg-rose-950/40 px-3.5 py-2 text-[12px] font-semibold text-rose-200 hover:bg-rose-900/40 transition-colors"
              >
                I understand, continue
              </button>
            </>
          )}

          {step === 'passcode' && (
            <>
              <p className="text-[12px] text-neutral-400">
                {lockoutMs > 0 ? 'Too many attempts' : 'Enter your current passcode to continue'}
              </p>
              <input
                ref={passcodeRef}
                value={passcode}
                onChange={(e) => setPasscode(e.target.value.replace(/\D/g, '').slice(0, DELETE_PASSCODE_LENGTH))}
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                disabled={lockoutMs > 0}
                aria-label="Current passcode"
                className={`w-32 rounded-lg border px-3 py-2.5 text-center text-[15px] tracking-[0.4em] outline-none transition-colors disabled:opacity-50 ${
                  passcodeError
                    ? 'border-rose-500/50 bg-rose-500/[0.06] text-rose-300 animate-shake'
                    : 'border-neutral-800 bg-neutral-950/60 text-neutral-100 focus:border-rose-500/50'
                }`}
              />
              {lockoutMs > 0 && (
                <p className="text-[11.5px] font-medium text-rose-400">
                  Try again in {Math.ceil(lockoutMs / 1000)}s
                </p>
              )}
            </>
          )}

          {step === 'confirm-text' && (
            <>
              <p className="text-[12px] text-neutral-400">
                Type <span className="font-semibold text-rose-300">DELETE</span> to permanently delete your account
              </p>
              <input
                ref={confirmRef}
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                type="text"
                autoComplete="off"
                aria-label="Type DELETE to confirm"
                placeholder="DELETE"
                className="w-full rounded-lg border border-neutral-800 bg-neutral-950/60 px-3 py-2.5 text-[13px] font-medium text-neutral-100 placeholder:text-neutral-700 outline-none focus:border-rose-500/50"
              />
              <button
                onClick={handleDelete}
                disabled={confirmText !== 'DELETE' || busy}
                className="w-full rounded-lg bg-rose-600 py-2.5 text-[12.5px] font-semibold text-white transition-opacity hover:bg-rose-500 disabled:opacity-40 disabled:hover:bg-rose-600"
              >
                {busy ? 'Deleting…' : 'Permanently Delete My Account'}
              </button>
            </>
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

// ---------- Account Menu ----------
// Slide-over panel replacing the old standalone "Config & Settings" tab.
// Holds account identity, cloud sync, password change,
// the entry point into Settings, and sign out — everything that isn't
// day-to-day tracking content lives here now instead of the main nav.

export function AccountPage({
  globalHistory, setGlobalHistory,
}: {
  globalHistory: DailyCheckLog;
  setGlobalHistory: React.Dispatch<React.SetStateAction<DailyCheckLog>>;
}) {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  const handleSignOut = async () => {
    // PHASE 1 FIX: this used to only remove the passcode hash, leaving the
    // config, routine, weight/diet logs, calendar, everything else sitting
    // in localStorage for whoever signs into (or creates) the next account
    // on this device to inherit. Now sign-out wipes every account-scoped
    // key, and forgets which account this device belonged to —
    // ensureAccountIsolation() (see cloudSync.ts) still double-checks this
    // on the next login too, as a second line of defense.
    //
    // PHASE 2 FIX: order matters here. useCloudAutoSync (cloudSync.ts) has
    // a 45s interval AND a `beforeunload` handler that both push whatever's
    // currently in localStorage to this account's cloud row. If local
    // storage were wiped BEFORE the session is actually invalidated, either
    // of those could fire mid-sign-out and push an empty snapshot —
    // silently overwriting the user's real saved data with blanks. Signing
    // out FIRST means the Supabase client drops its session immediately, so
    // any push that sneaks in after that point gets rejected by the
    // database (no authenticated user_id match) instead of succeeding with
    // the wrong data. Only once that's done do we touch localStorage.
    await supabase.auth.signOut();
    resetLocalAccountState();
    localStorage.removeItem(LAST_ACTIVE_USER_KEY);
    sessionStorage.removeItem('dcc_cloud_synced_this_session');
    window.location.reload();
  };

  return (
    <div className="max-w-xl space-y-5 animate-fadeIn">
      <EditableSectionHeading id="ac_account" defaultTitle="Account" defaultIcon={UserCircle2} subtitle="Profile, cloud sync & security" />

      <div className="flex items-center gap-3 rounded-2xl border border-neutral-800 bg-gradient-to-br from-violet-500/[0.08] via-neutral-950 to-indigo-500/[0.05] p-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[15px] font-bold text-neutral-950" style={liquidFillStyle()}>
          {email ? email[0].toUpperCase() : <UserCircle2 className="h-6 w-6 text-neutral-950" />}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-neutral-100">{email || 'Not signed in'}</p>
          <p className="text-[11.5px] text-neutral-500">Signed in via Supabase</p>
        </div>
      </div>

      <CloudSyncCard />
      <ChangePasswordCard />
      <PasscodeChangeCard />

      <button
        onClick={handleSignOut}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-900/40 bg-rose-950/20 px-4 py-3 text-[13px] font-semibold text-rose-300 transition-colors hover:bg-rose-950/40"
      >
        <LogOut className="h-4 w-4" />
        Log Out
      </button>

      <DeleteAccountCard />
    </div>
  );
}

export function PerformanceCalendar({ globalHistory, setGlobalHistory, setModal }: { globalHistory: DailyCheckLog; setGlobalHistory: React.Dispatch<React.SetStateAction<DailyCheckLog>>; setModal: (data: ModalData | null) => void }) {
  const { trackerItems, subjects } = React.useContext(ConfigContext);
  const [currentNavDate, setCurrentNavDate] = useState(new Date());

  // Pomodoro subject-hours and mock-test logs are each already date-stamped
  // the moment they're created (Ash's Clock tags every completed Focus Gate
  // with the date it finished; Mock Tests tags every entry with the date
  // picked in the form) — see 'pomodoro_subject_log' / 'mock_test_log' in
  // cloudSync's SYNC_KEYS. That per-entry date stamp is what makes this
  // calendar "just work" across a midnight rollover with no extra timer of
  // its own: a session finishing at 11:58pm is tagged with today's date,
  // one finishing at 12:02am is tagged with tomorrow's, so each day's
  // total is always attributed to the day it actually happened on.
  const [pomodoroLog] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('pomodoro_subject_log');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [testLog] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('mock_test_log');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // date -> { subjectKey: minutes }
  const subjectMinutesByDate = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    pomodoroLog.forEach((entry: any) => {
      if (!entry?.date || !entry?.subject) return;
      if (!map[entry.date]) map[entry.date] = {};
      map[entry.date][entry.subject] = (map[entry.date][entry.subject] || 0) + (Number(entry.minutes) || 0);
    });
    return map;
  }, [pomodoroLog]);

  // date -> tests logged that day
  const testsByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    testLog.forEach((t: any) => {
      if (!t?.date) return;
      if (!map[t.date]) map[t.date] = [];
      map[t.date].push(t);
    });
    return map;
  }, [testLog]);

  const formatHrs = (mins: number) => {
    if (!mins) return '0m';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  // Old test entries stored raw numbers per subject with an implicit max of
  // 100 (see the same back-compat normalization in MockTestTab); handle
  // both shapes here so older logged tests still display correctly.
  const normalizeScore = (val: any): { score: number; max: number } =>
    typeof val === 'number' ? { score: val, max: 100 } : val;

  const year = currentNavDate.getFullYear();
  const month = currentNavDate.getMonth();

  const monthName = currentNavDate.toLocaleString('default', { month: 'long' });

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

  const calendarDays = useMemo(() => {
    const cells = [];
    for (let i = 0; i < firstDayIndex; i++) {
      cells.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      cells.push(dayStr);
    }
    return cells;
  }, [year, month, daysInMonth, firstDayIndex]);

  const handlePastDateClick = (dateStr) => {
    if (!dateStr) return;
    const itemsCompleted = globalHistory[dateStr] || {};
    const arrayItems = trackerItems.map(item => {
      return `${itemsCompleted[item.id] ? '✅' : '❌'} ${item.label}`;
    });
    const completedCount = Object.values(itemsCompleted).filter(Boolean).length;
    const percentage = Math.round((completedCount / trackerItems.length) * 100);

    const subjectMinutes = subjectMinutesByDate[dateStr] || {};
    const studyItems = Object.entries(subjectMinutes)
      .filter(([, mins]) => (mins as number) > 0)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .map(([key, mins]) => {
        const found = subjects.find((s: any) => s.key === key);
        return `${found?.label || key}: ${formatHrs(mins as number)}`;
      });
    const totalStudyMinutes = Object.values(subjectMinutes).reduce((a: number, b: number) => a + b, 0);
    if (studyItems.length > 0) {
      studyItems.unshift(`Total: ${formatHrs(totalStudyMinutes)} across ${studyItems.length} subject${studyItems.length === 1 ? '' : 's'}`);
    }

    const dayTests = testsByDate[dateStr] || [];
    const testItems = dayTests.map((t: any) => {
      const scoreParts = Object.entries(t.scores || {}).map(([key, val]) => {
        const { score, max } = normalizeScore(val);
        const found = subjects.find((s: any) => s.key === key);
        return `${found?.label || key} ${score}/${max}`;
      });
      return `${t.label}${scoreParts.length ? ' — ' + scoreParts.join(', ') : ''}`;
    });

    setModal({
      title: `Execution Analysis: ${dateStr}`,
      subtitle: `${getDayName(dateStr)} · Efficiency Index: ${percentage}%`,
      icon: Calendar,
      arrayTitle: `Logged Metric Parameters (${completedCount}/${trackerItems.length})`,
      arrayItems: arrayItems,
      studyItems,
      studyTitle: 'Study Log (Pomodoro)',
      testItems,
      testTitle: 'Tests Logged This Day',
      cues: percentage === 100 ? 'Absolute perfect operation architecture verified.' : 'Identify points of focus slippage to correct trends.'
    });
  };

  const getHeatmapColor = (dateStr) => {
    if (!dateStr || !globalHistory[dateStr]) return 'bg-neutral-900 border-neutral-800 text-neutral-600';
    const checks = globalHistory[dateStr];
    const score = Object.values(checks).filter(Boolean).length;
    const pct = score / trackerItems.length;

    if (score === 0) return 'bg-neutral-900 border-neutral-800 text-neutral-500';
    if (pct <= 0.3) return 'bg-rose-950/60 border-rose-800/40 text-rose-300 hover:bg-rose-900/50';
    if (pct <= 0.6) return 'bg-amber-950/60 border-amber-800/40 text-amber-300 hover:bg-amber-900/50';
    if (pct < 1) return 'bg-violet-950/40 border-violet-800/40 text-violet-300 hover:bg-violet-900/40';
    return 'text-neutral-950 border-violet-400 font-bold';
  };

  // Perfect (100%) days get the animated liquid gradient fill instead of a
  // flat one; this stays separate from getHeatmapColor because that helper
  // only returns className strings, not inline style.
  const isPerfectHeatmapDay = (dateStr: string) => {
    if (!dateStr || !globalHistory[dateStr]) return false;
    const checks = globalHistory[dateStr];
    const score = Object.values(checks).filter(Boolean).length;
    return score / trackerItems.length >= 1;
  };

  return (
    <div className="space-y-5">
      <Card className="animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <EditableSectionHeading id="hist_heatmap" defaultTitle="Execution Heatmap Analytics" defaultIcon={Calendar} subtitle="Persistent performance velocity tracing" />
        <div className="flex items-center gap-2 border border-neutral-800 bg-neutral-950/80 p-1 rounded-xl">
          <button 
            onClick={() => setCurrentNavDate(new Date(year, month - 1, 1))}
            aria-label="Previous month"
            className="p-1.5 rounded-lg text-neutral-400 hover:bg-neutral-800 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs font-semibold px-2 min-w-[100px] text-center text-neutral-200">{monthName} {year}</span>
          <button 
            onClick={() => setCurrentNavDate(new Date(year, month + 1, 1))}
            aria-label="Next month"
            className="p-1.5 rounded-lg text-neutral-400 hover:bg-neutral-800 transition-colors"
          >
            <ArrowUpRight className="h-4 w-4 rotate-45" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold tracking-wider text-neutral-500 uppercase mb-2">
        <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {calendarDays.map((dateStr, idx) => {
          const isCurrentDay = dateStr === getLocalDateString();
          const dayChecks = dateStr && globalHistory[dateStr] ? Object.values(globalHistory[dateStr]).filter(Boolean).length : 0;
          const dayPct = dateStr && trackerItems.length ? Math.round((dayChecks / trackerItems.length) * 100) : 0;
          const hasStudy = !!dateStr && Object.values(subjectMinutesByDate[dateStr] || {}).some((m) => (m as number) > 0);
          const hasTest = !!dateStr && (testsByDate[dateStr] || []).length > 0;
          return (
            <div
              key={idx}
              onClick={() => dateStr && handlePastDateClick(dateStr)}
              title={dateStr ? `${dateStr}: ${dayPct}% complete${hasStudy ? ' · study logged' : ''}${hasTest ? ' · test logged' : ''}${isCurrentDay ? ' (today)' : ''}` : undefined}
              className={`aspect-square rounded-xl border flex flex-col items-center justify-center relative text-xs transition-all duration-150 ${
                dateStr ? 'cursor-pointer hover:scale-105' : 'opacity-0 pointer-events-none'
              } ${getHeatmapColor(dateStr)} ${isCurrentDay ? 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-neutral-950' : ''}`}
              style={isPerfectHeatmapDay(dateStr) ? liquidFillStyle() : undefined}
            >
              {dateStr && (
                <>
                  <span className="tabular-nums">{parseInt(dateStr.split('-')[2])}</span>
                  {globalHistory[dateStr] && Object.values(globalHistory[dateStr]).filter(Boolean).length > 0 && (
                    <span className={`absolute bottom-1.5 h-1 w-1 rounded-full ${dateStr === getLocalDateString() || Object.values(globalHistory[dateStr]).filter(Boolean).length === trackerItems.length ? 'bg-neutral-950' : 'bg-current'}`} />
                  )}
                  {hasStudy && (
                    <span
                      className={`absolute top-1 left-1 h-1.5 w-1.5 rounded-full ${
                        isPerfectHeatmapDay(dateStr)
                          ? 'bg-indigo-950 shadow-[0_0_3px_rgba(0,0,0,0.6)]'
                          : 'bg-indigo-400 shadow-[0_0_4px_rgba(129,140,248,0.9)]'
                      }`}
                    />
                  )}
                  {hasTest && (
                    <span
                      className={`absolute top-1 right-1 h-1.5 w-1.5 rounded-full ${
                        isPerfectHeatmapDay(dateStr)
                          ? 'bg-amber-950 shadow-[0_0_3px_rgba(0,0,0,0.6)]'
                          : 'bg-amber-400 shadow-[0_0_4px_rgba(251,191,36,0.9)]'
                      }`}
                    />
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 pt-4 border-t border-neutral-800 flex flex-wrap gap-4 items-center justify-between text-xs text-neutral-400">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-neutral-500 font-medium">Legend Matrix:</span>
            <div className="flex items-center gap-1"><div className="h-3 w-3 rounded bg-neutral-900 border border-neutral-800" /> <span>0%</span></div>
            <div className="flex items-center gap-1"><div className="h-3 w-3 rounded bg-rose-950/60 border border-rose-800/40" /> <span>1-30%</span></div>
            <div className="flex items-center gap-1"><div className="h-3 w-3 rounded bg-amber-950/60 border border-amber-800/40" /> <span>31-60%</span></div>
            <div className="flex items-center gap-1"><div className="h-3 w-3 rounded bg-violet-950/40 border border-violet-800/40" /> <span>61-99%</span></div>
            <div className="flex items-center gap-1"><div className="h-3 w-3 rounded" style={liquidFillStyle()} /> <span>100%</span></div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1"><div className="h-1.5 w-1.5 rounded-full bg-indigo-400" /> <span>Study logged</span></div>
            <div className="flex items-center gap-1"><div className="h-1.5 w-1.5 rounded-full bg-amber-400" /> <span>Test logged</span></div>
          </div>
        </div>
        <p className="text-[11px] text-neutral-500">Click any historic metric square to trace detailed logs.</p>
      </div>
    </Card>
    </div>
  );
}

// ---------- Tab Subcomponent: Overview ----------

// Renders a SectionHeading for a named sub-section of any tab, applying
// any custom label/icon saved in Settings > Section Labels (falling back to
// the shipped default whenever nothing's been overridden yet). `id` must
// match a key registered in SECTION_LABEL_ROWS above.