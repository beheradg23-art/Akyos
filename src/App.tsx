// ---------------------------------------------------------------------------
// Root dashboard component. This file used to be the entire app (~6,700
// lines) — types, config, every tab, every settings editor, and all shared
// UI primitives lived here in one file. It's been split into:
//   src/lib/          — appConfig (types/defaults/ConfigContext/pure calc
//                        functions, unit-tested), staticContent, liquidFill
//   src/components/ui/       — shared primitives (Card, RippleButton, etc.)
//   src/components/shared/   — small shared widgets (CountdownMatrix,
//                               DailyTracker, WeightTracker, IntroLoader...)
//   src/components/tabs/     — one file per main tab
//   src/components/settings/ — the Settings tab's config editors
//   src/components/account/  — the Account tab
// This file is now just the shell: auth/onboarding gating, top-level state,
// the sidebar/nav, and wiring the tabs together.
// ---------------------------------------------------------------------------
import React, { useState, useEffect, useRef, useMemo, Suspense, lazy } from 'react';
import {
  ChevronRight, X, ChevronLeft, Swords, Settings, UserCircle2,
} from 'lucide-react';
import { AkyosMark } from './components/shared/AkyosMark';
// AuthGate stays a static import: it's the very first thing every visitor
// sees, so there's nothing to gain from splitting it into its own chunk —
// it would just add a network round trip before the app can render at all.
import AuthGate from './components/AuthGate';
import { ParentalConsentDecisionPage } from './components/ParentalConsentDecisionPage';
import { useCloudAutoSync } from './lib/cloudSync';
import { Toaster } from './lib/toast';
import ErrorBoundary from './components/ErrorBoundary';
import { NO_SELECT_CSS } from './styles/noSelect';
import {
  MorphingPopover,
  MorphingPopoverTrigger,
  MorphingPopoverContent,
  useMorphingPopover,
} from './components/ui/MorphingPopover';
import {
  TabLabelKey, DEFAULT_PROFILE, DEFAULT_COUNTDOWNS, DEFAULT_TRAINING,
  DEFAULT_SUBJECTS, DEFAULT_SYLLABUS, DEFAULT_TRACKER_ITEMS, DEFAULT_TAB_LABELS,
  DEFAULT_TAB_ICONS, DEFAULT_SECTION_LABELS, DEFAULT_DIET_OVERRIDES,
  DEFAULT_OVERVIEW_OVERRIDES, DEFAULT_TIMELINE_STORABLE, DEFAULT_DIET_STORABLE,
  DEFAULT_DOMAINS,
  ConfigContext, hydrateTimeline, hydrateDiet, serializeConfig, deserializeConfig,
  getHunterRank, computeCurrentStreak, getLocalDateString, DailyCheckLog,
  CONFIG_STORAGE_KEY, TABS, HUNTER_RANKS, ICON_OPTIONS,
} from './lib/appConfig';
import { resolveTabKeysForDomains, type GoalDomain } from './lib/questionnaire';
import { liquidFillStyle, LIQUID_GRADIENT_KEYFRAMES, SWEEP_REVEAL_KEYFRAMES, SWEEP_REVEAL_STYLE, useSweepReveal } from './lib/liquidFill';
import {
  useRipple, MagneticCursor, GlobalDetailModal, QuestClearNotification,
  StreakFlame, MobileStatusStrip,
} from './components/ui/Primitives';
import { DailyTracker } from './components/shared/DailyTracker';
import { IntroLoader } from './components/shared/IntroLoader';

// Everything below is only needed after sign-in (and most of it only once
// the user picks a specific tab), so it's split into its own chunk and
// fetched on demand instead of bloating the initial bundle. Named exports
// need the `.then(m => ({ default: m.X }))` wrapper since React.lazy only
// accepts modules with a default export.
const OnboardingWizard = lazy(() => import('./components/OnboardingWizard'));
const AccountPage = lazy(() =>
  import('./components/account/AccountPage').then((m) => ({ default: m.AccountPage }))
);
const PerformanceCalendar = lazy(() =>
  import('./components/account/AccountPage').then((m) => ({ default: m.PerformanceCalendar }))
);
const OverviewTab = lazy(() =>
  import('./components/tabs/OverviewTab').then((m) => ({ default: m.OverviewTab }))
);
const TimelineTab = lazy(() =>
  import('./components/tabs/TimelineTab').then((m) => ({ default: m.TimelineTab }))
);
const TrainingFuelTab = lazy(() =>
  import('./components/tabs/TrainingFuelTab').then((m) => ({ default: m.TrainingFuelTab }))
);
const SyllabusTab = lazy(() =>
  import('./components/tabs/SyllabusTab').then((m) => ({ default: m.SyllabusTab }))
);
const MockTestTab = lazy(() =>
  import('./components/tabs/MockTestTab').then((m) => ({ default: m.MockTestTab }))
);
const AshClockTab = lazy(() =>
  import('./components/tabs/AshClockTab').then((m) => ({ default: m.AshClockTab }))
);
const TodoTab = lazy(() =>
  import('./components/tabs/TodoTab').then((m) => ({ default: m.TodoTab }))
);
const ConfigEditorTab = lazy(() =>
  import('./components/settings/ConfigEditors').then((m) => ({ default: m.ConfigEditorTab }))
);

// Every account gets asked this exactly once, right after their first
// passcode is set up (see OnboardingWizard.tsx). Synced via cloudSync's
// SYNC_KEYS so finishing it on one device doesn't re-trigger it on another.
const ONBOARDING_STORAGE_KEY = 'akyos_onboarding_completed_v1';

// One shared timing for every piece of the hover-expand sidebar (rail
// width, mobile slide-in transform, brand-title reveal, every nav label
// reveal). Previously the rail animated on its own 300ms custom curve
// while labels used Tailwind's default 200ms ease — two different clocks
// finishing at different moments read as a jump/pop rather than one
// continuous slide. `transition-all` is safe to use uniformly here since
// nothing non-animatable (justify-content, padding, margin-auto) toggles
// on these elements anymore — only width/max-width/opacity/transform do,
// all of which interpolate smoothly.
const SIDEBAR_TRANSITION = 'transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]';

// Shown briefly while a lazy-loaded tab/onboarding chunk is fetched. Chunks
// are small and typically cached after first visit, so this is rarely on
// screen for more than a frame or two — kept intentionally minimal rather
// than a full skeleton.
function TabLoadingFallback() {
  return (
    <div className="flex h-full min-h-[40vh] w-full items-center justify-center">
      <span className="h-2 w-2 rounded-full bg-violet-400 animate-pulse" />
    </div>
  );
}

const SUPPORT_VARIANTS = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.9 },
};

// Circle-to-box morph: the trigger button and the content panel share one
// Motion layoutId (see MorphingPopover.tsx), so clicking doesn't just fade
// a card in near the button — the circle itself reshapes and grows into
// the panel. The "/" -> "/support" pill is a separate, purely-CSS hover
// effect on the trigger (an inner span growing from max-width 0), so it
// keeps working even while closed/idle, independent of the open/close morph.
function SupportLinks() {
  const { close } = useMorphingPopover();
  const linkClass =
    'cursor-target block rounded-lg px-3 py-2 text-[12px] text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-200';

  return (
    <>
      <a
        href="https://mail.google.com/mail/?view=cm&fs=1&to=kiwieatspumpkin@gmail.com"
        target="_blank"
        rel="noopener noreferrer"
        onClick={close}
        className={linkClass}
      >
        Contact Akyos
      </a>
      <a
        href="https://mail.google.com/mail/?view=cm&fs=1&to=kiwieatspumpkin@gmail.com&su=To%20Report%20a%20Bug"
        target="_blank"
        rel="noopener noreferrer"
        onClick={close}
        className={linkClass}
      >
        Report a Bug
      </a>
      <a
        href="https://www.instagram.com/akyos.app/"
        target="_blank"
        rel="noopener noreferrer"
        onClick={close}
        className={linkClass}
      >
        Akyos Instagram
      </a>
      <div className="my-1.5 h-px bg-neutral-800" />
      <a
        href="https://www.instagram.com/saltlysweet/"
        target="_blank"
        rel="noopener noreferrer"
        onClick={close}
        className="cursor-target block rounded-lg px-3 py-2 text-[11px] text-neutral-500 transition-colors hover:bg-neutral-800 hover:text-neutral-300"
      >
        Built By Ash - With Love and Peace
      </a>
    </>
  );
}

function SupportMenu() {
  return (
    <div className="fixed bottom-5 right-5 z-40">
      <MorphingPopover variants={SUPPORT_VARIANTS} transition={{ type: 'spring', bounce: 0.08, duration: 0.35 }}>
        <MorphingPopoverTrigger asChild>
          <button
            type="button"
            aria-label="Support and links"
            className="group cursor-target relative flex h-10 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900/90 px-[13px] text-neutral-500 shadow-lg shadow-black/30 backdrop-blur-md transition-colors duration-300 hover:border-neutral-700 hover:pr-4 hover:text-neutral-200"
          >
            <span className="text-[15px] font-semibold leading-none">/</span>
            <span className="max-w-0 overflow-hidden whitespace-nowrap text-[12px] font-medium leading-none opacity-0 transition-all duration-300 ease-out group-hover:ml-[3px] group-hover:max-w-[64px] group-hover:opacity-100">
              support
            </span>
          </button>
        </MorphingPopoverTrigger>
        <MorphingPopoverContent className="bottom-full right-0 mb-3 w-56 text-left">
          <SupportLinks />
        </MorphingPopoverContent>
      </MorphingPopover>
    </div>
  );
}

// A link emailed to a parent/guardian (see api/parental-consent.ts) points
// back at the app's own origin with this query param — read once here,
// outside of any hook, since the URL doesn't change without a real
// navigation in this app. Handled as the very first possible render branch
// below (ahead of AuthGate) so it works regardless of whatever session, if
// any, already happens to be sitting in this browser.
const PARENTAL_CONSENT_PARAM = 'parentalConsent';

export default function JEEDashboard() {
  const [unlocked, setUnlocked] = useState(false);
  useCloudAutoSync(unlocked);
  const [introDone, setIntroDone] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(() => {
    try {
      if (localStorage.getItem(ONBOARDING_STORAGE_KEY) === 'true') return true;
      // Backward compatibility: anyone who already has a saved config from
      // before this wizard existed has clearly already set things up their
      // own way — don't interrupt them with onboarding retroactively.
      if (localStorage.getItem(CONFIG_STORAGE_KEY)) {
        localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
        return true;
      }
      return false;
    } catch {
      return false;
    }
  });
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  // Which header badge (rank or EQ) currently has the pointer over it —
  // drives the animated gradient sweep border, same hover-gated overlay
  // <Card> uses in Primitives.tsx, tracked here since these two pills are
  // plain divs, not <Card>s.
  const [hoveredBadge, setHoveredBadge] = useState<null | 'rank' | 'eq'>(null);
  // Two fixed badges (not a list), so calling the hook twice here is
  // always exactly two calls per render — safe under the rules of hooks,
  // unlike the per-row cases (PhasePill/DayPill/TimelineBlock) that had to
  // be split into their own components first.
  const rankSweep = useSweepReveal(hoveredBadge === 'rank');
  const eqSweep = useSweepReveal(hoveredBadge === 'eq');
  const [modal, setModal] = useState(null);

  // ---------- Swipe-to-switch-tabs (Instagram-style) ----------
  // Purely additive: the click-based tab bar above still works exactly as
  // before. This just lets a left/right swipe anywhere on the workspace
  // move to the next/previous tab in `visibleTabs` (Phase 8 — this used to
  // walk the static TABS array; `visibleTabs` is declared further down,
  // right after `config`, but referencing it here is safe: this function
  // is just stored in a closure and never runs until a swipe actually
  // happens post-mount, by which point `visibleTabs` is already assigned).
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const [swipePeek, setSwipePeek] = useState<'left' | 'right' | null>(null);

  const SWIPE_MIN_DISTANCE = 60; // px — how far a swipe must travel to count
  const SWIPE_MAX_OFF_AXIS = 70; // px — how vertical it can drift before we treat it as a scroll instead

  const goToAdjacentTab = (direction: 1 | -1) => {
    const currentIndex = visibleTabs.findIndex((t) => t.id === activeTab);
    if (currentIndex === -1) return;
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= visibleTabs.length) return;
    setActiveTab(visibleTabs[nextIndex].id);
  };

  const handleWorkspaceTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    // Don't hijack gestures meant for form controls, sliders, or the
    // (already horizontally-scrollable) tab bar itself.
    if (target.closest('input, textarea, select, nav, [data-no-swipe]')) {
      swipeStartRef.current = null;
      return;
    }
    const touch = e.touches[0];
    swipeStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleWorkspaceTouchMove = (e: React.TouchEvent) => {
    if (!swipeStartRef.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - swipeStartRef.current.x;
    const dy = touch.clientY - swipeStartRef.current.y;
    if (Math.abs(dx) > 24 && Math.abs(dx) > Math.abs(dy)) {
      setSwipePeek(dx < 0 ? 'left' : 'right');
    } else {
      setSwipePeek(null);
    }
  };

  const handleWorkspaceTouchEnd = (e: React.TouchEvent) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    setSwipePeek(null);
    if (!start) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < SWIPE_MIN_DISTANCE || Math.abs(dy) > SWIPE_MAX_OFF_AXIS) return;
    goToAdjacentTab(dx < 0 ? 1 : -1); // swipe left goes to next tab, swipe right goes to previous tab
  };

  // Editable Config — Daily Checklist / Timeline / Training routine.
  // Everything else in the app reads this through ConfigContext instead of
  // the DEFAULT_* module constants, so edits made in the Settings tab
  // propagate everywhere immediately without a page reload.
  const [config, setConfig] = useState(() => {
    try {
      const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
      return deserializeConfig(saved ? JSON.parse(saved) : null);
    } catch (e) {
      console.error('Error hydrating config from localStorage', e);
      return deserializeConfig(null);
    }
  });

  useEffect(() => {
    // Guard: without this, this effect fires on EVERY mount of JEEDashboard
    // — including while still sitting on the AuthGate or OnboardingWizard
    // screens, since hooks all run regardless of the early `return`s below
    // that gate on `unlocked`/`onboardingDone`. That means a fresh account's
    // still-default `config` got written to `app_config_v1` before
    // onboarding ever ran, and the very next reload (there are several
    // during sign-up) then saw that key already present and concluded
    // "this account already has a saved config" — the backward-compat check
    // just above — silently skipping onboarding for every new account.
    // Only persisting once the person is actually unlocked and past
    // onboarding means `app_config_v1` can never exist before onboarding
    // has genuinely completed.
    if (!unlocked || !onboardingDone) return;
    try {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(serializeConfig(config)));
    } catch (e) {
      console.error('Error persisting config to localStorage', e);
    }
  }, [config, unlocked, onboardingDone]);

  // ---------- Dynamic tab system (Phase 8) ----------
  // `config.domains === null` means "unrestricted" — every account today,
  // plus any legacy/pre-onboarding account and anyone who used "Skip" on
  // the wizard, permanently falls into this branch and sees the exact same
  // full TABS list they always have. `dynamic` tabs are only ever a
  // *narrowing* a real onboarding completion opts an account into (see
  // PHASE_8_HANDOFF.md) — this branch is what guarantees that.
  //
  // Recomputed live off `config.domains` (not frozen once at onboarding
  // time) so that if domains are ever edited post-onboarding in a future
  // phase, the visible tab set updates immediately rather than needing a
  // reload — same "everything reads through ConfigContext so edits
  // propagate immediately" principle this file's own header comment
  // already states for every other config field.
  const visibleTabs = useMemo(() => {
    if (config.domains === null) return TABS;
    const domains = config.domains as GoalDomain[];
    const visibleKeys = new Set(resolveTabKeysForDomains(domains, TABS.map((t) => t.id as TabLabelKey)));
    return TABS.filter((t) => visibleKeys.has(t.id as TabLabelKey));
  }, [config.domains]);

  // If a domain change ever narrows the tab set out from under whatever tab
  // is currently open, fall back to Dashboard Overview rather than showing
  // a blank/hidden tab. 'settings' and 'account' are pinned outside TABS
  // (rendered separately at the bottom of the rail) and are never affected
  // by domain gating, so they're explicitly excluded from this check.
  useEffect(() => {
    if (activeTab === 'settings' || activeTab === 'account') return;
    if (!visibleTabs.some((t) => t.id === activeTab)) {
      setActiveTab('overview');
    }
  }, [visibleTabs, activeTab]);

  const updateConfig = (partial: Record<string, any>) => {
    setConfig((prev) => ({ ...prev, ...partial }));
  };

  const resetConfigSection = (key: 'trackerItems' | 'timeline' | 'training' | 'profile' | 'subjects' | 'syllabus' | 'countdowns' | 'overviewOverrides' | 'diet' | 'dietOverrides' | 'tabLabels' | 'tabIcons' | 'sectionLabels' | 'domains') => {
    setConfig((prev) => ({
      ...prev,
      [key]: key === 'timeline'
        ? hydrateTimeline(DEFAULT_TIMELINE_STORABLE)
        : key === 'training'
        ? DEFAULT_TRAINING
        : key === 'profile'
        ? DEFAULT_PROFILE
        : key === 'subjects'
        ? DEFAULT_SUBJECTS
        : key === 'syllabus'
        ? DEFAULT_SYLLABUS
        : key === 'countdowns'
        ? DEFAULT_COUNTDOWNS
        : key === 'overviewOverrides'
        ? DEFAULT_OVERVIEW_OVERRIDES
        : key === 'diet'
        ? hydrateDiet(DEFAULT_DIET_STORABLE)
        : key === 'dietOverrides'
        ? DEFAULT_DIET_OVERRIDES
        : key === 'tabLabels'
        ? DEFAULT_TAB_LABELS
        : key === 'tabIcons'
        ? DEFAULT_TAB_ICONS
        : key === 'sectionLabels'
        ? DEFAULT_SECTION_LABELS
        : key === 'domains'
        ? DEFAULT_DOMAINS
        : DEFAULT_TRACKER_ITEMS,
    }));
  };

  // Core Data Persistence Engine (Localised ISO keys)
  const [currentDateStr, setCurrentDateStr] = useState(() => getLocalDateString());
  
  const [globalHistory, setGlobalHistory] = useState<DailyCheckLog>(() => {
    try {
      const saved = localStorage.getItem('jee_command_history_v2');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      console.error('Error hydrating localStorage state map', e);
      return {};
    }
  });

  // Automated System Clock Alignment Effect
  useEffect(() => {
    const interval = setInterval(() => {
      const todayStr = getLocalDateString();
      if (todayStr !== currentDateStr) {
        setCurrentDateStr(todayStr);
      }
    }, 30000); // Pulse check every 30 seconds
    return () => clearInterval(interval);
  }, [currentDateStr]);

  // Synchronize dynamic updates directly into hardware memory
  useEffect(() => {
    localStorage.setItem('jee_command_history_v2', JSON.stringify(globalHistory));
  }, [globalHistory]);

  // Per-meal diet check-ins (Fuel Matrix). Lifted up here — rather than kept
  // local to TrainingFuelTab — specifically so the Daily Matrix's "All 6
  // Meals Hit" box can auto-derive from it instead of being tracked twice.
  const [dietLog, setDietLog] = useState<DailyCheckLog>(() => {
    try {
      const saved = localStorage.getItem('diet_log_v1');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('diet_log_v1', JSON.stringify(dietLog));
    } catch {
      /* storage unavailable — fail silently */
    }
  }, [dietLog]);

  const allMealsHitToday = useMemo(() => {
    const todayMeals = dietLog[currentDateStr] || {};
    return config.diet.length > 0 && config.diet.every((m) => todayMeals[m.name]);
  }, [dietLog, currentDateStr, config.diet]);

  // Keep the Daily Matrix's t6 box in lockstep with the Fuel Matrix meal log,
  // rather than letting it drift as an independent manual checkbox.
  useEffect(() => {
    setGlobalHistory((prev) => {
      const day = prev[currentDateStr] || {};
      if (!!day.t6 === allMealsHitToday) return prev;
      return {
        ...prev,
        [currentDateStr]: { ...day, t6: allMealsHitToday },
      };
    });
  }, [allMealsHitToday, currentDateStr]);

  // Read current active item checklist matrix
  const checked = useMemo(() => {
    return globalHistory[currentDateStr] || {};
  }, [globalHistory, currentDateStr]);

  const toggleCheck = (itemId) => {
    setGlobalHistory((prev) => {
      const currentDayMetrics = { ...prev[currentDateStr] };
      currentDayMetrics[itemId] = !currentDayMetrics[itemId];
      return {
        ...prev,
        [currentDateStr]: currentDayMetrics,
      };
    });
  };

  const doneCount = useMemo(() => Object.values(checked).filter(Boolean).length, [checked]);
  const totalCount = config.trackerItems.length;
  const overallPct = Math.round((doneCount / totalCount) * 100);

  // Lifetime count of fully-cleared days across all recorded history — the
  // number that actually drives Hunter Rank, independent of today's progress.
  const clearedDaysCount = useMemo(() => {
    return Object.values(globalHistory).filter((dayObj) =>
      config.trackerItems.every((item) => (dayObj as any)?.[item.id])
    ).length;
  }, [globalHistory, config.trackerItems]);

  const hunterRank = useMemo(() => getHunterRank(clearedDaysCount), [clearedDaysCount]);
  const currentStreak = useMemo(
    () => computeCurrentStreak(globalHistory, currentDateStr, config.trackerItems),
    [globalHistory, currentDateStr, config.trackerItems]
  );

  // Fires the "System" quest-clear notification exactly once, the moment
  // today's Daily Matrix transitions from incomplete to 100%.
  const [questClear, setQuestClear] = useState<{ rank: typeof HUNTER_RANKS[number]; isNewRank: boolean } | null>(null);
  const wasCompleteRef = useRef(overallPct === 100);
  const shownForDateRef = useRef<string | null>(null);

  useEffect(() => {
    const justCompleted = !wasCompleteRef.current && overallPct === 100;
    if (justCompleted && shownForDateRef.current !== currentDateStr) {
      shownForDateRef.current = currentDateStr;
      const priorRank = getHunterRank(Math.max(clearedDaysCount - 1, 0));
      const newRank = getHunterRank(clearedDaysCount);
      setQuestClear({ rank: newRank, isNewRank: newRank.rank !== priorRank.rank });
    }
    wasCompleteRef.current = overallPct === 100;
  }, [overallPct, currentDateStr, clearedDaysCount]);

  const parentalConsentToken = new URLSearchParams(window.location.search).get(PARENTAL_CONSENT_PARAM);
  if (parentalConsentToken) {
    return (
      <ErrorBoundary label="Parental consent">
        <ParentalConsentDecisionPage token={parentalConsentToken} />
      </ErrorBoundary>
    );
  }

  if (!unlocked) {
    return (
      <ErrorBoundary label="Sign in">
        <AuthGate onUnlock={() => setUnlocked(true)} />
      </ErrorBoundary>
    );
  }

  if (!onboardingDone) {
    return (
      <ErrorBoundary label="Onboarding">
        <Suspense fallback={<TabLoadingFallback />}>
          <OnboardingWizard
            onComplete={(generated) => {
              updateConfig(generated);
              try {
                localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
              } catch (e) {
                console.error('[Onboarding] failed to persist completion flag', e);
              }
              setOnboardingDone(true);
            }}
          />
        </Suspense>
      </ErrorBoundary>
    );
  }

  const renderTab = () => {
    switch (activeTab) {
      case 'overview': return <OverviewTab setModal={setModal} />;
      case 'timeline': return <TimelineTab setModal={setModal} />;
      case 'training': return <TrainingFuelTab setModal={setModal} dietLog={dietLog} setDietLog={setDietLog} currentDateStr={currentDateStr} />;
      case 'syllabus': return <SyllabusTab setModal={setModal} />;
      case 'mocktests': return <MockTestTab />;
      case 'ashclock': return <AshClockTab />;
      case 'todo': return <TodoTab />;
      case 'history': return <PerformanceCalendar globalHistory={globalHistory} setGlobalHistory={setGlobalHistory} setModal={setModal} />;
      case 'settings': return <ConfigEditorTab />;
      case 'account': return <AccountPage globalHistory={globalHistory} setGlobalHistory={setGlobalHistory} />;
      default: return null;
    }
  };

  return (
    <ConfigContext.Provider
      value={{
        trackerItems: config.trackerItems,
        timeline: config.timeline,
        training: config.training,
        profile: config.profile,
        subjects: config.subjects,
        syllabus: config.syllabus,
        countdowns: config.countdowns,
        overviewOverrides: config.overviewOverrides,
        diet: config.diet,
        dietOverrides: config.dietOverrides,
        tabLabels: config.tabLabels,
        tabIcons: config.tabIcons,
        sectionLabels: config.sectionLabels,
        domains: config.domains,
        updateConfig,
        resetConfigSection,
      }}
    >
    <div className="min-h-screen w-full bg-zinc-950 text-neutral-200 font-sans antialiased relative lg:flex">
      <style>{NO_SELECT_CSS}</style>
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[32rem] w-[32rem] rounded-full bg-fuchsia-500/10 blur-[120px]" />
        <div className="absolute top-1/3 -right-40 h-[28rem] w-[28rem] rounded-full bg-violet-600/10 blur-[120px]" />
        <div className="absolute bottom-0 left-1/4 h-[24rem] w-[24rem] rounded-full bg-indigo-600/10 blur-[110px]" />
      </div>
      {!introDone && <IntroLoader onFinish={() => setIntroDone(true)} />}

      {/* Sidebar backdrop — mobile/tablet drawer scrim */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-fadeIn lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation — persistent rail on desktop (minimized until hovered), sliding drawer on mobile.
          Every animated piece below (rail width, label reveal, brand-title
          reveal) now shares the exact same duration + easing curve
          (SIDEBAR_TRANSITION). Previously the rail itself animated on a
          300ms custom cubic-bezier while every label used the Tailwind
          default 200ms ease — two clocks racing each other, which is what
          read as a jump/pop rather than one continuous slide. The nav
          buttons also used to swap `justify-center`/`gap-0`/`px-0 py-0`/
          `mx-auto` in and out based on `sidebarExpanded` — none of those
          properties can be smoothly interpolated by CSS, so they snapped
          instantly while the width around them was still easing, adding a
          second, unsynced pop on top. Icons now stay pinned at a constant
          left-aligned position at all times (matching Supabase's own rail)
          and only the label's width/opacity animate — nothing structural
          flips underneath that motion anymore. */}
      <aside
        onMouseEnter={() => setSidebarExpanded(true)}
        onMouseLeave={() => setSidebarExpanded(false)}
        className={`fixed inset-y-0 left-0 z-50 flex w-[240px] shrink-0 flex-col overflow-hidden border-r border-white/[0.08] bg-white/[0.045] backdrop-blur-2xl backdrop-saturate-150 shadow-[8px_0_32px_-12px_rgba(0,0,0,0.55)] ${SIDEBAR_TRANSITION} lg:sticky lg:top-0 lg:z-20 lg:h-screen lg:translate-x-0 lg:bg-white/[0.035] ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } ${sidebarExpanded ? 'lg:w-[240px]' : 'lg:w-[68px]'}`}
      >
        {/* Glass "sheen" — same top-lit diagonal wash + hairline highlight
            treatment as the dashboard's <Card> bento boxes, so the rail
            reads as one continuous frosted-glass surface with the rest of
            the app rather than a flat opaque panel. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.05] via-transparent to-transparent"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-3 right-0 w-px bg-gradient-to-b from-transparent via-white/20 to-transparent"
        />
        <div className="relative flex items-center gap-2.5 px-4 pt-5 pb-4">
          {/* Hover expands the rail on desktop, but a tablet at this same
              width (e.g. iPad landscape) has no mouse to hover with — the
              rail would otherwise be stuck collapsed with no way to reach
              the labels. Making the badge itself tappable (toggling the
              same sidebarExpanded state hover already drives) gives touch
              users an explicit open/close control that works everywhere
              hover doesn't, without changing anything for mouse users. */}
          <button
            type="button"
            onClick={() => setSidebarExpanded((v) => !v)}
            aria-label={sidebarExpanded ? 'Collapse navigation' : 'Expand navigation'}
            aria-expanded={sidebarExpanded}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-md shadow-violet-500/20"
            style={liquidFillStyle()}
          >
            <AkyosMark className="h-4 w-4 text-neutral-950" />
          </button>
          <span className={`text-[13px] font-semibold tracking-tight text-neutral-200 truncate overflow-hidden ${SIDEBAR_TRANSITION} ${sidebarExpanded ? 'lg:max-w-[140px] lg:opacity-100' : 'lg:max-w-0 lg:opacity-0'}`}>Akyos</span>
          <button
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation"
            className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-900 hover:text-neutral-200 transition-colors lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="relative flex-1 overflow-y-auto px-3 pb-4 no-scrollbar" role="tablist" aria-label="Main sections">
          <div className="space-y-1">
            {visibleTabs.map((tab) => {
              const Icon = ICON_OPTIONS[config.tabIcons[tab.id as TabLabelKey]] || tab.icon;
              const isActive = activeTab === tab.id;
              const label = config.tabLabels[tab.id as TabLabelKey] || tab.label;
              return (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setSidebarOpen(false); }}
                  title={label}
                  aria-label={label}
                  role="tab"
                  aria-selected={isActive}
                  aria-current={isActive ? 'page' : undefined}
                  className={`cursor-target group relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors duration-200 active:scale-[0.98] ${
                    isActive
                      ? 'bg-neutral-100 text-neutral-900 shadow-sm'
                      : 'text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-200'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                  <span className={`truncate overflow-hidden ${SIDEBAR_TRANSITION} ${sidebarExpanded ? 'lg:max-w-[160px] lg:opacity-100' : 'lg:max-w-0 lg:opacity-0'}`}>{label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Settings & Account — pinned to the bottom of the rail */}
        <div className="relative mt-auto border-t border-white/[0.08] px-3 py-3 space-y-1">
          <button
            onClick={() => { setActiveTab('settings'); setSidebarOpen(false); }}
            title={config.tabLabels.settings}
            aria-label={config.tabLabels.settings}
            role="tab"
            aria-selected={activeTab === 'settings'}
            aria-current={activeTab === 'settings' ? 'page' : undefined}
            className={`cursor-target flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors duration-200 active:scale-[0.98] ${
              activeTab === 'settings'
                ? 'bg-neutral-100 text-neutral-900 shadow-sm'
                : 'text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-200'
            }`}
          >
            {(() => { const SettingsIcon = ICON_OPTIONS[config.tabIcons.settings] || Settings; return <SettingsIcon className="h-4 w-4 shrink-0" strokeWidth={1.75} />; })()}
            <span className={`truncate overflow-hidden ${SIDEBAR_TRANSITION} ${sidebarExpanded ? 'lg:max-w-[160px] lg:opacity-100' : 'lg:max-w-0 lg:opacity-0'}`}>{config.tabLabels.settings}</span>
          </button>
          <button
            onClick={() => { setActiveTab('account'); setSidebarOpen(false); }}
            title={config.tabLabels.account}
            aria-label={config.tabLabels.account}
            role="tab"
            aria-selected={activeTab === 'account'}
            aria-current={activeTab === 'account' ? 'page' : undefined}
            className={`cursor-target flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors duration-200 active:scale-[0.98] ${
              activeTab === 'account'
                ? 'bg-neutral-100 text-neutral-900 shadow-sm'
                : 'text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-200'
            }`}
          >
            {(() => { const AccountIcon = ICON_OPTIONS[config.tabIcons.account] || UserCircle2; return <AccountIcon className="h-4 w-4 shrink-0" strokeWidth={1.75} />; })()}
            <span className={`truncate overflow-hidden ${SIDEBAR_TRANSITION} ${sidebarExpanded ? 'lg:max-w-[160px] lg:opacity-100' : 'lg:max-w-0 lg:opacity-0'}`}>{config.tabLabels.account}</span>
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="relative z-10 flex-1 min-w-0">

        {/* Sticky header — brand, streak, rank, and EQ stay pinned while the page scrolls beneath */}
        <header
          onMouseEnter={() => setSidebarExpanded(false)}
          className="sticky top-0 z-30 flex flex-row items-center justify-between gap-3 overflow-hidden border-b border-white/[0.08] bg-white/[0.045] backdrop-blur-2xl backdrop-saturate-150 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.55)] px-4 sm:px-6 lg:px-8 py-3.5"
        >
          {/* Glass "sheen" — same treatment as <Card> and the sidebar rail,
              so the header reads as one continuous frosted-glass surface
              rather than a flat tinted bar. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.05] via-transparent to-transparent"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-5 bottom-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
          />
          <div className="relative flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-lg shadow-violet-500/20 transition-transform active:scale-95 lg:pointer-events-none lg:cursor-default"
              style={liquidFillStyle()}
            >
              {/* Mark sized at the same ratio to its blob as the sidebar's
                  h-4/h-8 (0.5) mark-to-badge ratio, so the two brand chips
                  read as consistent scale rather than the mark looking
                  shrunken in the bigger 44px header badge. */}
              <AkyosMark className="h-[22px] w-[22px] text-neutral-950" />
            </button>
            <div className="min-w-0">
              <h1 className="text-[17px] font-semibold tracking-tight text-neutral-50 leading-none truncate">Akyos</h1>
              <p className="text-[12.5px] text-neutral-500 mt-1 truncate">Your Answer to Chaos</p>
            </div>
          </div>
          <div className="relative flex items-center gap-2.5 shrink-0">
            <MobileStatusStrip streak={currentStreak} hunterRank={hunterRank} overallPct={overallPct} />
            <StreakFlame streak={currentStreak} />
            <div
              onMouseEnter={() => setHoveredBadge('rank')}
              onMouseLeave={() => setHoveredBadge((cur) => (cur === 'rank' ? null : cur))}
              className="relative hidden lg:flex items-center gap-2 overflow-hidden rounded-full border px-3.5 py-1.5 transition-colors duration-500"
              style={{ borderColor: `${hunterRank.color}40`, backgroundColor: `${hunterRank.color}0d` }}
            >
              {rankSweep.mounted && (
                // Same animated gradient sweep border as the dashboard's
                // <Card> bento boxes / Master Timeline blocks / Syllabus
                // Month pills / day-selector pills: a ring-only cutout
                // filled with the shared moving liquidFillStyle() brand
                // gradient, revealed via the --akyos-sweep mask on hover-in,
                // faded back out (no re-sweep) via useSweepReveal on
                // hover-out.
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-full"
                  style={{ animation: rankSweep.animation, ...SWEEP_REVEAL_STYLE }}
                >
                  <div
                    className="absolute inset-0 rounded-full"
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
              <Swords className="h-3 w-3" style={{ color: hunterRank.color }} />
              <span className="text-[11.5px] font-medium" style={{ color: hunterRank.color }}>
                {hunterRank.label}
              </span>
            </div>
            <div
              onMouseEnter={() => setHoveredBadge('eq')}
              onMouseLeave={() => setHoveredBadge((cur) => (cur === 'eq' ? null : cur))}
              className="relative hidden lg:flex items-center gap-2 overflow-hidden rounded-full border border-neutral-800 bg-neutral-900/60 px-3.5 py-1.5"
            >
              {eqSweep.mounted && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-full"
                  style={{ animation: eqSweep.animation, ...SWEEP_REVEAL_STYLE }}
                >
                  <div
                    className="absolute inset-0 rounded-full"
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
              <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
              <span className="text-[11.5px] font-medium text-neutral-400">Execution Quotient: <span className="text-violet-400 tabular-nums">{overallPct}%</span></span>
            </div>
          </div>
        </header>

        <div className="relative z-10 mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8 py-6">

        {/* Dashboard Grid Workspace Layout — swipe left/right anywhere here to move between tabs */}
        <div
          className={`relative grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 transition-transform duration-150 ease-out touch-pan-y ${
            swipePeek === 'left' ? '-translate-x-2' : swipePeek === 'right' ? 'translate-x-2' : 'translate-x-0'
          }`}
          onTouchStart={handleWorkspaceTouchStart}
          onTouchMove={handleWorkspaceTouchMove}
          onTouchEnd={handleWorkspaceTouchEnd}
          onTouchCancel={handleWorkspaceTouchEnd}
        >
          {/* Faint edge hints that appear mid-swipe, Instagram-style */}
          <div
            className={`pointer-events-none fixed left-2 top-1/2 z-30 -translate-y-1/2 rounded-full bg-neutral-900/80 border border-neutral-700 p-2 transition-opacity duration-150 ${
              swipePeek === 'right' ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <ChevronLeft className="h-4 w-4 text-neutral-300" />
          </div>
          <div
            className={`pointer-events-none fixed right-2 top-1/2 z-30 -translate-y-1/2 rounded-full bg-neutral-900/80 border border-neutral-700 p-2 transition-opacity duration-150 ${
              swipePeek === 'left' ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <ChevronRight className="h-4 w-4 text-neutral-300" />
          </div>

          <main>
            <ErrorBoundary key={activeTab} label={TABS.find((t) => t.id === activeTab)?.label}>
              <Suspense fallback={<TabLoadingFallback />}>{renderTab()}</Suspense>
            </ErrorBoundary>
          </main>
          <aside>
            <DailyTracker currentDayStr={currentDateStr} checked={checked} onToggle={toggleCheck} setActiveTab={setActiveTab} />
          </aside>
        </div>

        <footer className="mt-8 pb-2 text-center">
          <SupportMenu />
        </footer>
        </div>
      </div>

      {/* Global Context-Aware Modal Overlay */}
      <GlobalDetailModal modalData={modal} onClose={() => setModal(null)} />

      {/* "System" Quest-Clear Notification — fires on hitting 100% for the day */}
      <QuestClearNotification data={questClear} onDismiss={() => setQuestClear(null)} />

      {/* Global Fluid Cursor (desktop / fine-pointer only) */}
      <MagneticCursor />

      {/* Embedded Support Custom Styles */}
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

        /* Branded keyboard-focus ring, app-wide. Several inputs already
           swap outline-none for a border-color change on focus (a fine
           substitute), but every button, link, and nav item was falling
           back to the browser's unstyled default outline — inconsistent
           and off-brand. One rule here covers all of them at once. Scoped
           to :focus-visible so mouse/touch clicks stay exactly as before;
           only actual keyboard navigation gets the ring. */
        :focus-visible {
          outline: 2px solid rgba(167, 139, 250, 0.75);
          outline-offset: 2px;
          border-radius: 4px;
        }

        /* Respect the OS-level "reduce motion" preference. Nothing here
           is deleted, just collapsed to near-instant, so people sensitive
           to motion (or vestibular conditions) still get every state
           change, just without the drifting gradients, ripples, tilts,
           and cursor-follow loop. */
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
            scroll-behavior: auto !important;
          }
        }
        ${LIQUID_GRADIENT_KEYFRAMES}
        ${SWEEP_REVEAL_KEYFRAMES}
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fadeIn { animation: fadeIn 0.18s ease-out forwards; }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeInUp { animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both; }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(24px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-slideInRight { animation: slideInRight 0.28s cubic-bezier(0.16, 1, 0.3, 1) both; }
        @keyframes modalPop {
          0% { opacity: 0; transform: scale(0.92) translateY(8px); }
          60% { opacity: 1; transform: scale(1.015) translateY(0); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-modalPop { animation: modalPop 380ms cubic-bezier(0.16, 1, 0.3, 1) both; }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
        .animate-shake { animation: shake 400ms ease-in-out; }
        @keyframes discSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-discSpin { animation: discSpin 6s linear infinite; }
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.35; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.06); }
        }
        .animate-pulseGlow { animation: pulseGlow 2.6s ease-in-out infinite; }
        @keyframes eqBar {
          0%, 100% { transform: scaleY(0.25); }
          50% { transform: scaleY(1); }
        }
        .animate-eqBar1 { animation: eqBar 0.85s ease-in-out infinite; animation-delay: -0.6s; transform-origin: bottom; }
        .animate-eqBar2 { animation: eqBar 0.7s ease-in-out infinite; animation-delay: -0.2s; transform-origin: bottom; }
        .animate-eqBar3 { animation: eqBar 0.95s ease-in-out infinite; animation-delay: -0.9s; transform-origin: bottom; }
        .animate-eqBar4 { animation: eqBar 0.65s ease-in-out infinite; animation-delay: -0.35s; transform-origin: bottom; }
        @keyframes slideInFade {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slideInFade { animation: slideInFade 0.35s cubic-bezier(0.16, 1, 0.3, 1) both; }

        /* ---- Ash's Clock: vertical fade/slide digit mechanics ---- */
        .fade-unit {
          position: relative;
          width: calc(var(--fade-h) * 0.72);
          height: var(--fade-h);
          border-radius: 10px;
          overflow: hidden;
          background: linear-gradient(180deg, rgb(var(--clock-tile-top)) 0%, rgb(var(--clock-tile-bottom)) 100%);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 4px 14px rgb(var(--purple-600) / 0.16);
        }
        .fade-num {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: calc(var(--fade-h) * 0.52);
          font-weight: 800;
          font-family: 'SF Mono', 'Courier New', monospace;
          color: #f3e8ff;
          font-variant-numeric: tabular-nums;
        }
        @keyframes fadeNumInUp {
          from { opacity: 0; transform: translateY(38%); filter: blur(2px); }
          to { opacity: 1; transform: translateY(0); filter: blur(0); }
        }
        @keyframes fadeNumOutUp {
          from { opacity: 1; transform: translateY(0); filter: blur(0); }
          to { opacity: 0; transform: translateY(-38%); filter: blur(2px); }
        }
        @keyframes fadeNumInDown {
          from { opacity: 0; transform: translateY(-38%); filter: blur(2px); }
          to { opacity: 1; transform: translateY(0); filter: blur(0); }
        }
        @keyframes fadeNumOutDown {
          from { opacity: 1; transform: translateY(0); filter: blur(0); }
          to { opacity: 0; transform: translateY(38%); filter: blur(2px); }
        }
        .fade-num-in-up { animation: fadeNumInUp 0.42s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .fade-num-out-up { animation: fadeNumOutUp 0.42s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .fade-num-in-down { animation: fadeNumInDown 0.42s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .fade-num-out-down { animation: fadeNumOutDown 0.42s cubic-bezier(0.16, 1, 0.3, 1) both; }
        @keyframes questIn {
          from { opacity: 0; transform: translateY(-14px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-questIn { animation: questIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; }
        @keyframes questOut {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to { opacity: 0; transform: translateY(-10px) scale(0.97); }
        }
        .animate-questOut { animation: questOut 0.5s ease-in forwards; }
        @keyframes questSparkle {
          0% { transform: translateY(0) scale(0); opacity: 0; }
          15% { opacity: 1; }
          100% { transform: translateY(-150px) scale(1); opacity: 0; }
        }
        .animate-questSparkle { animation: questSparkle linear infinite; }
        @keyframes questSweep {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(120%); }
        }
        .animate-questSweep { animation: questSweep 2.6s ease-in-out infinite; }
        @keyframes questCursorBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .animate-questCursorBlink { animation: questCursorBlink 0.8s step-end infinite; }
        @keyframes flameFlicker {
          0%, 100% { transform: scale(1) rotate(-2deg); opacity: 0.95; }
          25% { transform: scale(1.08) rotate(2deg); opacity: 1; }
          50% { transform: scale(0.95) rotate(-3deg); opacity: 0.88; }
          75% { transform: scale(1.05) rotate(1deg); opacity: 1; }
        }
        .animate-flameFlicker { animation: flameFlicker 1.4s ease-in-out infinite; transform-origin: bottom center; }
        @keyframes flameGlow {
          0%, 100% { opacity: 0.45; transform: scale(0.85); }
          50% { opacity: 0.9; transform: scale(1.2); }
        }
        .animate-flameGlow { animation: flameGlow 1.8s ease-in-out infinite; }
        @keyframes emberRise {
          0% { transform: translateY(0) scale(0.4); opacity: 0; }
          20% { opacity: 1; }
          100% { transform: translateY(-16px) scale(1); opacity: 0; }
        }
        .animate-emberRise { animation: emberRise linear infinite; }
        @keyframes dotBreathe {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        .animate-dotBreathe { animation: dotBreathe 1.6s ease-in-out infinite; }
      `}</style>
      <Toaster />
    </div>
    </ConfigContext.Provider>
  );
}