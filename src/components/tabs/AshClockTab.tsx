// Ash's Clock tab: fade-digit live clock + Pomodoro timer and subject-hour
// stats.
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Timer, Play, Pause, SkipForward, RotateCcw, Crown, Swords, BarChart3 } from 'lucide-react';
import { ConfigContext, getSubjectStyle, getLocalDateString } from '../../lib/appConfig';
import { liquidFillStyle, liquidFillStyleFor } from '../../lib/liquidFill';
import { Card, RippleButton } from '../ui/Primitives';
import { EditableSectionHeading } from '../shared/EditableSectionHeading';
import { haptic } from '../../lib/haptics';

export const DEFAULT_FOCUS_MIN = 50;
export const DEFAULT_BREAK_MIN = 10;

export function FadeDigit({ char, size = 84, direction = 'up' }: { char: string; size?: number | string; direction?: 'up' | 'down' }) {
  const [current, setCurrent] = useState(char);
  const [outgoing, setOutgoing] = useState<string | null>(null);
  const timeoutRef = useRef<any>(null);

  useEffect(() => {
    if (char !== current) {
      setOutgoing(current);
      setCurrent(char);
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setOutgoing(null), 420);
    }
    return () => clearTimeout(timeoutRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [char]);

  const styleVar = { ['--fade-h' as any]: typeof size === 'number' ? `${size}px` : size };
  const inClass = direction === 'up' ? 'fade-num-in-up' : 'fade-num-in-down';
  const outClass = direction === 'up' ? 'fade-num-out-up' : 'fade-num-out-down';

  return (
    <div className="fade-unit" style={styleVar}>
      {outgoing !== null && (
        <span key={`out-${outgoing}`} className={`fade-num ${outClass}`}>{outgoing}</span>
      )}
      <span key={`in-${current}`} className={`fade-num ${inClass}`}>{current}</span>
    </div>
  );
}

export function FadePair({ value, size = 84, direction = 'up' }: { value: string; size?: number | string; direction?: 'up' | 'down' }) {
  const chars = value.padStart(2, '0').split('');
  return (
    <div className="flex gap-1">
      <FadeDigit char={chars[0]} size={size} direction={direction} />
      <FadeDigit char={chars[1]} size={size} direction={direction} />
    </div>
  );
}

export function FadeColon({ size = 84 }: { size?: number | string }) {
  const dotStyle = typeof size === 'number'
    ? { width: Math.max(5, size * 0.09), height: Math.max(5, size * 0.09) }
    : { width: 'clamp(4px, 1.4vw, 7px)', height: 'clamp(4px, 1.4vw, 7px)' };
  return (
    <div className="flex flex-col items-center justify-center gap-2" style={{ height: size }}>
      <span
        className="block rounded-full bg-purple-400/80 animate-dotBreathe"
        style={{ ...dotStyle, boxShadow: '0 0 8px rgba(192,132,252,0.8)' }}
      />
      <span
        className="block rounded-full bg-purple-400/80 animate-dotBreathe"
        style={{ ...dotStyle, boxShadow: '0 0 8px rgba(192,132,252,0.8)', animationDelay: '0.3s' }}
      />
    </div>
  );
}

export function LiveClockView() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const hours24 = now.getHours();
  const isPM = hours24 >= 12;
  let hours12 = hours24 % 12;
  if (hours12 === 0) hours12 = 12;
  const hh = hours12.toString().padStart(2, '0');
  const mm = now.getMinutes().toString().padStart(2, '0');
  const ss = now.getSeconds().toString().padStart(2, '0');

  const dateLabel = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="flex flex-col items-center py-6 w-full">
      <div className="flex items-end gap-1.5 sm:gap-3 max-w-full">
        <FadePair value={hh} size="clamp(38px, 10vw, 64px)" direction="up" />
        <FadeColon size="clamp(38px, 10vw, 64px)" />
        <FadePair value={mm} size="clamp(38px, 10vw, 64px)" direction="up" />
        <FadeColon size="clamp(38px, 10vw, 64px)" />
        <FadePair value={ss} size="clamp(38px, 10vw, 64px)" direction="up" />
        <span className="ml-1 sm:ml-2 mb-1.5 sm:mb-2 text-[10px] sm:text-xs font-bold text-purple-300/80 tracking-widest shrink-0">{isPM ? 'PM' : 'AM'}</span>
      </div>
      <p className="mt-6 text-[12.5px] text-neutral-500 tracking-wide">{dateLabel}</p>
      <p className="mt-1 text-[10px] text-purple-400/50 tracking-[0.2em] uppercase">Hunter's Association Standard Time</p>
    </div>
  );
}

// Everything needed to resume a session exactly where it left off after a
// refresh/close: which phase it's in, the subject, whether it was running,
// and either an absolute end timestamp (running) or a frozen countdown
// (paused). Storing an absolute `endTime` instead of just the raw seconds
// is what makes this survive a refresh accurately — the remaining time is
// recomputed from "how long until endTime", not from a counter that gets
// reset back to the full duration the moment the component remounts.
const POMODORO_STATE_KEY = 'ash_clock_pomodoro_state_v1';

type PersistedPomodoroState = {
  sessionType: 'focus' | 'break';
  isRunning: boolean;
  secondsLeft: number;
  endTime: number | null; // Date.now() + secondsLeft*1000 while running, else null
};

function loadPersistedPomodoroState(): PersistedPomodoroState | null {
  try {
    const raw = localStorage.getItem(POMODORO_STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function PomodoroView({ onSessionComplete }) {
  const { subjects } = React.useContext(ConfigContext);
  const [focusMinutes, setFocusMinutes] = useState<number>(() => {
    const saved = localStorage.getItem('ash_clock_focus_min');
    return saved ? parseInt(saved, 10) : DEFAULT_FOCUS_MIN;
  });
  const [breakMinutes, setBreakMinutes] = useState<number>(() => {
    const saved = localStorage.getItem('ash_clock_break_min');
    return saved ? parseInt(saved, 10) : DEFAULT_BREAK_MIN;
  });

  const [subject, setSubject] = useState<string>(() => localStorage.getItem('ash_clock_last_subject') || subjects[0]?.key || 'math');
  useEffect(() => { localStorage.setItem('ash_clock_last_subject', subject); }, [subject]);

  // Restore whatever was running/paused before the page was refreshed or
  // closed, computed once on mount (a ref, not state, so it's read exactly
  // once and doesn't force a re-render of its own).
  const restoredRef = useRef<PersistedPomodoroState | null>(null);
  if (restoredRef.current === null) {
    restoredRef.current = loadPersistedPomodoroState() || ({} as PersistedPomodoroState);
  }
  const restored = restoredRef.current;
  // If the session was still "running" and its end time already passed
  // while the tab was closed/refreshed/backgrounded, treat it as already
  // finished rather than resuming a live countdown — this is decided once,
  // up front, so the initial render never briefly starts a live interval
  // for a session that's actually over.
  const alreadyExpiredRef = useRef<boolean | null>(null);
  if (alreadyExpiredRef.current === null) {
    alreadyExpiredRef.current = !!(restored.isRunning && restored.endTime && restored.endTime <= Date.now());
  }
  const alreadyExpired = alreadyExpiredRef.current;

  const [sessionType, setSessionType] = useState<'focus' | 'break'>(restored.sessionType || 'focus');
  const [isRunning, setIsRunning] = useState<boolean>(() => !!restored.isRunning && !alreadyExpired);
  const [secondsLeft, setSecondsLeft] = useState<number>(() => {
    if (alreadyExpired) return 0;
    if (restored.isRunning && restored.endTime) {
      const remaining = Math.round((restored.endTime - Date.now()) / 1000);
      return Math.max(remaining, 0);
    }
    if (typeof restored.secondsLeft === 'number') return restored.secondsLeft;
    return focusMinutes * 60;
  });

  const [hunterLevel, setHunterLevel] = useState<number>(() => {
    const saved = localStorage.getItem('ash_clock_hunter_level');
    return saved ? parseInt(saved, 10) : 1;
  });
  const [questsCleared, setQuestsCleared] = useState<number>(() => {
    const saved = localStorage.getItem('ash_clock_quests_cleared');
    return saved ? parseInt(saved, 10) : 0;
  });

  const [systemMessage, setSystemMessage] = useState<string>(
    "[The Gate is sealed. Awaiting the Hunter's command to begin the Focus Quest.]"
  );

  const intervalRef = useRef<any>(null);

  // Persist sessionType/isRunning/secondsLeft on every change so a refresh
  // (or the tab being closed) can pick the countdown back up instead of
  // losing it. `endTime` is recomputed from the live secondsLeft each time,
  // so it stays self-correcting even while the interval ticks every second.
  useEffect(() => {
    const endTime = isRunning ? Date.now() + secondsLeft * 1000 : null;
    try {
      localStorage.setItem(
        POMODORO_STATE_KEY,
        JSON.stringify({ sessionType, isRunning, secondsLeft, endTime })
      );
    } catch {
      /* storage unavailable — fail silently, worst case a refresh loses the timer again */
    }
  }, [sessionType, isRunning, secondsLeft]);

  useEffect(() => { localStorage.setItem('ash_clock_focus_min', String(focusMinutes)); }, [focusMinutes]);
  useEffect(() => { localStorage.setItem('ash_clock_break_min', String(breakMinutes)); }, [breakMinutes]);
  useEffect(() => { localStorage.setItem('ash_clock_hunter_level', String(hunterLevel)); }, [hunterLevel]);
  useEffect(() => { localStorage.setItem('ash_clock_quests_cleared', String(questsCleared)); }, [questsCleared]);

  // If duration settings change while idle, keep the countdown in sync.
  // Skipped on the very first run (mount) so restoring a saved countdown
  // above doesn't immediately get overwritten back to the full duration.
  const durationSyncMounted = useRef(false);
  useEffect(() => {
    if (!durationSyncMounted.current) {
      durationSyncMounted.current = true;
      return;
    }
    if (!isRunning) {
      setSecondsLeft((sessionType === 'focus' ? focusMinutes : breakMinutes) * 60);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusMinutes, breakMinutes]);

  const playChime = () => {
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 660;
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.9);
    } catch {
      // Silent environments (or browsers blocking autoplay) just skip the chime.
    }
  };

  const handleSessionComplete = () => {
    playChime();
    haptic.success();
    if (sessionType === 'focus') {
      const nextQuests = questsCleared + 1;
      setQuestsCleared(nextQuests);
      onSessionComplete?.(subject, focusMinutes);
      if (nextQuests % 4 === 0) {
        const nextLevel = hunterLevel + 1;
        setHunterLevel(nextLevel);
        setSystemMessage(`[Quest Clear!] EXP acquired. Hunter Level Up -> Lv. ${nextLevel}. Rest Zone unlocked.`);
      } else {
        setSystemMessage('[Quest Clear!] EXP acquired. Entering the Rest Zone — mana regenerating.');
      }
      setSessionType('break');
      setSecondsLeft(breakMinutes * 60);
    } else {
      setSystemMessage('[Rest complete.] A new Gate has appeared. Arise, Hunter.');
      setSessionType('focus');
      setSecondsLeft(focusMinutes * 60);
    }
    setIsRunning(false);
  };

  // If the session was still running and its end time already passed while
  // the tab was closed/refreshed/backgrounded, wrap it up now instead of
  // just silently sitting at 0 — same as if the countdown had hit zero
  // normally, just a beat late.
  const resumeCheckedRef = useRef(false);
  useEffect(() => {
    if (resumeCheckedRef.current) return;
    resumeCheckedRef.current = true;
    if (alreadyExpired) {
      handleSessionComplete();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            clearInterval(intervalRef.current);
            handleSessionComplete();
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning]);

  const totalSeconds = (sessionType === 'focus' ? focusMinutes : breakMinutes) * 60;
  const progressPct = totalSeconds ? ((totalSeconds - secondsLeft) / totalSeconds) * 100 : 0;

  const mm = Math.floor(secondsLeft / 60).toString().padStart(2, '0');
  const ss = (secondsLeft % 60).toString().padStart(2, '0');

  const handleStartPause = () => {
    if (!isRunning) {
      const freshStart = secondsLeft === 0;
      const newSecondsLeft = freshStart ? (sessionType === 'focus' ? focusMinutes : breakMinutes) * 60 : secondsLeft;
      if (freshStart) setSecondsLeft(newSecondsLeft);
      setSystemMessage(
        sessionType === 'focus'
          ? '[Quest Alert] A Focus Gate has opened. Clear it before the timer expires.'
          : '[Rest Zone] Recovering mana. The next Gate awaits.'
      );
    }
    setIsRunning((r) => !r);
  };

  const handleReset = () => {
    setIsRunning(false);
    setSecondsLeft((sessionType === 'focus' ? focusMinutes : breakMinutes) * 60);
    setSystemMessage("[Timer reset.] Awaiting the Hunter's command.");
  };

  const handleSkip = () => {
    setIsRunning(false);
    handleSessionComplete();
  };

  const adjustMinutes = (which: 'focus' | 'break', delta: number) => {
    if (isRunning) return;
    if (which === 'focus') {
      setFocusMinutes((m) => Math.max(5, Math.min(180, m + delta)));
    } else {
      setBreakMinutes((m) => Math.max(1, Math.min(60, m + delta)));
    }
  };

  return (
    <div className="flex flex-col items-center py-4">
      {/* Hunter Rank strip */}
      <div className="flex items-center gap-3 mb-5 text-[11px] font-semibold tracking-wide">
        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-950/50 border border-purple-800/40 text-purple-300">
          <Crown className="w-3.5 h-3.5" /> Hunter Lv. {hunterLevel}
        </span>
        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-fuchsia-950/40 border border-fuchsia-800/30 text-fuchsia-300">
          <Swords className="w-3.5 h-3.5" /> {questsCleared} Quests Cleared
        </span>
      </div>

      {/* Session badge */}
      <div
        className={`mb-4 px-4 py-1.5 rounded-full text-[11px] font-bold tracking-[0.15em] uppercase border ${
          sessionType === 'focus'
            ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
            : 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30'
        }`}
      >
        {sessionType === 'focus' ? 'Focus Gate' : 'Rest Zone'}
      </div>

      {/* Subject tag — which gate is this? */}
      <div className="flex items-center gap-1.5 mb-4 flex-wrap justify-center">
        {subjects.map((s) => (
          <RippleButton
            key={s.key}
            onClick={() => !isRunning && setSubject(s.key)}
            disabled={isRunning}
            className={`cursor-target rounded-full px-3 py-1 text-[10.5px] font-semibold border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              subject === s.key
                ? `${getSubjectStyle(s.key, subjects).bg} ${getSubjectStyle(s.key, subjects).text} ${getSubjectStyle(s.key, subjects).border}`
                : 'bg-neutral-900/60 text-neutral-500 border-neutral-800 hover:text-neutral-300'
            }`}
          >
            {s.label}
          </RippleButton>
        ))}
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3 max-w-full">
        <FadePair value={mm} size="clamp(46px, 14vw, 88px)" direction="down" />
        <FadeColon size="clamp(46px, 14vw, 88px)" />
        <FadePair value={ss} size="clamp(46px, 14vw, 88px)" direction="down" />
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-xs h-1.5 bg-neutral-800 rounded-full overflow-hidden mt-5">
        <div
          className="h-full rounded-full transition-[width] duration-1000 ease-linear"
          style={
            sessionType === 'focus'
              ? liquidFillStyle({ width: `${progressPct}%` })
              : liquidFillStyleFor('linear-gradient(115deg, #f0abfc 0%, #f472b6 35%, #fb7185 65%, #f472b6 85%, #f0abfc 100%)', { width: `${progressPct}%` })
          }
        />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 mt-6">
        <RippleButton
          onClick={handleReset}
          className="cursor-target rounded-full p-2.5 text-neutral-500 hover:text-purple-300 transition-colors active:scale-90"
          title="Reset"
        >
          <RotateCcw className="w-5 h-5" />
        </RippleButton>
        <RippleButton
          onClick={handleStartPause}
          className="cursor-target rounded-full w-14 h-14 flex items-center justify-center text-neutral-950 shadow-lg shadow-purple-500/30 hover:scale-105 active:scale-95 transition-transform"
          style={liquidFillStyle()}
          title={isRunning ? 'Pause' : 'Arise'}
        >
          {isRunning ? <Pause className="w-6 h-6" fill="currentColor" /> : <Play className="w-6 h-6 ml-0.5" fill="currentColor" />}
        </RippleButton>
        <RippleButton
          onClick={handleSkip}
          className="cursor-target rounded-full p-2.5 text-neutral-500 hover:text-purple-300 transition-colors active:scale-90"
          title="Skip to next session"
        >
          <SkipForward className="w-5 h-5" fill="currentColor" />
        </RippleButton>
      </div>

      {/* System message banner */}
      <div className="mt-6 w-full max-w-md text-center px-4 py-2.5 rounded-xl bg-purple-950/30 border border-purple-800/30">
        <p className="text-[11px] text-purple-300/80 leading-relaxed">{systemMessage}</p>
      </div>

      {/* Duration settings */}
      <div className="flex flex-col sm:flex-row gap-3 mt-6 w-full max-w-md">
        <div className="flex-1 flex items-center justify-between bg-neutral-950/40 border border-neutral-800 rounded-xl px-4 py-3">
          <span className="text-[11px] font-semibold text-neutral-400">Focus (min)</span>
          <div className="flex items-center gap-2">
            <RippleButton
              onClick={() => adjustMinutes('focus', -5)}
              disabled={isRunning}
              ariaLabel="Decrease focus duration by 5 minutes"
              className="cursor-target rounded-md w-6 h-6 flex items-center justify-center bg-neutral-800 text-neutral-300 disabled:opacity-30 hover:bg-neutral-700"
            >
              −
            </RippleButton>
            <span className="text-sm font-bold text-purple-300 w-8 text-center tabular-nums">{focusMinutes}</span>
            <RippleButton
              onClick={() => adjustMinutes('focus', 5)}
              disabled={isRunning}
              ariaLabel="Increase focus duration by 5 minutes"
              className="cursor-target rounded-md w-6 h-6 flex items-center justify-center bg-neutral-800 text-neutral-300 disabled:opacity-30 hover:bg-neutral-700"
            >
              +
            </RippleButton>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-between bg-neutral-950/40 border border-neutral-800 rounded-xl px-4 py-3">
          <span className="text-[11px] font-semibold text-neutral-400">Break (min)</span>
          <div className="flex items-center gap-2">
            <RippleButton
              onClick={() => adjustMinutes('break', -1)}
              disabled={isRunning}
              ariaLabel="Decrease break duration by 1 minute"
              className="cursor-target rounded-md w-6 h-6 flex items-center justify-center bg-neutral-800 text-neutral-300 disabled:opacity-30 hover:bg-neutral-700"
            >
              −
            </RippleButton>
            <span className="text-sm font-bold text-fuchsia-300 w-8 text-center tabular-nums">{breakMinutes}</span>
            <RippleButton
              onClick={() => adjustMinutes('break', 1)}
              disabled={isRunning}
              ariaLabel="Increase break duration by 1 minute"
              className="cursor-target rounded-md w-6 h-6 flex items-center justify-center bg-neutral-800 text-neutral-300 disabled:opacity-30 hover:bg-neutral-700"
            >
              +
            </RippleButton>
          </div>
        </div>
      </div>

      <p className="mt-5 text-[10px] text-purple-400/40 tracking-[0.15em] uppercase text-center">
        Sung Jinwoo trained relentlessly to become the strongest — this is your Gate.
      </p>
    </div>
  );
}

export function PomodoroSubjectStats({ log, subjects }) {
  const todayStr = getLocalDateString();

  // Only today's minutes — this is what makes the whole card reset itself
  // at midnight with no extra code: `todayStr` is recomputed on every
  // render/mount, so yesterday's entries in `log` simply stop matching and
  // drop out of `today` on their own. `log` itself still keeps full history
  // (nothing is deleted), it's just not summed into what's shown here.
  const totals = useMemo(() => {
    const today: Record<string, number> = {};
    log.forEach((entry: any) => {
      if (entry.date === todayStr) today[entry.subject] = (today[entry.subject] || 0) + entry.minutes;
    });
    return { today };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [log, todayStr]);

  const todayTotal: number = Object.values(totals.today).reduce((a: number, b: number) => a + b, 0);
  const maxSubjectMinutes = Math.max(1, ...Object.values(totals.today).length ? Object.values(totals.today) : [0]);

  // Show every configured subject (even ones with 0 minutes today, so the
  // list doesn't jump around/disappear entries as the day starts fresh),
  // union'd with any subject logged today that's since been removed from
  // config.subjects.
  const displaySubjects = useMemo(() => {
    const known = new Map(subjects.map((s: any) => [s.key, s]));
    const keys = new Set([...subjects.map((s: any) => s.key), ...Object.keys(totals.today)]);
    return Array.from(keys).map((key) => known.get(key) || { key, label: key });
  }, [subjects, totals.today]);

  const formatHrs = (mins: number) => {
    if (mins === 0) return '0m';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <Card>
      <EditableSectionHeading
        id="clk_subjecthours"
        defaultTitle="Subject Hours"
        defaultIcon={BarChart3}
        subtitle={todayTotal > 0 ? `${formatHrs(todayTotal)} logged today across your Focus Gates — resets at midnight` : 'Complete a tagged Focus Gate to start building today\'s hours'}
      />
      {todayTotal === 0 ? (
        <p className="text-[13px] text-neutral-500 mt-4">
          No Pomodoro sessions logged today yet. Tag a subject above and clear a Focus Gate — today's hours per subject will build up here automatically.
        </p>
      ) : (
        <div className="space-y-3 mt-4">
          {displaySubjects.map((s: any) => {
            const style = getSubjectStyle(s.key, subjects);
            const todayMin = totals.today[s.key] || 0;
            const pct = (todayMin / maxSubjectMinutes) * 100;
            return (
              <div key={s.key}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[12px] font-semibold ${style.text}`}>{s.label}</span>
                  <span className="text-[11.5px] text-neutral-400 tabular-nums">{formatHrs(todayMin)} today</span>
                </div>
                <div className="h-2 w-full rounded-full bg-neutral-900 overflow-hidden">
                  <div className={`h-full rounded-full ${style.dot}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

export function AshClockTab() {
  const { subjects } = React.useContext(ConfigContext);
  const [mode, setMode] = useState<'clock' | 'pomodoro'>('clock');

  const [pomodoroLog, setPomodoroLog] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('pomodoro_subject_log');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('pomodoro_subject_log', JSON.stringify(pomodoroLog));
    } catch {
      /* storage unavailable — fail silently, nothing to do here */
    }
  }, [pomodoroLog]);

  const handleSessionComplete = (subject: string, minutes: number) => {
    setPomodoroLog((prev) => [...prev, { id: `pom_${Date.now()}`, date: getLocalDateString(), subject, minutes }]);
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="relative overflow-hidden border border-purple-900/30 bg-gradient-to-br from-[#1a0f2e] via-neutral-950 to-[#150a26] rounded-2xl p-4 sm:p-6 shadow-xl">
        <div className="absolute -top-32 -left-20 w-72 h-72 rounded-full bg-purple-600/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-20 w-72 h-72 rounded-full bg-fuchsia-600/10 blur-3xl pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl shadow-lg shadow-purple-500/20" style={liquidFillStyle()}>
              <Timer className="h-5.5 w-5.5 text-neutral-50" strokeWidth={2} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-neutral-100 leading-tight">Clock</h3>
              <p className="text-[12px] text-purple-300/60 mt-0.5 italic">"Even the Shadow Monarch answers to time."</p>
            </div>
          </div>

          <div className="flex items-center gap-1 rounded-full border border-purple-800/40 bg-purple-950/30 p-1 w-full sm:w-auto overflow-x-auto no-scrollbar">
            <RippleButton
              onClick={() => setMode('clock')}
              className={`cursor-target shrink-0 rounded-full px-3 sm:px-4 py-1.5 text-[10.5px] sm:text-[11.5px] font-bold tracking-wide transition-all ${
                mode === 'clock' ? 'bg-purple-500 text-neutral-950 shadow' : 'text-purple-300/70 hover:text-purple-100'
              }`}
            >
              CLOCK
            </RippleButton>
            <RippleButton
              onClick={() => setMode('pomodoro')}
              className={`cursor-target shrink-0 rounded-full px-3 sm:px-4 py-1.5 text-[10.5px] sm:text-[11.5px] font-bold tracking-wide transition-all ${
                mode === 'pomodoro' ? 'bg-purple-500 text-neutral-950 shadow' : 'text-purple-300/70 hover:text-purple-100'
              }`}
            >
              POMODORO
            </RippleButton>
          </div>
        </div>

        <div className="relative">
          {mode === 'clock' ? (
            <LiveClockView />
          ) : (
            <PomodoroView onSessionComplete={handleSessionComplete} />
          )}
        </div>
      </div>

      {mode === 'pomodoro' && <PomodoroSubjectStats log={pomodoroLog} subjects={subjects} />}
    </div>
  );
}