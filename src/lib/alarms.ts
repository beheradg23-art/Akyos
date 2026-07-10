import { supabase } from './supabaseClient';

// Alarms live in Supabase (not just localStorage) because the server-side
// scheduler is what actually fires the push while your device is asleep or
// the app is closed — it has no way to read your browser's localStorage.
// We still mirror the list into this localStorage key (already wired into
// cloudSync.ts's SYNC_KEYS) purely so the Alarms panel has something to
// show instantly before the network round-trip resolves, and still works
// read-only if you're offline.

export const ALARMS_CACHE_KEY = 'dcc_alarms_v1';

export type Alarm = {
  id: string;
  label: string;
  time: string; // 'HH:MM'
  days: number[]; // 0=Sun .. 6=Sat, empty = one-off / every day depending on your preference
  enabled: boolean;
};

function readCache(): Alarm[] {
  try {
    return JSON.parse(localStorage.getItem(ALARMS_CACHE_KEY) || '[]');
  } catch {
    return [];
  }
}

function writeCache(alarms: Alarm[]) {
  try {
    localStorage.setItem(ALARMS_CACHE_KEY, JSON.stringify(alarms));
  } catch {
    /* storage unavailable — fail silently */
  }
}

export function readCachedAlarms(): Alarm[] {
  return readCache();
}

export async function fetchAlarms(userId: string): Promise<Alarm[]> {
  const { data, error } = await supabase
    .from('alarms')
    .select('id,label,time,days,enabled')
    .eq('user_id', userId)
    .order('time', { ascending: true });
  if (error) {
    console.error('[alarms] fetch failed', error);
    return readCache();
  }
  const alarms = (data || []) as Alarm[];
  writeCache(alarms);
  return alarms;
}

export async function createAlarm(
  userId: string,
  alarm: { label: string; time: string; days: number[] }
): Promise<Alarm | null> {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const { data, error } = await supabase
    .from('alarms')
    .insert({ user_id: userId, label: alarm.label, time: alarm.time, days: alarm.days, timezone, enabled: true })
    .select('id,label,time,days,enabled')
    .single();
  if (error) {
    console.error('[alarms] create failed', error);
    return null;
  }
  writeCache([...readCache(), data as Alarm]);
  return data as Alarm;
}

export async function updateAlarm(id: string, patch: Partial<Pick<Alarm, 'label' | 'time' | 'days' | 'enabled'>>): Promise<void> {
  const { error } = await supabase.from('alarms').update(patch).eq('id', id);
  if (error) {
    console.error('[alarms] update failed', error);
    return;
  }
  writeCache(readCache().map((a) => (a.id === id ? { ...a, ...patch } : a)));
}

export async function deleteAlarm(id: string): Promise<void> {
  const { error } = await supabase.from('alarms').delete().eq('id', id);
  if (error) {
    console.error('[alarms] delete failed', error);
    return;
  }
  writeCache(readCache().filter((a) => a.id !== id));
}