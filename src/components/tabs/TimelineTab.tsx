// Daily Timeline tab: the hour-by-hour schedule (study slots, meals, gym,
// sleep) plus the weight tracker and push-notification toggle.
import React, { useState, useEffect } from 'react';
import { Clock3, Weight, ArrowUpRight, Bell, BellOff } from 'lucide-react';
import { ConfigContext, getSubjectStyle } from '../../lib/appConfig';
import { RippleButton, ModalData } from '../ui/Primitives';
import { EditableSectionHeading } from '../shared/EditableSectionHeading';

export function TimelineTab({ setModal, notificationsEnabled, notificationPermission, onToggleNotifications }: { setModal: (data: ModalData | null) => void; notificationsEnabled: boolean; notificationPermission: NotificationPermission | 'unsupported'; onToggleNotifications: () => void }) {
  const { timeline, subjects } = React.useContext(ConfigContext);
  const typeStyle = {
    study: 'border-l-indigo-500',
    gym: 'border-l-violet-500',
    meal: 'border-l-amber-500',
    prep: 'border-l-neutral-600',
    sleep: 'border-l-violet-500',
  };
  const typeBg = {
    study: 'bg-indigo-500/10 text-indigo-400',
    gym: 'bg-violet-500/10 text-violet-400',
    meal: 'bg-amber-500/10 text-amber-400',
    prep: 'bg-neutral-800 text-neutral-400',
    sleep: 'bg-violet-500/10 text-violet-400',
  };

  return (
    <div className="animate-fadeIn">
      <style>{`
        /* Rotating "sweep stroke" for the Master Timeline blocks: a bright
           arc travels endlessly around each block's border ring. Built as
           a ::before layered on top of the block, masked with
           mask-composite: exclude so only the border-width ring (padding
           below) is ever painted — the content-box middle is punched out
           of the mask entirely, so the label/time/icon text underneath is
           never touched by this, only the box's own border area is. */
        @property --tl-sweep-angle {
          syntax: '<angle>';
          inherits: false;
          initial-value: 0deg;
        }
        .tl-sweep-box {
          position: relative;
        }
        .tl-sweep-box::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 1.5px;
          background: conic-gradient(from var(--tl-sweep-angle),
            transparent 0deg,
            transparent 264deg,
            rgba(167,139,250,0.85) 300deg,
            rgba(216,180,254,1) 315deg,
            rgba(167,139,250,0.85) 330deg,
            transparent 360deg);
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          animation: tl-sweep-rotate 4.5s linear infinite;
          pointer-events: none;
        }
        @keyframes tl-sweep-rotate {
          to { --tl-sweep-angle: 360deg; }
        }
      `}</style>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-1">
        <EditableSectionHeading id="tl_master" defaultTitle="Master Timeline" defaultIcon={Clock3} subtitle="Interactive structural day architecture — Click any block for tactical execution logs" />
        <RippleButton
          onClick={onToggleNotifications}
          className={`cursor-target shrink-0 flex items-center gap-2 rounded-full border px-3.5 py-2 text-[12px] font-semibold transition-colors ${
            notificationsEnabled
              ? 'border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/15'
              : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
          }`}
        >
          {notificationsEnabled ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
          {notificationsEnabled ? 'Block Reminders On' : 'Enable Block Reminders'}
        </RippleButton>
      </div>
      {notificationPermission === 'denied' && (
        <p className="text-[11.5px] text-rose-400/80 mb-4">
          Notifications are blocked for this site in your browser settings — allow them there first, then try again.
        </p>
      )}
      {notificationsEnabled && notificationPermission === 'granted' && (
        <p className="text-[11.5px] text-neutral-600 mb-4">
          You'll get a ping 5 minutes before each block starts — this now works even if the app is closed or your phone is asleep, as long as Push Notifications is on for this device (Account &gt; Push Notifications).
        </p>
      )}
      <div className="space-y-2.5">
        {timeline.map((slot, i) => {
          const Icon = slot.icon;
          const sub = slot.subject ? getSubjectStyle(slot.subject, subjects) : null;
          return (
            <div
              key={i}
              onClick={() => setModal({
                title: slot.label,
                subtitle: `Time Block: ${slot.start} - ${slot.end}`,
                icon: slot.icon,
                textBody: slot.longDesc || slot.detail,
                arrayTitle: 'Tactical Blueprint',
                arrayItems: slot.subject ? ['Execute active recall models', 'Avoid passive consumption modes', 'Track mistake logs inside errors catalog'] : ['Execute standard systemic recovery actions']
              })}
              className={`tl-sweep-box flex items-center gap-4 rounded-xl border border-neutral-800 bg-neutral-900/50 border-l-2 ${typeStyle[slot.type]} px-4 py-3.5 cursor-pointer transition-all hover:bg-neutral-900/90 hover:translate-x-1`}
            >
              <div className="w-[92px] shrink-0 tabular-nums text-[12.5px] font-medium text-neutral-400">
                {slot.start === slot.end ? slot.start : `${slot.start}–${slot.end}`}
              </div>
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${typeBg[slot.type]}`}>
                <Icon className="h-4 w-4" strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13.5px] font-medium text-neutral-100">{slot.label}</span>
                  {sub && (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${sub.bg} ${sub.text}`}>
                      {slot.subject}
                    </span>
                  )}
                </div>
                <div className="text-[12px] text-neutral-500 mt-0.5">{slot.detail}</div>
              </div>
              <ArrowUpRight className="h-3 w-3 text-neutral-600 shrink-0" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Tab Subcomponent: Training & Fuel ----------