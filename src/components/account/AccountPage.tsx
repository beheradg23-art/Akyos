// Account tab: profile summary, data backup/restore, password change, cloud
// sync + push notification cards, and the performance calendar heatmap.
import React, { useState, useRef } from 'react';
import {
  Sun, Calendar, ArrowUpRight, ChevronLeft, Download, Upload, ShieldCheck,
  Settings, UserCircle2, KeyRound, LogOut,
} from 'lucide-react';
import { ConfigContext, SECTION_LABEL_ROWS, getLocalDateString, getDayName, DailyCheckLog } from '../../lib/appConfig';
import { liquidFillStyle } from '../../lib/liquidFill';
import { Card, RippleButton, SectionHeading, ModalData } from '../ui/Primitives';
import { EditableSectionHeading } from '../shared/EditableSectionHeading';
import CloudSyncCard from '../CloudSyncCard';
import PushNotificationsCard from '../PushNotificationsCard';
import { supabase } from '../../lib/supabaseClient';
import { toast } from '../../lib/toast';
import { haptic } from '../../lib/haptics';
import PasswordField from '../PasswordField';
import PasscodeChangeCard from '../PasscodeChangeCard';
import { SYNC_KEYS } from '../../lib/cloudSync';

export function DataBackupCard({ globalHistory, setGlobalHistory }: { globalHistory: DailyCheckLog; setGlobalHistory: React.Dispatch<React.SetStateAction<DailyCheckLog>> }) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Built from cloudSync's SYNC_KEYS — the same list that already has to be
  // kept up to date for cloud sync to work — instead of a second,
  // independently hand-maintained list. Add a key to SYNC_KEYS once and both
  // cloud sync *and* backup/restore pick it up automatically.
  const collectBackupPayload = () => {
    const payload: Record<string, unknown> = {
      _meta: {
        app: 'Akyos',
        exportedAt: new Date().toISOString(),
        version: 1,
      },
    };
    SYNC_KEYS.forEach((key) => {
      // globalHistory is the live in-memory copy of jee_command_history_v2 —
      // prefer it over localStorage so an export always reflects what's on
      // screen, not whatever was last flushed to disk.
      payload[key] = key === 'jee_command_history_v2' ? globalHistory : localStorage.getItem(key);
    });
    return payload;
  };

  const handleExport = () => {
    try {
      const payload = collectBackupPayload();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `command-center-backup-${getLocalDateString()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Backup downloaded — keep it somewhere safe (Drive, email to yourself, etc).');
    } catch {
      toast.error('Could not create the backup file. Try again.');
    }
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(String(evt.target?.result || ''));
        if (!parsed || typeof parsed !== 'object' || !parsed.jee_command_history_v2) {
          throw new Error('Not a valid backup file');
        }

        setGlobalHistory(parsed.jee_command_history_v2);

        // Restore every other SYNC_KEYS entry present in the file. Driven by
        // the same list as the export above (and as cloud sync), so a backup
        // taken after a new feature ships restores that feature's data too,
        // without this card needing a matching manual update.
        SYNC_KEYS.forEach((key) => {
          if (key === 'jee_command_history_v2') return; // handled above
          if (parsed[key] !== undefined && parsed[key] !== null) {
            localStorage.setItem(key, parsed[key]);
          }
        });

        toast.success('Restored — reloading to apply everything…');
        setTimeout(() => window.location.reload(), 1100);
      } catch {
        toast.error('That file is invalid or corrupted — nothing was changed.');
      }
    };
    reader.readAsText(file);
  };

  const dayCount = Object.keys(globalHistory || {}).length;

  return (
    <Card className="animate-fadeIn">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <EditableSectionHeading
          id="ac_backup"
          defaultTitle="Data Backup & Restore"
          defaultIcon={ShieldCheck}
          subtitle={`${dayCount} day${dayCount === 1 ? '' : 's'} of history, stored only in this browser`}
        />
        <div className="flex items-center gap-2 shrink-0">
          <RippleButton
            onClick={handleExport}
            className="cursor-target flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-[12px] font-semibold text-neutral-200 hover:bg-neutral-800 transition-colors"
          >
            <Download className="h-3.5 w-3.5" /> Export
          </RippleButton>
          <RippleButton
            onClick={handleImportClick}
            className="cursor-target flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-[12px] font-semibold text-neutral-200 hover:bg-neutral-800 transition-colors"
          >
            <Upload className="h-3.5 w-3.5" /> Import
          </RippleButton>
          <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleFileChange} />
        </div>
      </div>

      <p className="mt-4 text-[12.5px] text-neutral-500 leading-relaxed">
        Everything here — the Daily Matrix history, streak, Hunter Rank, mock test scores, and weight log — lives only in this browser's storage. Clearing site data, switching devices, or reinstalling the browser erases it permanently, with no way to recover it. Export a backup file regularly, and import it to restore everything on a new device or after a reset.
      </p>
    </Card>
  );
}

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
    if (newPassword.length < 6) {
      setFieldError('Password must be at least 6 characters.');
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
          placeholder="New password (min 6 characters)"
          autoComplete="new-password"
          showStrength
          className="w-full rounded-lg border border-neutral-800 bg-neutral-950/60 px-3 py-2.5 pr-11 text-[13px] text-neutral-100 placeholder:text-neutral-600 outline-none focus:border-violet-500/50"
        />
        <PasswordField
          value={confirmPassword}
          onChange={setConfirmPassword}
          placeholder="Confirm new password"
          autoComplete="new-password"
          className="w-full rounded-lg border border-neutral-800 bg-neutral-950/60 px-3 py-2.5 pr-11 text-[13px] text-neutral-100 placeholder:text-neutral-600 outline-none focus:border-violet-500/50"
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

// ---------- Account Menu ----------
// Slide-over panel replacing the old standalone "Config & Settings" tab.
// Holds account identity, cloud sync, password change, data backup/restore,
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
    sessionStorage.removeItem('dcc_cloud_synced_this_session');
    localStorage.removeItem('dcc_passcode_hash');
    await supabase.auth.signOut();
    window.location.reload();
  };

  return (
    <div className="max-w-xl space-y-5 animate-fadeIn">
      <EditableSectionHeading id="ac_account" defaultTitle="Account" defaultIcon={UserCircle2} subtitle="Profile, cloud sync, security & backups" />

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
      <PushNotificationsCard />
      <ChangePasswordCard />
      <PasscodeChangeCard />

      <DataBackupCard globalHistory={globalHistory} setGlobalHistory={setGlobalHistory} />

      <button
        onClick={handleSignOut}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-900/40 bg-rose-950/20 px-4 py-3 text-[13px] font-semibold text-rose-300 transition-colors hover:bg-rose-950/40"
      >
        <LogOut className="h-4 w-4" />
        Log Out
      </button>
    </div>
  );
}

export function PerformanceCalendar({ globalHistory, setGlobalHistory, setModal }: { globalHistory: DailyCheckLog; setGlobalHistory: React.Dispatch<React.SetStateAction<DailyCheckLog>>; setModal: (data: ModalData | null) => void }) {
  const { trackerItems } = React.useContext(ConfigContext);
  const [currentNavDate, setCurrentNavDate] = useState(new Date());
  
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

    setModal({
      title: `Execution Analysis: ${dateStr}`,
      subtitle: `${getDayName(dateStr)} · Efficiency Index: ${percentage}%`,
      icon: Calendar,
      arrayTitle: `Logged Metric Parameters (${completedCount}/${trackerItems.length})`,
      arrayItems: arrayItems,
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
            className="p-1.5 rounded-lg text-neutral-400 hover:bg-neutral-800 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs font-semibold px-2 min-w-[100px] text-center text-neutral-200">{monthName} {year}</span>
          <button 
            onClick={() => setCurrentNavDate(new Date(year, month + 1, 1))}
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
          return (
            <div
              key={idx}
              onClick={() => dateStr && handlePastDateClick(dateStr)}
              className={`aspect-square rounded-xl border flex flex-col items-center justify-center relative text-xs transition-all duration-150 ${
                dateStr ? 'cursor-pointer hover:scale-105' : 'opacity-0 pointer-events-none'
              } ${getHeatmapColor(dateStr)} ${isCurrentDay ? 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-neutral-950' : ''}`}
              style={isPerfectHeatmapDay(dateStr) ? liquidFillStyle() : undefined}
            >
              {dateStr && (
                <>
                  <span className="font-mono">{parseInt(dateStr.split('-')[2])}</span>
                  {globalHistory[dateStr] && Object.values(globalHistory[dateStr]).filter(Boolean).length > 0 && (
                    <span className={`absolute bottom-1.5 h-1 w-1 rounded-full ${dateStr === getLocalDateString() || Object.values(globalHistory[dateStr]).filter(Boolean).length === trackerItems.length ? 'bg-neutral-950' : 'bg-current'}`} />
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 pt-4 border-t border-neutral-800 flex flex-wrap gap-4 items-center justify-between text-xs text-neutral-400">
        <div className="flex items-center gap-1.5">
          <span className="text-neutral-500 font-mono">Legend Matrix:</span>
          <div className="flex items-center gap-1"><div className="h-3 w-3 rounded bg-neutral-900 border border-neutral-800" /> <span>0%</span></div>
          <div className="flex items-center gap-1"><div className="h-3 w-3 rounded bg-rose-950/60 border border-rose-800/40" /> <span>1-30%</span></div>
          <div className="flex items-center gap-1"><div className="h-3 w-3 rounded bg-amber-950/60 border border-amber-800/40" /> <span>31-60%</span></div>
          <div className="flex items-center gap-1"><div className="h-3 w-3 rounded bg-violet-950/40 border border-violet-800/40" /> <span>61-99%</span></div>
          <div className="flex items-center gap-1"><div className="h-3 w-3 rounded" style={liquidFillStyle()} /> <span>100%</span></div>
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
