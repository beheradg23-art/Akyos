// Standalone personal countdowns card (e.g. "JEE Main", "Boards") shown on
// the Overview tab. Ticks down live and colors itself from
// COUNTDOWN_COLOR_PALETTE, sorted so the soonest-ending countdown is first.
import React, { useState, useEffect } from 'react';
import { Target, Settings } from 'lucide-react';
import { ConfigContext, CountdownItem, getCountdownColor, getPreciseCountdown } from '../../lib/appConfig';
import { Card } from '../ui/Primitives';
import { EditableSectionHeading } from './EditableSectionHeading';

export function CountdownMatrix() {
  const { countdowns } = React.useContext(ConfigContext);
  const hasAny = Array.isArray(countdowns) && countdowns.length > 0;

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!hasAny) return;
    const tick = () => setNowMs(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [hasAny]);

  if (!hasAny) {
    return (
      <Card className="border border-neutral-800/80 bg-gradient-to-br from-neutral-900/90 to-neutral-950/40">
        <EditableSectionHeading id="ov_countdown" defaultTitle="Countdown" defaultIcon={Target} subtitle="Set a target date to see it here" />
        <p className="text-[12.5px] text-neutral-500">
          Add one in <span className="text-neutral-300 font-medium">Settings &gt; Countdown</span> to track live time remaining toward it — you can add more than one.
        </p>
      </Card>
    );
  }

  // Every countdown lives inside this single card — resolve each one's
  // live result first, then sort so whichever ends soonest always sits
  // first, next-soonest right after, and so on. Anything expired sinks to
  // the bottom (it already happened), and anything still missing a target
  // date sinks under that, since there's nothing to rank it by yet.
  const resolved = countdowns.map((cd) => {
    const targetDate: string = cd?.targetDate || '';
    const targetTime: string = cd?.targetTime || '00:00';
    const result = targetDate ? getPreciseCountdown(targetDate, targetTime, nowMs) : null;
    return { cd, result };
  });

  const sorted = [...resolved].sort((a, b) => {
    if (!a.result && !b.result) return 0;
    if (!a.result) return 1;
    if (!b.result) return -1;
    if (a.result.expired !== b.result.expired) return a.result.expired ? 1 : -1;
    return a.result.diffMs - b.result.diffMs;
  });

  const count = sorted.length;
  // Fluid tile sizing: fewer countdowns get more breathing room, more of
  // them squeeze down and wrap via auto-fit so the row always fills the
  // available width instead of leaving gaps or forcing a fixed column count.
  const minTileWidth = count === 1 ? 240 : count === 2 ? 200 : count === 3 ? 165 : 140;

  return (
    <Card className="border border-neutral-800/80 bg-gradient-to-br from-neutral-900/90 to-neutral-950/40">
      <EditableSectionHeading
        id="ov_countdown"
        defaultIcon={Target}
        defaultTitle="Countdown"
        subtitle={count > 1 ? `${count} targets, nearest first` : 'Time remaining toward your target'}
      />
      <div
        className="grid gap-3 items-stretch"
        style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${minTileWidth}px, 1fr))` }}
      >
        {sorted.map(({ cd, result }) => (
          <CountdownEntry key={cd.id} countdown={cd} result={result} compact={count > 2} />
        ))}
      </div>
    </Card>
  );
}

export function CountdownEntry({ countdown, result, compact }: { countdown: CountdownItem; result: ReturnType<typeof getPreciseCountdown> | null; compact: boolean }) {
  const label = countdown?.label || 'Your Countdown';
  const palette = getCountdownColor(countdown?.color);

  if (!countdown?.targetDate || !result) {
    // An incomplete entry (label set but no date yet, etc.) — don't hide it
    // entirely, just nudge back to Settings rather than showing bad math.
    return (
      <div className={`rounded-xl border ${palette.tileBorder} ${palette.tileBg} p-3.5 flex flex-col justify-between min-w-0`}>
        <div className="text-[10px] uppercase font-bold tracking-widest text-neutral-500 mb-1 truncate">{label}</div>
        <p className="text-[11.5px] text-neutral-500 leading-snug">
          Missing a target date — finish it in <span className="text-neutral-300 font-medium">Settings &gt; Countdown</span>.
        </p>
      </div>
    );
  }

  const unitLabels = result.mode === 'dhm' ? 'DAYS : HRS : MINS' : 'HRS : MINS : SECS';

  // Depleting bar: full when this countdown was first set, empty at the
  // target. `startMs` is stamped automatically whenever the target
  // date/time is (re)saved in Settings > Countdown. Older/migrated
  // countdowns without a startMs fall back to a generic 180-day span so the
  // bar still shows something sensible.
  const FALLBACK_SPAN_MS = 180 * 24 * 60 * 60 * 1000;
  const startMs: number | null = typeof countdown?.startMs === 'number' ? countdown.startMs : null;
  const totalSpanMs = startMs ? Math.max(result.targetMs - startMs, 1) : FALLBACK_SPAN_MS;
  const remainingPct = result.expired ? 0 : Math.max(0, Math.min(100, (result.diffMs / totalSpanMs) * 100));

  return (
    <div className={`rounded-xl border ${palette.tileBorder} ${palette.tileBg} p-3.5 flex flex-col justify-between min-w-0`}>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${palette.dot}`} />
        <div className={`text-[10px] uppercase font-bold tracking-widest ${palette.text}/80 truncate`}>{label}</div>
      </div>
      <div className={compact ? 'mt-2.5' : 'mt-4'}>
        <span className={`${compact ? 'text-xl' : 'text-3xl'} font-semibold tracking-tight tabular-nums ${result.expired ? 'text-neutral-500' : palette.text}`}>
          {result.text}
        </span>
      </div>
      <div className="mt-1 text-[9.5px] tracking-widest text-neutral-600 font-medium truncate">{result.expired ? 'ARRIVED' : unitLabels}</div>
      <div className="mt-2 h-1 w-full bg-neutral-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${palette.barBg}`} style={{ width: `${remainingPct}%` }} />
      </div>
    </div>
  );
}

// ---------- Bento Box Daily Execution Tracker Sidebar ----------