// Daily Timeline tab: the hour-by-hour schedule (study slots, meals, gym,
// sleep) plus the weight tracker.
import React, { useState } from 'react';
import { Clock3, Weight, ArrowUpRight } from 'lucide-react';
import { ConfigContext, getSubjectStyle } from '../../lib/appConfig';
import { ModalData } from '../ui/Primitives';
import { EditableSectionHeading } from '../shared/EditableSectionHeading';
import { liquidFillStyle, SWEEP_REVEAL_STYLE, useSweepReveal } from '../../lib/liquidFill';

// Split out of the timeline row's inline JSX so useSweepReveal (which
// tracks its own hover-out fade timer) has one stable component instance
// per row to attach to, instead of being called a variable number of
// times inside the .map() below — see the identical extraction/rationale
// for PhasePill in SyllabusTab.tsx.
function TimelineBlock({ slot, sub, borderClass, iconBg, onClick }: { slot: any; sub: { bg: string; text: string } | null; borderClass: string; iconBg: string; onClick: () => void }) {
  const [hovering, setHovering] = useState(false);
  const sweep = useSweepReveal(hovering);
  const Icon = slot.icon;
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      className={`relative overflow-hidden flex items-center gap-4 rounded-xl border border-neutral-800 bg-neutral-900/50 border-l-2 ${borderClass} px-4 py-3.5 cursor-pointer transition-all hover:bg-neutral-900/90 hover:translate-x-1`}
    >
      {sweep.mounted && (
        // Same animated gradient sweep border as the dashboard's
        // <Card> bento boxes (see Primitives.tsx SectionHeading /
        // Card comments for the full breakdown): a corner-to-corner
        // `--akyos-sweep` mask plays once on hover-in, wrapping a
        // ring-only cutout (padding + content-box mask-composite
        // exclude/xor) filled with the shared moving liquidFillStyle()
        // brand gradient — so this block picks up the exact same
        // "live material" treatment as every other bento card. Faded
        // back out (no re-sweep) via useSweepReveal on hover-out.
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
      <div className="w-[92px] shrink-0 tabular-nums text-[12.5px] font-medium text-neutral-400">
        {slot.start === slot.end ? slot.start : `${slot.start}–${slot.end}`}
      </div>
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
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
}

export function TimelineTab({ setModal }: { setModal: (data: ModalData | null) => void }) {
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
      <div className="flex items-start justify-between gap-4 flex-wrap mb-1">
        <EditableSectionHeading id="tl_master" defaultTitle="Master Timeline" defaultIcon={Clock3} subtitle="Interactive structural day architecture — Click any block for tactical execution logs" />
      </div>
      <div className="space-y-2.5">
        {timeline.map((slot, i) => {
          const sub = slot.subject ? getSubjectStyle(slot.subject, subjects) : null;
          return (
            <TimelineBlock
              key={i}
              slot={slot}
              sub={sub}
              borderClass={typeStyle[slot.type]}
              iconBg={typeBg[slot.type]}
              onClick={() => setModal({
                title: slot.label,
                subtitle: `Time Block: ${slot.start} - ${slot.end}`,
                icon: slot.icon,
                textBody: slot.longDesc || slot.detail,
                arrayTitle: 'Tactical Blueprint',
                arrayItems: slot.subject ? ['Execute active recall models', 'Avoid passive consumption modes', 'Track mistake logs inside errors catalog'] : ['Execute standard systemic recovery actions']
              })}
            />
          );
        })}
      </div>
    </div>
  );
}

// ---------- Tab Subcomponent: Training & Fuel ----------