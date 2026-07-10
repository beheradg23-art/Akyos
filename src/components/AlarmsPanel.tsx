import React, { useEffect, useState } from 'react';
import { Plus, Trash2, AlarmClock, BellOff } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { fetchAlarms, createAlarm, updateAlarm, deleteAlarm, readCachedAlarms, type Alarm } from '../lib/alarms';
import { getPushStatus, subscribeToPush, type PushStatus } from '../lib/pushNotifications';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function formatDays(days: number[]): string {
  if (!days || days.length === 0) return 'Once';
  if (days.length === 7) return 'Every day';
  if (days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d))) return 'Weekdays';
  if (days.length === 2 && [0, 6].every((d) => days.includes(d))) return 'Weekends';
  return days
    .slice()
    .sort()
    .map((d) => DAY_LABELS[d])
    .join(' ');
}

export default function AlarmsPanel() {
  const [userId, setUserId] = useState<string | null>(null);
  const [alarms, setAlarms] = useState<Alarm[]>(() => readCachedAlarms());
  const [pushStatus, setPushStatus] = useState<PushStatus>('unsubscribed');
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState('Alarm');
  const [time, setTime] = useState('07:00');
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (uid) fetchAlarms(uid).then(setAlarms);
    });
    getPushStatus().then(setPushStatus);
  }, []);

  const toggleDay = (d: number) => {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  };

  const handleEnablePush = async () => {
    if (!userId) return;
    const next = await subscribeToPush(userId);
    setPushStatus(next);
  };

  const handleAdd = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      const created = await createAlarm(userId, { label: label.trim() || 'Alarm', time, days });
      if (created) setAlarms((prev) => [...prev, created].sort((a, b) => a.time.localeCompare(b.time)));
      setShowForm(false);
      setLabel('Alarm');
      setTime('07:00');
      setDays([0, 1, 2, 3, 4, 5, 6]);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnabled = async (a: Alarm) => {
    setAlarms((prev) => prev.map((x) => (x.id === a.id ? { ...x, enabled: !x.enabled } : x)));
    await updateAlarm(a.id, { enabled: !a.enabled });
  };

  const handleDelete = async (id: string) => {
    setAlarms((prev) => prev.filter((a) => a.id !== id));
    await deleteAlarm(id);
  };

  return (
    <div className="flex flex-col items-center py-4 w-full">
      {pushStatus !== 'subscribed' && (
        <button
          onClick={handleEnablePush}
          className="cursor-target mb-5 flex items-center gap-2 rounded-2xl sm:rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-2.5 sm:py-2 text-[11.5px] sm:text-[12px] font-semibold text-purple-300 hover:bg-purple-500/15 transition-colors w-full sm:w-auto max-w-md text-left sm:text-center"
        >
          <AlarmClock className="h-3.5 w-3.5 shrink-0" />
          <span>Enable push so alarms fire even when this tab is closed</span>
        </button>
      )}

      <div className="w-full max-w-md space-y-2.5">
        {alarms.length === 0 && !showForm && (
          <div className="flex flex-col items-center gap-2 text-center py-8 text-neutral-600">
            <BellOff className="h-6 w-6" />
            <p className="text-[12.5px]">No alarms set yet.</p>
          </div>
        )}

        {alarms.map((a) => (
          <div
            key={a.id}
            className="flex items-center gap-3 sm:gap-4 rounded-xl border border-neutral-800 bg-neutral-950/40 px-3 sm:px-4 py-3"
          >
            <button
              onClick={() => handleToggleEnabled(a)}
              className={`cursor-target shrink-0 inline-flex h-6 w-10 items-center rounded-full transition-colors ${
                a.enabled ? 'bg-purple-500' : 'bg-neutral-800'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-neutral-100 shadow transition-transform ${
                  a.enabled ? 'translate-x-[18px]' : 'translate-x-0.5'
                }`}
              />
            </button>
            <div className="min-w-0 flex-1 pl-0.5">
              <div className={`text-base sm:text-lg font-bold tabular-nums leading-tight truncate ${a.enabled ? 'text-neutral-100' : 'text-neutral-600'}`}>{a.time}</div>
              <div className="text-[10.5px] sm:text-[11px] text-neutral-500 truncate mt-0.5">
                {a.label} · {formatDays(a.days)}
              </div>
            </div>
            <button
              onClick={() => handleDelete(a.id)}
              className="cursor-target shrink-0 rounded-lg p-2 text-neutral-600 hover:text-rose-400 hover:bg-rose-950/20 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}

        {showForm && (
          <div className="rounded-xl border border-purple-800/40 bg-purple-950/20 p-3.5 sm:p-4 space-y-3">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Label"
              className="w-full rounded-lg bg-neutral-950 border border-neutral-800 px-3 py-2 text-[12.5px] text-neutral-200 focus:outline-none focus:border-purple-600"
            />
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full rounded-lg bg-neutral-950 border border-neutral-800 px-3 py-2 text-[13px] text-neutral-200 focus:outline-none focus:border-purple-600"
            />
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
              {DAY_LABELS.map((label2, i) => (
                <button
                  key={i}
                  onClick={() => toggleDay(i)}
                  className={`cursor-target aspect-square w-full rounded-full text-[10px] sm:text-[10.5px] font-bold transition-colors ${
                    days.includes(i) ? 'bg-purple-500 text-neutral-950' : 'bg-neutral-900 text-neutral-500'
                  }`}
                >
                  {label2}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowForm(false)}
                className="cursor-target flex-1 rounded-lg border border-neutral-800 py-2 text-[12px] font-semibold text-neutral-400 hover:bg-neutral-900"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={saving}
                className="cursor-target flex-1 rounded-lg bg-gradient-to-br from-purple-500 to-fuchsia-600 py-2 text-[12px] font-bold text-neutral-950 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save Alarm'}
              </button>
            </div>
          </div>
        )}

        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            disabled={!userId}
            className="cursor-target w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-700 py-3 text-[12.5px] font-semibold text-neutral-400 hover:text-purple-300 hover:border-purple-700 transition-colors disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Add Alarm
          </button>
        )}
      </div>
    </div>
  );
}