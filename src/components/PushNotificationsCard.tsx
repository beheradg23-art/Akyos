import React, { useEffect, useState } from 'react';
import { Bell, BellOff, BellRing } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { getPushStatus, subscribeToPush, unsubscribeFromPush, pushSupported, type PushStatus } from '../lib/pushNotifications';
import { primeNotificationSound } from '../lib/notificationSound';
import { toast } from '../lib/toast';
import { haptic } from '../lib/haptics';

export default function PushNotificationsCard() {
  const [status, setStatus] = useState<PushStatus>('unsubscribed');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getPushStatus().then(setStatus);
  }, []);

  const handleToggle = async () => {
    setBusy(true);
    try {
      if (status === 'subscribed') {
        await unsubscribeFromPush();
        setStatus('unsubscribed');
        haptic.light();
        toast.info('Notifications turned off for this device.');
      } else {
        primeNotificationSound();
        const { data } = await supabase.auth.getUser();
        const userId = data.user?.id;
        if (!userId) return;
        const next = await subscribeToPush(userId);
        setStatus(next);
        if (next === 'subscribed') {
          haptic.success();
          toast.success('Notifications turned on for this device.');
        } else if (next === 'denied') {
          haptic.error();
          toast.error('Blocked — allow notifications for this site in your browser settings.');
        }
      }
    } catch {
      haptic.error();
      toast.error('Could not update your notification settings. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const supported = pushSupported();

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-fuchsia-600">
            {status === 'subscribed' ? (
              <BellRing className="h-4.5 w-4.5 text-neutral-950" strokeWidth={2} />
            ) : (
              <Bell className="h-4.5 w-4.5 text-neutral-950" strokeWidth={2} />
            )}
          </div>
          <div>
            <h3 className="text-[13.5px] font-bold text-neutral-100">Push Notifications</h3>
            <p className="text-[12px] text-neutral-500 mt-0.5">
              {!supported
                ? 'Not supported in this browser'
                : status === 'denied'
                ? 'Blocked — allow notifications for this site in your browser settings'
                : status === 'subscribed'
                ? 'On for this device'
                : 'Off for this device'}
            </p>
          </div>
        </div>

        <button
          onClick={handleToggle}
          disabled={busy || !supported || status === 'denied'}
          className="flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-[12px] font-semibold text-neutral-200 hover:bg-neutral-800 transition-colors disabled:opacity-50 shrink-0"
        >
          {status === 'subscribed' ? <BellOff className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
          {busy ? 'Working…' : status === 'subscribed' ? 'Turn Off' : 'Turn On'}
        </button>
      </div>

      <p className="mt-3 text-[11px] text-neutral-600 leading-relaxed">
        Covers Master Timeline reminders (5 min before each block), Pomodoro completion, and Alarms — delivered
        even if the app is closed or your phone is asleep, with a vibration and Akyos's chime. On iPhone, this only
        works after you've added Akyos to your Home Screen (Share → Add to Home Screen) — Safari won't deliver push
        to a regular browser tab. The chime plays when the app has a tab open somewhere (even in the background); if
        Akyos is fully closed, your phone's own default notification sound plays instead — no website can override
        that part.
      </p>
    </div>
  );
}