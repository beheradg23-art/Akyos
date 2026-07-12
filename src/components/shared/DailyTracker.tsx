// The "Bento Box" daily execution checklist sidebar — the 6-10 tracker
// items (wake-up, study blocks, gym, meals, sleep lock, etc.) whose
// completion drives the streak and Hunter Rank calculations.
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { CheckCircle2, Circle, Timer, Calendar } from 'lucide-react';
import { ConfigContext, getDayName, TrackerItem, TabLabelKey } from '../../lib/appConfig';
import { liquidFillStyle } from '../../lib/liquidFill';
import { useRipple } from '../ui/Primitives';
import { haptic } from '../../lib/haptics';

export function TrackerItemButton({ item, isChecked, onToggle, isDerived }: { item: TrackerItem; isChecked: boolean; onToggle: (id: string) => void; isDerived?: boolean }) {
  const ref = useRef(null);
  const [pressed, setPressed] = useState(false);
  const [spawnRipple, rippleNodes] = useRipple();

  const handleDown = (e) => {
    setPressed(true);
    spawnRipple(e, ref.current);
  };
  const handleUp = () => setPressed(false);
  const handleClick = () => {
    haptic.light();
    onToggle?.();
  };

  return (
    <button
      ref={ref}
      onClick={handleClick}
      onMouseDown={handleDown}
      onMouseUp={handleUp}
      onMouseLeave={handleUp}
      onTouchStart={handleDown}
      onTouchEnd={handleUp}
      title={isDerived ? 'Auto-synced from the Fuel Matrix meal log — click to go log meals' : undefined}
      className={`cursor-target relative flex flex-col items-start justify-between overflow-hidden p-3.5 rounded-xl border text-left transition-colors duration-200 group ${
        isChecked
          ? 'bg-violet-500/[0.08] border-violet-500/30 shadow-[inset_0_0_12px_rgba(167,139,250,0.05)]'
          : 'bg-neutral-900/40 border-neutral-800 hover:bg-neutral-800/60 hover:border-neutral-700'
      }`}
      style={{
        transform: `scale(${pressed ? 0.955 : 1})`,
        transition: 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div className="flex w-full justify-between items-start mb-2.5">
        {isChecked ? (
          <CheckCircle2 className="h-4.5 w-4.5 text-violet-400 shrink-0" strokeWidth={2} />
        ) : (
          <Circle className="h-4.5 w-4.5 text-neutral-600 group-hover:text-neutral-400 shrink-0 transition-colors" strokeWidth={1.75} />
        )}
        {isDerived && (
          <span className="text-[8.5px] uppercase tracking-wider font-bold text-neutral-600 group-hover:text-neutral-400 transition-colors">Auto</span>
        )}
      </div>
      <span className={`text-[11.5px] font-medium leading-snug transition-colors ${isChecked ? 'text-violet-200/90' : 'text-neutral-300 group-hover:text-neutral-200'}`}>
        {item.label}
      </span>
      {rippleNodes}
    </button>
  );
}

export function DailyTracker({ currentDayStr, checked, onToggle, setActiveTab }: { currentDayStr: string; checked: Record<string, boolean>; onToggle: (id: string) => void; setActiveTab: (tab: TabLabelKey) => void }) {
  const { trackerItems } = React.useContext(ConfigContext);
  const [timeLeft, setTimeLeft] = useState('');

  // Live midnight countdown logic
  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const diff = tomorrow.getTime() - now.getTime();

      const h = String(Math.floor((diff / (1000 * 60 * 60)) % 24)).padStart(2, '0');
      const m = String(Math.floor((diff / 1000 / 60) % 60)).padStart(2, '0');
      const s = String(Math.floor((diff / 1000) % 60)).padStart(2, '0');

      setTimeLeft(`${h}:${m}:${s}`);
    };

    updateTimer(); 
    const timerId = setInterval(updateTimer, 1000);
    return () => clearInterval(timerId);
  }, []);

  const total = trackerItems.length;
  const done = trackerItems.filter((i) => checked[i.id]).length;
  const pct = Math.round((done / total) * 100);
  const formattedDay = useMemo(() => getDayName(currentDayStr), [currentDayStr]);

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 backdrop-blur-sm p-5 lg:sticky lg:top-6">
      
      {/* Bento Header & Timer */}
      <div className="flex flex-col gap-3 mb-5">
        <div className="flex items-center justify-between">
          <h3 className="text-[13px] font-semibold tracking-tight text-neutral-100">Daily Matrix</h3>
          <span className="text-[12px] font-medium text-neutral-500">{done}/{total}</span>
        </div>
        
        <div className="flex justify-between items-center bg-neutral-950/40 border border-neutral-800/60 rounded-lg p-2">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold">Current Cycle</span>
            <span className="text-[12px] text-neutral-300 font-medium">{formattedDay}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold">Day Ending In</span>
            <div className="flex items-center gap-1.5 text-violet-400/90 font-mono text-[13px] font-semibold tracking-tight">
              <Timer className="h-3.5 w-3.5" />
              {timeLeft}
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="relative h-2 w-full overflow-visible rounded-full bg-neutral-800">
          <div className="h-full w-full overflow-hidden rounded-full">
            <div
              className="h-full rounded-full transition-[width] duration-500 ease-out"
              style={liquidFillStyle({ width: `${pct}%` })}
            />
          </div>
          {pct >= 70 && pct < 100 && (
            <div
              className="absolute top-0 h-2 pointer-events-none transition-all duration-500 ease-out"
              style={{ left: `${pct}%`, transform: 'translateX(-4px)' }}
            >
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="absolute bottom-0 rounded-full animate-emberRise"
                  style={{
                    left: `${i * 3}px`,
                    width: 2 + (i % 2),
                    height: 2 + (i % 2),
                    background: 'radial-gradient(circle, #fef3c7, #fb923c)',
                    animationDelay: `${i * 0.32}s`,
                    animationDuration: '1.1s',
                  }}
                />
              ))}
            </div>
          )}
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-[20px] font-semibold text-neutral-100 tabular-nums">{pct}%</span>
          <span className="text-[11px] text-neutral-500">
            {pct === 100 ? 'Day complete' : pct >= 70 ? "You're on fire" : pct >= 60 ? 'On pace' : pct === 0 ? 'Not started' : 'In progress'}
          </span>
        </div>
      </div>

      {/* Bento Grid layout */}
      <div className="grid grid-cols-2 gap-2.5">
        {trackerItems.map((item) => {
          const isDerived = item.id === 't6';
          return (
            <TrackerItemButton
              key={item.id}
              item={item}
              isChecked={!!checked[item.id]}
              isDerived={isDerived}
              onToggle={isDerived ? () => setActiveTab && setActiveTab('training') : () => onToggle(item.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

// ---------- Tab Subcomponent: Performance Calendar Matrix ----------

// ---------- Data Backup & Restore ----------
// Everything in this app lives only in this browser's localStorage. There is
// no server, no account, no sync — clear site data or switch devices and the
// entire history is gone for good. This gives a way out: a single JSON file
// download that captures the Daily Matrix history plus Ash's Clock state,
// and a matching import to restore it anywhere.

