// Shared, presentation-only UI primitives used across almost every tab and
// card in the app: ripple-click buttons/cards, section headings, stat
// pills, the magnetic cursor, the global detail modal, quest-clear toast,
// streak flame, and the mobile status strip. Pulled out of App.tsx since
// these have no dependency on any single tab — everything else imports
// from here.
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Target, Flame, AlertTriangle, ChevronRight, X, FlameKindling, Swords,
  Loader2,
} from 'lucide-react';
import { ConfigContext, HunterRank } from '../../lib/appConfig';

export function useRipple() {
  const [ripples, setRipples] = useState([]);

  const spawnRipple = (e, el) => {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const point = e.touches && e.touches[0] ? e.touches[0] : e;
    const x = point.clientX - rect.left;
    const y = point.clientY - rect.top;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setRipples((prev) => [...prev, { id, x, y }]);
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, 650);
  };

  const rippleNodes = ripples.map((r) => (
    <span
      key={r.id}
      className="pointer-events-none absolute h-2 w-2 rounded-full bg-white/25 animate-ripple"
      style={{ left: r.x, top: r.y }}
    />
  ));

  return [spawnRipple, rippleNodes];
}

export function MagneticCursor() {
  const dotRef = useRef(null);
  const ringRef = useRef(null);
  const target = useRef({ x: 0, y: 0 });
  const pos = useRef({ x: 0, y: 0 });
  const [active, setActive] = useState(false);
  const [hovering, setHovering] = useState(false);

  useEffect(() => {
    const isFine = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
    const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!isFine || reducedMotion) return;
    setActive(true);

    const handleMove = (e) => {
      target.current.x = e.clientX;
      target.current.y = e.clientY;
    };
    const handleOver = (e) => {
      if (e.target.closest && e.target.closest('.cursor-target')) setHovering(true);
    };
    const handleOut = (e) => {
      if (e.target.closest && e.target.closest('.cursor-target')) setHovering(false);
    };

    window.addEventListener('mousemove', handleMove, { passive: true });
    document.addEventListener('mouseover', handleOver);
    document.addEventListener('mouseout', handleOut);

    let raf;
    const loop = () => {
      pos.current.x += (target.current.x - pos.current.x) * 0.18;
      pos.current.y += (target.current.y - pos.current.y) * 0.18;
      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${target.current.x}px, ${target.current.y}px, 0) translate(-50%, -50%)`;
      }
      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${pos.current.x}px, ${pos.current.y}px, 0) translate(-50%, -50%)`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseover', handleOver);
      document.removeEventListener('mouseout', handleOut);
      cancelAnimationFrame(raf);
    };
  }, []);

  if (!active) return null;

  return (
    <>
      <div ref={dotRef} className="pointer-events-none fixed left-0 top-0 z-[9999] h-1.5 w-1.5 rounded-full bg-neutral-50" style={{ willChange: 'transform' }} />
      <div
        ref={ringRef}
        className={`pointer-events-none fixed left-0 top-0 z-[9999] rounded-full border bg-transparent mix-blend-difference transition-[width,height,border-color,border-width] duration-200 ease-out ${
          hovering ? 'h-11 w-11 border-2 border-neutral-50' : 'h-8 w-8 border border-neutral-300/70'
        }`}
        style={{ willChange: 'transform' }}
      />
    </>
  );
}

// ---------- Interactive Modular Overlay Engine ----------

// Shape of the data any tab can hand to setModal() to open the shared
// GlobalDetailModal. Every field is optional since different callers only
// fill in the sections relevant to them (e.g. a syllabus topic shows
// textBody + focusPoints + cues, an exercise guide shows arrayItems).
export interface ModalData {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  loading?: boolean;
  textBody?: string;
  arrayItems?: string[];
  arrayTitle?: string;
  focusPoints?: string[];
  cues?: string;
}

export function GlobalDetailModal({ modalData, onClose }: { modalData: ModalData | null; onClose: () => void }) {
  if (!modalData) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-lg overflow-hidden border border-neutral-800 bg-neutral-900 rounded-2xl shadow-2xl animate-modalPop">
        <div className="flex items-center justify-between border-b border-neutral-800 p-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-300">
              {modalData.icon ? <modalData.icon className="h-4 w-4" /> : <FlameKindling className="h-4 w-4 text-indigo-400" />}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-100">{modalData.title}</h3>
              <p className="text-xs text-neutral-500">{modalData.subtitle || 'System Deep-Dive Data'}</p>
            </div>
          </div>
          <button onClick={onClose} className="cursor-target p-1.5 rounded-lg text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 transition-all duration-150 active:scale-90">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 max-h-[70vh] overflow-y-auto space-y-4">
          {modalData.loading && (
            <div className="flex items-center gap-2.5 text-sm text-neutral-500 py-6 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading details…
            </div>
          )}

          {modalData.textBody && (
            <p className="text-sm text-neutral-400 leading-relaxed bg-neutral-950/40 border border-neutral-800/60 p-3 rounded-xl">{modalData.textBody}</p>
          )}

          {modalData.arrayItems && (
            <div>
              <div className="text-[11px] uppercase tracking-wider text-neutral-500 font-bold mb-2">{modalData.arrayTitle || 'Target Items'}</div>
              <ul className="space-y-2">
                {modalData.arrayItems.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-neutral-300 bg-neutral-950/30 px-3 py-2 rounded-lg border border-neutral-800/40">
                    <span className="text-xs text-neutral-600 mt-0.5 font-mono">[{idx + 1}]</span>
                    <span className="leading-snug">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {modalData.focusPoints && (
            <div>
              <div className="text-[11px] uppercase tracking-wider text-neutral-500 font-bold mb-2">High-Yield Exam Focus Areas</div>
              <ul className="space-y-2">
                {modalData.focusPoints.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-neutral-300 bg-indigo-500/[0.03] border border-indigo-500/20 px-3 py-2 rounded-lg">
                    <ChevronRight className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {modalData.cues && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-3">
              <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs uppercase tracking-wide mb-1">
                <AlertTriangle className="h-3.5 w-3.5" /> Critical Technique Cue
              </div>
              <p className="text-xs text-amber-200/80 leading-relaxed">{modalData.cues}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- "System" Quest-Clear Notification ----------
// A small Solo Leveling homage: the moment the Daily Matrix hits 100%,
// the game's iconic glowing blue system window drops in to acknowledge it.
// Fires once per day, and calls out a Hunter Rank-up when the lifetime
// streak of fully-cleared days crosses a new threshold.

export function TypewriterText({ text }: { text: string }) {
  const [shown, setShown] = useState('');
  useEffect(() => {
    setShown('');
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, 26);
    return () => clearInterval(id);
  }, [text]);

  return (
    <span>
      {shown}
      <span className="inline-block w-[2px] h-[0.95em] bg-indigo-300/80 ml-0.5 align-middle animate-questCursorBlink" />
    </span>
  );
}

export interface QuestClearData {
  rank: HunterRank;
  isNewRank: boolean;
}

export function QuestClearNotification({ data, onDismiss }: { data: QuestClearData | null; onDismiss: () => void }) {
  const { trackerItems } = React.useContext(ConfigContext);
  const [phase, setPhase] = useState('in'); // 'in' | 'out'
  const sparkles = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        id: i,
        left: 6 + Math.random() * 88,
        delay: Math.random() * 1.3,
        duration: 1.8 + Math.random() * 1.6,
        size: 2 + Math.random() * 3,
      })),
    [data]
  );

  useEffect(() => {
    if (!data) return;
    setPhase('in');
    const outTimer = setTimeout(() => setPhase('out'), 4300);
    const closeTimer = setTimeout(() => onDismiss(), 4800);
    return () => {
      clearTimeout(outTimer);
      clearTimeout(closeTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (!data) return null;

  return (
    <div
      className={`fixed inset-0 z-[70] flex items-start justify-center pt-24 sm:pt-28 px-4 pointer-events-none ${
        phase === 'out' ? 'animate-questOut' : 'animate-questIn'
      }`}
    >
      <div className="relative w-full max-w-md pointer-events-auto">
        <div className="absolute -inset-6 bg-indigo-500/20 blur-3xl rounded-3xl animate-pulseGlow" />

        <div className="absolute inset-0 overflow-hidden rounded-2xl">
          {sparkles.map((s) => (
            <span
              key={s.id}
              className="absolute bottom-0 rounded-full bg-indigo-300 animate-questSparkle"
              style={{
                left: `${s.left}%`,
                width: s.size,
                height: s.size,
                animationDelay: `${s.delay}s`,
                animationDuration: `${s.duration}s`,
              }}
            />
          ))}
        </div>

        <div className="relative rounded-2xl border border-indigo-400/40 bg-gradient-to-b from-[#0d0a1f]/95 to-[#08061a]/95 backdrop-blur-xl shadow-[0_0_50px_-8px_rgba(129,140,248,0.45)] overflow-hidden">
          <span className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-indigo-300/80" />
          <span className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-indigo-300/80" />
          <span className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-indigo-300/80" />
          <span className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-indigo-300/80" />

          <div className="absolute inset-0 animate-questSweep bg-gradient-to-r from-transparent via-indigo-300/10 to-transparent" />

          <div className="relative px-6 py-6 text-center">
            <p className="text-[10px] tracking-[0.4em] uppercase text-indigo-400/70 font-semibold mb-2">— System —</p>
            <h3 className="text-lg font-bold text-indigo-50 tracking-wide mb-1 min-h-[1.5em]">
              <TypewriterText text="Daily Quest Cleared!" />
            </h3>
            <p className="text-[12px] text-indigo-200/60 mb-4">All {trackerItems.length} objectives completed for today.</p>

            {data.isNewRank && (
              <div className="mb-4 animate-fadeInUp" style={{ animationDelay: '1.3s' }}>
                <div className="text-[10px] uppercase tracking-[0.3em] text-amber-300/70 font-semibold mb-1">Rank Up</div>
                <div className="text-2xl font-black tracking-tight" style={{ color: data.rank.color }}>
                  {data.rank.label}
                </div>
              </div>
            )}

            <div className="flex items-center justify-center gap-2 text-[11px] text-indigo-300/50">
              <span className="h-1 w-1 rounded-full bg-indigo-400 animate-dotBreathe" />
              Return to the grind, Hunter.
              <span className="h-1 w-1 rounded-full bg-indigo-400 animate-dotBreathe" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Streak Flame ----------
// A small "on fire" indicator for consecutive fully-cleared days — grows from
// a single spark to a full blaze as the streak climbs, with drifting embers
// and a flickering core. Purely decorative, purely earned.

export function StreakFlame({ streak }: { streak: number }) {
  const tier = streak >= 30 ? 'inferno' : streak >= 14 ? 'blaze' : streak >= 5 ? 'ember' : 'spark';

  const emberCount = tier === 'inferno' ? 7 : tier === 'blaze' ? 5 : tier === 'ember' ? 3 : 2;
  const embers = useMemo(
    () =>
      Array.from({ length: emberCount }, (_, i) => ({
        id: i,
        left: 20 + Math.random() * 60,
        delay: Math.random() * 1.6,
        duration: 1.3 + Math.random() * 1.1,
        size: 1.5 + Math.random() * 2,
      })),
    [emberCount, streak]
  );

  const coreColor = tier === 'inferno' ? '#fef9c3' : tier === 'blaze' ? '#fb923c' : tier === 'ember' ? '#f97316' : '#f59e0b';
  const glowColor = tier === 'inferno' ? 'bg-yellow-300/50' : tier === 'blaze' ? 'bg-orange-500/40' : 'bg-orange-500/30';

  if (streak <= 0) return null;

  return (
    <div className="hidden lg:flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/[0.06] px-3.5 py-1.5">
      <div className="relative w-4 h-4 flex items-center justify-center overflow-visible">
        <span className={`absolute inset-0 rounded-full blur-md animate-flameGlow ${glowColor}`} />
        {embers.map((e) => (
          <span
            key={e.id}
            className="absolute bottom-0 rounded-full animate-emberRise"
            style={{
              left: `${e.left}%`,
              width: e.size,
              height: e.size,
              background: 'radial-gradient(circle, #fef3c7, #f97316)',
              animationDelay: `${e.delay}s`,
              animationDuration: `${e.duration}s`,
            }}
          />
        ))}
        <Flame
          className="relative h-3.5 w-3.5 animate-flameFlicker"
          style={{ color: coreColor }}
          strokeWidth={2.2}
          fill={coreColor}
          fillOpacity={0.28}
        />
      </div>
      <span className="text-[11.5px] font-semibold tabular-nums" style={{ color: coreColor }}>
        {streak}-Day Streak
      </span>
    </div>
  );
}

// Compact, icon-only versions of the streak / hunter rank / execution quotient
// badges for narrow phone widths where there isn't room for the full pills.
// Tapping one expands it horizontally to reveal its label; tapping any other
// badge (or anywhere outside the strip) collapses it again, and only one can
// be expanded at a time.
export function MobileStatusStrip({ streak, hunterRank, overallPct }: { streak: number; hunterRank: HunterRank; overallPct: number }) {
  const [expanded, setExpanded] = useState<null | 'streak' | 'rank' | 'eq'>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!expanded) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setExpanded(null);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [expanded]);

  const toggle = (key: 'streak' | 'rank' | 'eq') => {
    setExpanded((prev) => (prev === key ? null : key));
  };

  return (
    <div ref={containerRef} className="flex items-center gap-1.5 lg:hidden">
      {streak > 0 && (
        <button
          onClick={() => toggle('streak')}
          aria-label={`${streak}-day streak`}
          className={`flex h-8 shrink-0 items-center overflow-hidden rounded-full border border-orange-500/30 bg-orange-500/[0.08] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            expanded === 'streak' ? 'max-w-[140px] px-3' : 'w-8 max-w-[32px] justify-center px-0'
          }`}
        >
          <Flame className="h-3.5 w-3.5 shrink-0 text-orange-400" strokeWidth={2.2} fill="#f97316" fillOpacity={0.28} />
          <span
            className={`whitespace-nowrap text-[11px] font-semibold text-orange-300 tabular-nums overflow-hidden transition-all duration-200 ${
              expanded === 'streak' ? 'max-w-[110px] opacity-100 ml-1.5' : 'max-w-0 opacity-0 ml-0'
            }`}
          >
            {streak}-Day Streak
          </span>
        </button>
      )}

      <button
        onClick={() => toggle('rank')}
        aria-label={hunterRank.label}
        className={`flex h-8 shrink-0 items-center overflow-hidden rounded-full border transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          expanded === 'rank' ? 'max-w-[160px] px-3' : 'w-8 max-w-[32px] justify-center px-0'
        }`}
        style={{ borderColor: `${hunterRank.color}40`, backgroundColor: `${hunterRank.color}0d` }}
      >
        <Swords className="h-3.5 w-3.5 shrink-0" style={{ color: hunterRank.color }} />
        <span
          className={`whitespace-nowrap text-[11px] font-medium overflow-hidden transition-all duration-200 ${
            expanded === 'rank' ? 'max-w-[130px] opacity-100 ml-1.5' : 'max-w-0 opacity-0 ml-0'
          }`}
          style={{ color: hunterRank.color }}
        >
          {hunterRank.label}
        </span>
      </button>

      <button
        onClick={() => toggle('eq')}
        aria-label={`Execution Quotient ${overallPct}%`}
        className={`flex h-8 shrink-0 items-center overflow-hidden rounded-full border border-neutral-800 bg-neutral-900/60 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          expanded === 'eq' ? 'max-w-[170px] px-3' : 'w-8 max-w-[32px] justify-center px-0'
        }`}
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400 animate-pulse" />
        <span
          className={`whitespace-nowrap text-[11px] font-medium text-neutral-400 overflow-hidden transition-all duration-200 ${
            expanded === 'eq' ? 'max-w-[140px] opacity-100 ml-1.5' : 'max-w-0 opacity-0 ml-0'
          }`}
        >
          EQ: <span className="text-violet-400 tabular-nums">{overallPct}%</span>
        </span>
      </button>
    </div>
  );
}

// ---------- Standardized Scannable Structural UI Elements ----------

export function SectionHeading({ icon: Icon, title, subtitle }: { icon: React.ComponentType<{ className?: string }>; title: string; subtitle?: string }) {
  // `subtitle` is intentionally no longer rendered — every card used to
  // carry a small descriptive line under its title ("Core identity &
  // academic baseline", "V-Taper matrix ratios", etc.) that added visual
  // noise without adding information the icon + title didn't already
  // convey. The prop is kept (rather than stripped from every call site)
  // so nothing upstream needs to change — it's just quietly unused here.
  // With the second line gone, the icon badge no longer needs the old
  // items-start + mt-0.5 nudge to line up with where the title used to
  // sit above the subtitle — it centers naturally against the single line.
  void subtitle;
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-800/80 border border-neutral-700/60">
        <Icon className="h-4.5 w-4.5 text-neutral-300" strokeWidth={1.75} />
      </div>
      <h2 className="text-[15px] font-semibold tracking-tight text-neutral-100">{title}</h2>
    </div>
  );
}

export function Card({ children, className = '', onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  const ref = useRef(null);
  const fineRef = useRef(typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: fine)').matches);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const [spot, setSpot] = useState({ x: 50, y: 50 });
  const [hovering, setHovering] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [spawnRipple, rippleNodes] = useRipple();

  const handleMove = (e) => {
    if (!fineRef.current || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    setTilt({ rx: (0.5 - py) * 7, ry: (px - 0.5) * 7 });
    setSpot({ x: px * 100, y: py * 100 });
    setHovering(true);
  };

  const handleLeave = () => {
    setHovering(false);
    setPressed(false);
    setTilt({ rx: 0, ry: 0 });
  };

  const handleDown = (e) => {
    setPressed(true);
    if (onClick) spawnRipple(e, ref.current);
  };

  const handleUp = () => setPressed(false);

  return (
    <div
      ref={ref}
      onClick={onClick}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      onMouseDown={handleDown}
      onMouseUp={handleUp}
      onTouchStart={handleDown}
      onTouchEnd={handleUp}
      className={`cursor-target relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/60 backdrop-blur-sm p-5 will-change-transform ${
        onClick ? 'cursor-pointer hover:border-neutral-700' : ''
      } ${className}`}
      style={{
        transform: `perspective(900px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) scale(${pressed ? 0.975 : 1})`,
        transition: hovering ? 'transform 100ms linear' : 'transform 500ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {hovering && (
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-300"
          style={{ background: `radial-gradient(420px circle at ${spot.x}% ${spot.y}%, rgba(255,255,255,0.06), transparent 65%)` }}
        />
      )}
      {onClick && rippleNodes}
      <div className="relative">{children}</div>
    </div>
  );
}

export function StatPill({ icon: Icon, label, value, accent = 'neutral' }: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode; accent?: 'neutral' | 'blue' | 'amber' | 'violet' | 'rose' }) {
  const accents = {
    neutral: 'text-neutral-300',
    blue: 'text-indigo-400',
    amber: 'text-amber-400',
    violet: 'text-violet-400',
    rose: 'text-rose-400'
  };
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-neutral-800 bg-neutral-950/60 px-3.5 py-2.5">
      <Icon className={`h-4 w-4 shrink-0 ${accents[accent]}`} strokeWidth={1.75} />
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-neutral-500 leading-none mb-1">{label}</div>
        <div className="text-[13px] font-medium text-neutral-200 leading-none truncate">{value}</div>
      </div>
    </div>
  );
}

// ---------- Dynamic Engine: Countdown Matrix Widget ----------

// Was hardcoded to two fixed JEE-specific dates ('2026-11-01' mocks,
// '2027-01-22' JEE Main) shown to every account regardless of their actual
// goal, then briefly tied to `profile.targetDate`. Now fully standalone —
// driven by its own `countdown` config section (Settings > Countdown),
// deliberately independent of `profile.targets` so someone can track a date
// that isn't one of their formal priority targets. Ticks live: shows
// "DD:HH:MM" while more than a day remains, and switches to a live
// second-by-second "HH:MM:SS" once under 24 hours remain.
// Renders every countdown the user has set up in Settings > Countdown.
// A single shared 1s ticker drives all of them (one interval, not N) —
// each countdown is rendered by CountdownEntry below, all inside one shared
// card, sorted so the countdown ending soonest is always first. Zero
// configured countdowns falls back to a single prompt card.
export function RippleButton({
  children, onClick, className = '', disabled = false, title, style,
}: { children: React.ReactNode; onClick?: () => void; className?: string; disabled?: boolean; title?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [spawnRipple, rippleNodes] = useRipple();

  const handleDown = (e: any) => {
    if (disabled) return;
    spawnRipple(e, ref.current);
  };

  return (
    <button
      ref={ref}
      onClick={disabled ? undefined : onClick}
      onMouseDown={handleDown}
      onTouchStart={handleDown}
      disabled={disabled}
      title={title}
      className={`relative overflow-hidden ${className}`}
      style={style}
    >
      {children}
      {rippleNodes}
    </button>
  );
}

// Single digit that fades + slides out one direction and fades + slides in
// from the opposite side — upward when the value the digit belongs to is
// increasing (the live clock), downward when it's decreasing (the pomodoro
// countdown). This replaces the earlier 3D flip mechanic with something
// quieter and closer to an odometer roll.
