// ---------------------------------------------------------------------------
// Config model: types, defaults, (de)serialization, and the shared
// ConfigContext, plus the pure calculation helpers (Hunter Rank, streak,
// syllabus revision status, diet/overview auto-values, countdowns, age).
//
// This is the "domain logic" layer of the app: nothing in this file renders
// JSX. It used to live inline in the ~6,700-line App.tsx; splitting it out
// means these functions can be unit-tested in isolation (see
// appConfig.test.ts) and reused by any tab/editor component without those
// components needing to know how e.g. Hunter Rank is computed.
// ---------------------------------------------------------------------------
import React from 'react';
import {
  LayoutGrid, Clock3, Dumbbell, BookOpen, Sparkles,
  CheckCircle2, Target, GraduationCap, Ruler, Weight,
  Droplets, Sunrise, Sun, Moon, Utensils, Flame,
  AlertTriangle, Eye, Smile, RotateCcw,
  TrendingUp, Activity, Timer, Calendar,
  Music2, Crown, Swords, ShieldCheck, ClipboardList, BarChart3, Bell,
  Settings, UserCircle2, ListChecks,
} from 'lucide-react';


// Same convention as DEFAULT_TRACKER_ITEMS / DEFAULT_TIMELINE / DEFAULT_TRAINING
// above: this is the fallback used whenever an account hasn't saved its own
// `profile` yet (i.e. every existing account today, since this field is new),
// so nothing changes visually for anyone until they actually edit it in
// Settings > Profile & Goals. It's also the "Reset to default" target there.
// This is a neutral placeholder, not any one person's real identity — the
// onboarding wizard writes a real profile immediately after signup, so this
// only ever shows briefly (or as the "Reset to default" target in Settings).
export const DEFAULT_PROFILE = {
  name: 'Your Name',
  goalLabel: 'Add your goal',
  // Birthdate ('YYYY-MM-DD') replaces the old static `age` field — age is
  // now always derived from this via calculateAge() so it keeps itself
  // correct instead of going stale. Defaults to ~18 years ago (computed
  // inline, not via the helper further below, since this runs at module
  // load before that helper's dependencies are initialized) so the
  // placeholder profile still reads as "18-year-old" like before.
  birthdate: (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 18);
    return d.toISOString().split('T')[0];
  })(),
  height: 170,
  weight: 65,
  category: '',
  baseline: 0,
  baselineLabel: 'Baseline Score',
  boards: 0,
  targets: [
    { rank: 1, name: 'Add your first target', course: 'Course / program', tag: 'Top Priority', color: 'blue', desc: 'Edit this in Settings > Profile & Goals — describe what you\'re aiming for and why it matters.' },
  ],
};

// Standalone personal countdowns — deliberately NOT tied to `profile.targets`.
// Someone might want a live countdown to, say, JEE Main's actual exam date
// without that date needing to exist as one of their formal priority targets.
// Fully editable in Settings > Countdown, and there can be more than one
// (e.g. "JEE Main" + "Boards" + "Scholarship Interview" all ticking at
// once). Empty by default so nothing is fabricated until the user adds one.
export type CountdownItem = {
  id: string;
  label: string;
  targetDate: string; // 'YYYY-MM-DD'
  targetTime: string; // 'HH:MM', 24h — defaults to midnight of targetDate
  // Timestamp (ms) of when this countdown was set — powers its depleting
  // progress bar (full at startMs, empty at the target). Auto-set whenever
  // the target date/time is (re)saved; null falls back to a generic span.
  startMs: number | null;
  // Name from COUNTDOWN_COLOR_PALETTE — lets each countdown stand apart
  // visually when several are ticking side by side in the same card.
  color: string;
};

export const DEFAULT_COUNTDOWNS: CountdownItem[] = [];

export const makeCountdownId = () => `cd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

// `existingCount` rotates through the palette so each newly-added countdown
// defaults to a different color than the ones already there, instead of
// everything piling up on the same 'sky' every time.
export const makeBlankCountdown = (existingCount = 0): CountdownItem => ({
  id: makeCountdownId(),
  label: '',
  targetDate: '',
  targetTime: '00:00',
  startMs: null,
  color: COUNTDOWN_COLOR_NAMES[existingCount % COUNTDOWN_COLOR_NAMES.length],
});

export const DEFAULT_TIMELINE = [
  { start: '05:00', end: '05:20', label: 'Wake & Prep', detail: 'Pre-breakfast drinks, Vitamin D3', icon: Sunrise, type: 'prep', longDesc: 'Instant waking routine. Rehydrating the system with 500ml water + Chia seeds immediately to eliminate sleep inertia. Take single high-dose Vitamin D3 drop.' },
  { start: '05:20', end: '08:30', label: 'Study Slot 1 — Mathematics', detail: 'Allen Lectures at 1.5x–2x + active practice', icon: BookOpen, type: 'study', subject: 'math', longDesc: 'Peak cognitive availability window. Focus exclusively on core algebraic and trigonometric proof systems. Complete minimum 25 high-tier questions.' },
  { start: '08:30', end: '08:50', label: 'Breakfast Window', detail: 'Clean fuel block', icon: Utensils, type: 'meal', longDesc: '4 whole eggs, 3 whites, oats base. Ensure exact macronutrient absorption timing prior to the grueling Physics block.' },
  { start: '08:50', end: '11:30', label: 'Study Slot 2 — Physics', detail: 'Concepts and basic problem sets', icon: BookOpen, type: 'study', subject: 'physics', longDesc: 'Mechanics integration. Moving away from memorized shortcuts into deep vector analysis and calculus application frameworks.' },
  { start: '11:30', end: '13:00', label: 'Gym & Shower Window', detail: 'Dead-hour optimization — gym is empty', icon: Dumbbell, type: 'gym', longDesc: 'Hypertrophy or calisthenics application. Gym floor empty; maximize efficiency, execute within 65 minutes, return for rapid protein shake recovery.' },
  { start: '13:00', end: '13:25', label: 'Lunch', detail: 'High-protein recovery + Omega-3 Fish Oil', icon: Utensils, type: 'meal', longDesc: '200g chicken breast cooked clean + 2 whole wheat rotis and huge fiber salad pile. Take Omega-3 pills.' },
  { start: '13:25', end: '16:30', label: 'Study Slot 3 — Chemistry', detail: 'Physical / Organic alternating rotation', icon: BookOpen, type: 'study', subject: 'chem', longDesc: 'GOC mechanisms tracking or Mole concept numerical testing. Prevent midday fatigue by keeping hand writing actively moving.' },
  { start: '16:30', end: '16:50', label: 'Midday Snack Window', detail: 'Micronutrient / gut health reset', icon: Utensils, type: 'meal', longDesc: '200g clean curd base for gut microbiome + 1 antioxidant fruit source (apple/guava) + 15 raw structural almonds.' },
  { start: '16:50', end: '20:00', label: 'Study Slot 4 — Inorganic Chemistry', detail: 'Memorization or lecture backlog cleanup', icon: BookOpen, type: 'study', subject: 'chem', longDesc: 'High repetition memorization layer (NCERT alignments, block configurations, trend anomalies). Bullet journal exceptions.' },
  { start: '20:00', end: '20:25', label: 'Dinner Window', detail: 'Clean, low-carb evening plate', icon: Utensils, type: 'meal', longDesc: '150g pure lean chicken breast or paneer equivalent + hot vegetable stew array. Keep carbs light to avoid heavy morning fog.' },
  { start: '20:25', end: '22:00', label: 'Study Slot 5 — Mixed Advanced PYQs', detail: 'Past 5 years, timed conditions', icon: Timer, type: 'study', subject: 'mixed', longDesc: 'Testing mental endurance under fatigued constraints. Mimic real exam stress conditions across combined conceptual formats.' },
  { start: '22:00', end: '22:20', label: 'Night Snack Window', detail: 'Casein-rich slow protein feed', icon: Utensils, type: 'meal', longDesc: '250ml warm milk + 30g roasted chana. Sustained amino acid release engine covering 8 hours of fast sleep synthesis.' },
  { start: '22:20', end: '23:00', label: 'Plan & Wind Down', detail: 'Next day chapters, Magnesium, screens off', icon: Moon, type: 'prep', longDesc: 'Hard checklist preparation for tomorrow. Take structural Magnesium glycinate, terminate all short-wave blue lights, execute breathing resets.' },
  { start: '23:00', end: '23:00', label: 'Sleep Lock', detail: 'Hard stop.', icon: Moon, type: 'sleep', longDesc: 'Absolute system shutdown. Dark room settings optimized for rapid entry into deep REM sleep cycle.' },
];

// ---------- Fuel Matrix: Diet (fully editable — see ConfigContext.diet) ----------
// Used to be a hardcoded DIET constant. Now every meal — its time, name,
// icon, and food items — lives in config and is editable in Settings >
// Training & Fuel, capped at MAX_DIET_MEALS so the Daily Matrix's "All 6
// Meals Hit" box stays meaningful. The old third slot was called
// "Post-Workout Lunch"; renamed to plain "Lunch" since most people don't
// train right before lunch specifically.
export const MAX_DIET_MEALS = 6;

export type DietMeal = {
  id: string;
  time: string;
  name: string;
  items: string[];
  iconName: string;
  icon: any;
};

// Icon-bearing source of truth (mirrors the DEFAULT_TIMELINE convention —
// the "storable" iconName-only version is built once ICON_LIBRARY exists,
// further below).
export const DEFAULT_DIET_MEALS_RAW = [
  { time: '05:00 AM', name: 'Pre-Breakfast', items: ['Warm water + lemon + 1 tsp chia seeds', 'Sattu drink (2 tbsp sattu + water + black salt)'], icon: Sunrise },
  { time: '08:30 AM', name: 'Breakfast', items: ['4 whole eggs + 3 egg whites', '60g oats in water', '1 banana'], icon: Sun },
  { time: '01:00 PM', name: 'Lunch', items: ['1 scoop Whey Isolate in water', '200g grilled/boiled chicken breast', '2 rotis', '1 bowl green sabzi', 'Large mixed salad'], icon: Dumbbell },
  { time: '04:30 PM', name: 'Midday Snack', items: ['200g curd', '1 apple or guava', '15 raw almonds'], icon: Sun },
  { time: '08:00 PM', name: 'Dinner', items: ['150g chicken breast', 'Warm vegetable stew', 'Green salad'], icon: Moon },
  { time: '10:00 PM', name: 'Night Snack', items: ['250ml toned milk', '30g roasted chana'], icon: Moon },
];

export const makeDietMealId = () => `meal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const makeBlankDietMeal = (): Omit<DietMeal, 'icon'> => ({
  id: makeDietMealId(),
  time: '',
  name: 'New Meal',
  items: [],
  iconName: 'Utensils',
});

// ---- Diet target overrides (Calories / Protein / Hydration) ----
// Same "auto unless overridden" convention as OverviewOverrideKey below —
// each defaults to '' (meaning "use the auto-estimate computed from the
// meals above") and only holds real text once someone types a custom value.
export type DietOverrideKey = 'calories' | 'protein' | 'hydration';
export const DIET_OVERRIDE_KEYS: DietOverrideKey[] = ['calories', 'protein', 'hydration'];
export const DEFAULT_DIET_OVERRIDES: Record<DietOverrideKey, string> = { calories: '', protein: '', hydration: '' };

export function hydrateDietOverrides(raw: any): Record<DietOverrideKey, string> {
  const out = { ...DEFAULT_DIET_OVERRIDES };
  if (raw && typeof raw === 'object') {
    for (const k of DIET_OVERRIDE_KEYS) {
      if (typeof raw[k] === 'string') out[k] = raw[k];
    }
  }
  return out;
}

// ---- Lightweight nutrition estimator ----
// Not a real food database — just enough per-item approximations (common
// staples plus generic fallbacks) so a new user's calorie / protein /
// hydration targets fill themselves in reasonably from whatever meals they
// type, instead of staying stuck on one person's old hardcoded numbers.
// Every estimate is still fully overridable with real text in Settings.
export type NutritionBasis = 'per100g' | 'per100ml' | 'piece';
export const FOOD_NUTRITION_DB: Record<string, { basis: NutritionBasis; cal: number; protein: number; waterMl?: number }> = {
  'egg white': { basis: 'piece', cal: 17, protein: 3.6 },
  'egg': { basis: 'piece', cal: 78, protein: 6 },
  'whey': { basis: 'piece', cal: 120, protein: 25 }, // per scoop
  'oats': { basis: 'per100g', cal: 389, protein: 16.9 },
  'banana': { basis: 'piece', cal: 105, protein: 1.3 },
  'chicken': { basis: 'per100g', cal: 165, protein: 31 },
  'paneer': { basis: 'per100g', cal: 265, protein: 18 },
  'tofu': { basis: 'per100g', cal: 144, protein: 15 },
  'fish': { basis: 'per100g', cal: 140, protein: 24 },
  'roti': { basis: 'piece', cal: 120, protein: 3 },
  'chapati': { basis: 'piece', cal: 120, protein: 3 },
  'rice': { basis: 'per100g', cal: 130, protein: 2.7 },
  'dal': { basis: 'per100g', cal: 116, protein: 9 },
  'lentil': { basis: 'per100g', cal: 116, protein: 9 },
  'sabzi': { basis: 'per100g', cal: 80, protein: 3 },
  'vegetable': { basis: 'per100g', cal: 65, protein: 2.5 },
  'salad': { basis: 'per100g', cal: 20, protein: 1 },
  'curd': { basis: 'per100g', cal: 60, protein: 3.5, waterMl: 75 },
  'yogurt': { basis: 'per100g', cal: 60, protein: 3.5, waterMl: 75 },
  'almond': { basis: 'piece', cal: 7, protein: 0.26 },
  'peanut butter': { basis: 'per100g', cal: 588, protein: 25 },
  'peanut': { basis: 'piece', cal: 6, protein: 0.27 },
  'cashew': { basis: 'piece', cal: 9, protein: 0.2 },
  'apple': { basis: 'piece', cal: 95, protein: 0.5 },
  'guava': { basis: 'piece', cal: 68, protein: 2.6 },
  'orange': { basis: 'piece', cal: 62, protein: 1.2 },
  'milk': { basis: 'per100ml', cal: 60, protein: 3.2, waterMl: 100 },
  'chana': { basis: 'per100g', cal: 364, protein: 19 },
  'chickpea': { basis: 'per100g', cal: 364, protein: 19 },
  'sattu': { basis: 'per100g', cal: 380, protein: 20 },
  'soy': { basis: 'per100g', cal: 336, protein: 52 },
  'bread': { basis: 'piece', cal: 80, protein: 3 },
  'potato': { basis: 'per100g', cal: 87, protein: 1.9 },
  'water': { basis: 'per100ml', cal: 0, protein: 0, waterMl: 100 },
  'lemon': { basis: 'piece', cal: 17, protein: 0.6 },
  'chia': { basis: 'per100g', cal: 486, protein: 17 },
};
// Multi-word keys need to be checked before their shorter substrings (e.g.
// "peanut butter" before "peanut"), so this list is sorted longest-first.
export const FOOD_NUTRITION_KEYS = Object.keys(FOOD_NUTRITION_DB).sort((a, b) => b.length - a.length);

// Rough gram/ml equivalents for the units people actually type.
export const UNIT_TO_GRAMS: Record<string, number> = { g: 1, gram: 1, grams: 1, kg: 1000, tbsp: 15, tsp: 5, scoop: 30, cup: 240 };
export const UNIT_TO_ML: Record<string, number> = { ml: 1, l: 1000, litre: 1000, liter: 1000, tbsp: 15, tsp: 5, cup: 240, glass: 250 };

// Parses one free-text food fragment (e.g. "200g grilled chicken breast")
// into an approximate {cal, protein, waterMl} contribution. Silently
// contributes nothing for anything unrecognised (supplements, spices,
// "black salt", etc.) rather than guessing wildly.
export function estimateFragmentNutrition(fragmentRaw: string) {
  const fragment = fragmentRaw.toLowerCase().trim();
  if (!fragment) return { cal: 0, protein: 0, waterMl: 0 };

  const foodKey = FOOD_NUTRITION_KEYS.find((k) => fragment.includes(k));
  if (!foodKey) return { cal: 0, protein: 0, waterMl: 0 };
  const food = FOOD_NUTRITION_DB[foodKey];

  const qtyMatch = /(\d+(?:\.\d+)?)\s*(g|gram|grams|kg|ml|l|litre|liter|tbsp|tsp|scoop|cup|glass)?/.exec(fragment);
  const qty = qtyMatch ? parseFloat(qtyMatch[1]) : 1;
  const unit = qtyMatch?.[2];

  let multiplier = 1;
  if (food.basis === 'per100g') {
    const grams = unit ? qty * (UNIT_TO_GRAMS[unit] ?? 1) : qty * 100; // bare number, no unit -> assume ~grams-scale serving
    multiplier = grams / 100;
  } else if (food.basis === 'per100ml') {
    const ml = unit ? qty * (UNIT_TO_ML[unit] ?? 1) : qty * 100;
    multiplier = ml / 100;
  } else {
    // 'piece' basis — a bare count of whole units (eggs, rotis, almonds…)
    multiplier = qty;
  }

  return {
    cal: food.cal * multiplier,
    protein: food.protein * multiplier,
    waterMl: (food.waterMl || 0) * multiplier,
  };
}

// A single item string like "4 whole eggs + 3 egg whites" bundles more than
// one food, so it's split on common separators before estimating.
export function estimateItemNutrition(item: string) {
  const fragments = (item || '').split(/\+|,|\band\b/gi);
  return fragments.reduce((sum, frag) => {
    const n = estimateFragmentNutrition(frag);
    return { cal: sum.cal + n.cal, protein: sum.protein + n.protein, waterMl: sum.waterMl + n.waterMl };
  }, { cal: 0, protein: 0, waterMl: 0 });
}

// Sums every item across every meal into a day-level estimate, then formats
// it the same way the old hardcoded DIET.target/protein/hydration strings
// used to read — this is what each Fuel Matrix row shows unless overridden.
export function computeDietAutoValues(meals: DietMeal[], profileWeightKg?: number): Record<DietOverrideKey, string> {
  const totals = (meals || []).reduce((sum, m) => {
    const mealTotal = (m.items || []).reduce((s, it) => {
      const n = estimateItemNutrition(it);
      return { cal: s.cal + n.cal, protein: s.protein + n.protein, waterMl: s.waterMl + n.waterMl };
    }, { cal: 0, protein: 0, waterMl: 0 });
    return { cal: sum.cal + mealTotal.cal, protein: sum.protein + mealTotal.protein, waterMl: sum.waterMl + mealTotal.waterMl };
  }, { cal: 0, protein: 0, waterMl: 0 });

  const hasAnyFood = totals.cal > 0 || totals.protein > 0;
  const calRounded = Math.round(totals.cal / 25) * 25;
  const proteinRounded = Math.round(totals.protein);

  // Hydration: a standard 35ml/kg bodyweight baseline (falls back to a 70kg
  // reference if no profile weight is set yet) plus whatever liquid the
  // logged meals already account for, so liquid-heavy meals ask for a touch
  // less separate drinking water.
  const baselineL = (profileWeightKg && profileWeightKg > 0 ? profileWeightKg : 70) * 0.035;
  const dietLiquidL = totals.waterMl / 1000;
  const totalL = Math.round((baselineL + dietLiquidL) * 2) / 2; // nearest 0.5L

  return {
    calories: hasAnyFood ? `~${calRounded} kcal` : 'Add meals below to auto-estimate',
    protein: hasAnyFood ? `~${proteinRounded}g protein` : 'Add meals below to auto-estimate',
    hydration: `~${totalL.toFixed(1)}L water/day`,
  };
}

// Merges the auto-estimate with whatever the person has overridden — an
// empty override string means "stay on auto" for that row, same convention
// as resolveOverviewValues below.
export function resolveDietValues(meals: DietMeal[], overrides: Record<DietOverrideKey, string>, profileWeightKg?: number) {
  const auto = computeDietAutoValues(meals, profileWeightKg);
  const resolved = {} as Record<DietOverrideKey, string>;
  for (const k of DIET_OVERRIDE_KEYS) {
    resolved[k] = overrides?.[k] ? overrides[k] : auto[k];
  }
  return { auto, resolved };
}

// ---------- Dashboard Overview: "Today's Shape" / "Fuel Snapshot" ----------
// These two Overview cards used to be permanently hardcoded strings, so
// editing the Timeline in Settings never actually updated them. They now
// auto-derive from real config (Timeline block types/durations, and the
// Fuel Matrix target) so a new user sees correct numbers without touching
// anything — but each row can still be overridden with custom text via
// Settings > Dashboard Overview if someone wants to say something other
// than what the schedule implies.
export type OverviewOverrideKey = 'studySessions' | 'training' | 'meals' | 'sleep' | 'calories' | 'protein' | 'hydration';

export const OVERVIEW_OVERRIDE_KEYS: OverviewOverrideKey[] = ['studySessions', 'training', 'meals', 'sleep', 'calories', 'protein', 'hydration'];

export const DEFAULT_OVERVIEW_OVERRIDES: Record<OverviewOverrideKey, string> = {
  studySessions: '',
  training: '',
  meals: '',
  sleep: '',
  calories: '',
  protein: '',
  hydration: '',
};

export function hydrateOverviewOverrides(raw: any): Record<OverviewOverrideKey, string> {
  const out = { ...DEFAULT_OVERVIEW_OVERRIDES };
  if (raw && typeof raw === 'object') {
    for (const k of OVERVIEW_OVERRIDE_KEYS) {
      if (typeof raw[k] === 'string') out[k] = raw[k];
    }
  }
  return out;
}

// 'HH:MM' -> minutes since midnight. Tolerant of missing/malformed values
// so a half-edited timeline block doesn't blow up the summary card.
export function timeStrToMinutes(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '');
  if (!m) return 0;
  return Math.max(0, Math.min(23, parseInt(m[1], 10))) * 60 + Math.max(0, Math.min(59, parseInt(m[2], 10)));
}

export function slotDurationMinutes(slot: { start: string; end: string }): number {
  const start = timeStrToMinutes(slot.start);
  const end = timeStrToMinutes(slot.end);
  // Overnight-safe: if the block's end time is earlier than its start
  // (e.g. crosses midnight), treat it as continuing into the next day.
  return end >= start ? end - start : (24 * 60 - start) + end;
}

export function formatMinutesDuration(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

export function formatClock12(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '');
  if (!m) return '—';
  let h = parseInt(m[1], 10);
  const min = m[2];
  const suffix = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${min} ${suffix}`;
}

// Reads the live Timeline + resolved Fuel Matrix values to build every auto
// value — this is what each Overview row shows unless the person has typed
// a custom override for that specific row in Settings > Dashboard Overview.
// `dietResolved` is whatever the Fuel Matrix (Settings > Training & Fuel)
// currently shows for calories/protein/hydration — auto-estimated from the
// meals there, or that section's own custom override, whichever is active —
// so this Overview row can still be independently overridden on top of that.
export function computeOverviewAutoValues(timeline: any[], dietResolved: Record<DietOverrideKey, string>): Record<OverviewOverrideKey, string> {
  const studySlots = (timeline || []).filter((s) => s.type === 'study');
  const gymSlots = (timeline || []).filter((s) => s.type === 'gym');
  const mealSlots = (timeline || []).filter((s) => s.type === 'meal');
  const sleepSlot = (timeline || []).find((s) => s.type === 'sleep');

  const studyMinutes = studySlots.reduce((sum, s) => sum + slotDurationMinutes(s), 0);
  const gymMinutes = gymSlots.reduce((sum, s) => sum + slotDurationMinutes(s), 0);

  return {
    studySessions: studySlots.length
      ? `${studySlots.length} block${studySlots.length === 1 ? '' : 's'} · ~${formatMinutesDuration(studyMinutes)}`
      : 'Not scheduled',
    training: gymSlots.length ? `${formatMinutesDuration(gymMinutes)} window` : 'Rest day',
    meals: mealSlots.length ? `${mealSlots.length} fuel window${mealSlots.length === 1 ? '' : 's'}` : 'Not scheduled',
    sleep: sleepSlot ? `${formatClock12(sleepSlot.start)} sharp` : 'Not scheduled',
    calories: dietResolved.calories,
    protein: dietResolved.protein,
    hydration: dietResolved.hydration,
  };
}

// Merges auto-computed values with whatever the person has overridden —
// an empty override string means "stay on auto" for that row.
export function resolveOverviewValues(timeline: any[], overrides: Record<OverviewOverrideKey, string>, dietResolved: Record<DietOverrideKey, string>) {
  const auto = computeOverviewAutoValues(timeline, dietResolved);
  const resolved = {} as Record<OverviewOverrideKey, string>;
  for (const k of OVERVIEW_OVERRIDE_KEYS) {
    resolved[k] = overrides?.[k] ? overrides[k] : auto[k];
  }
  return { auto, resolved };
}

export const DEFAULT_TRAINING = [
  { day: 'Monday', focus: 'Gym Upper Body (Pull Focus)', exercises: [{ name: 'Lat Pulldowns', sets: '4×12' }, { name: 'Seated Cable Rows', sets: '3×12' }, { name: 'DB Lateral Raises', sets: '4×20' }, { name: 'Behind-the-Back Wrist Curls', sets: '4×20 (high pump)' }], mode: 'gym' },
  { day: 'Tuesday', focus: 'Calisthenics Pull & Push Basics', exercises: [{ name: 'Dead-hang holds', sets: '4×Max' }, { name: 'Negative Pull-ups', sets: '4×5 (5-sec slow descent)' }, { name: 'Standard Push-ups', sets: '4×12' }], mode: 'calisthenics' },
  { day: 'Wednesday', focus: 'Legs & Deep Core Compression', exercises: [{ name: 'Goblet Squats', sets: '4×12' }, { name: 'Romanian Deadlifts', sets: '3×12' }, { name: 'Hanging Leg / Knee Raises', sets: '4×12' }, { name: 'Stomach Vacuums (structural planks)', sets: '3×60s' }], mode: 'gym' },
  { day: 'Thursday', focus: 'Gym Upper Body (Push Focus)', exercises: [{ name: 'Overhead DB Press', sets: '4×10' }, { name: 'Incline DB Bench Press', sets: '3×10' }, { name: 'DB Lateral Raises', sets: '4×15' }], mode: 'gym' },
  { day: 'Friday', focus: 'Calisthenics Push & Absolute Core', exercises: [{ name: 'Diamond Push-ups', sets: '4×12' }, { name: 'Pike Push-ups', sets: '3×10' }, { name: 'DB Lateral Raises', sets: '4×15' }, { name: 'L-Sit Progressions', sets: '4×Max holds' }], mode: 'calisthenics' },
  { day: 'Saturday', focus: 'Back & Shoulder Hypertrophy Burnout', exercises: [{ name: 'Straight-Arm Cable Pull-overs', sets: '4×12' }, { name: 'Face Pulls', sets: '3×20' }, { name: 'DB Lateral Raises (drop sets)', sets: '4×20' }, { name: 'Hammer Curls', sets: '3×12' }, { name: 'Finger Roll Grip Curls', sets: '4×25' }], mode: 'gym' },
  { day: 'Sunday', focus: 'Full Rest Day', exercises: [{ name: 'Deep physical stretching', sets: '—' }, { name: 'Zero training load', sets: '—' }, { name: 'Mental recovery', sets: '—' }], mode: 'rest' },
];

// ---------- Subjects & Syllabus (now user-editable, see ConfigContext) ----------
// DEFAULT_SUBJECTS / DEFAULT_SYLLABUS below are the fallback used for any
// account that hasn't customized its own subject list yet (i.e. every
// existing account today, since these fields are new) — same convention as
// DEFAULT_TRACKER_ITEMS / DEFAULT_TIMELINE / DEFAULT_TRAINING / DEFAULT_PROFILE.
// `color` is a name from SUBJECT_COLOR_PALETTE (a fixed set of Tailwind
// class strings), not a raw class, since Tailwind can't resolve dynamically
// built class names like `text-${color}-400`.
export const DEFAULT_SUBJECTS = [
  { key: 'math', label: 'Mathematics', color: 'sky', inMockTest: true },
  { key: 'physics', label: 'Physics', color: 'violet', inMockTest: true },
  { key: 'chem', label: 'Chemistry', color: 'fuchsia', inMockTest: true },
  { key: 'mixed', label: 'Mixed / PYQ', color: 'amber', inMockTest: false },
];

export const DEFAULT_SYLLABUS = [
  { phase: 1, month: 'July', label: 'Core Foundations', subjects: {
    math: ['Basic Maths', 'Logs', 'Quadratics', 'Sequences & Series', 'Trigonometry'],
    physics: ['Units & Dimensions', 'Vectors', 'Kinematics (1D/2D)', 'NLM & Friction', 'WPE'],
    chem: ['Mole Concept', 'Atomic Structure', 'Periodic Table', 'Chemical Bonding', 'GOC'],
  }},
  { phase: 2, month: 'August', label: "11th Heavyweights", subjects: {
    math: ['Complex Numbers', 'P&C', 'Binomial Theorem', 'Coordinate Geometry (Lines, Circles, Conics)'],
    physics: ['COM & Collisions', 'Rotational Motion', 'Gravitation', 'SHM', 'Fluids', 'Waves & Sound', 'Thermodynamics & KTG'],
    chem: ['Chemical & Ionic Equilibrium', 'Thermodynamics', 'Redox', 'Hydrocarbons'],
  }},
  { phase: 3, month: 'September', label: '12th Core Mechanical Blocks', subjects: {
    math: ['Functions', 'ITF', 'Limits, Continuity, Differentiability', 'MOD', 'AOD', 'Matrices & Determinants'],
    physics: ['Electrostatics', 'Gauss Law', 'Capacitance', 'Current Electricity', 'Magnetic Effects', 'Magnetism & Matter'],
    chem: ['Solutions', 'Electrochemistry', 'Kinetics', 'Coordination Compounds', 'd/f-Block', 'Alkyl/Aryl Halides', 'Alcohols, Phenols & Ethers'],
  }},
  { phase: 4, month: 'October', label: 'High-Scoring Finales', subjects: {
    math: ['Indefinite/Definite Integration', 'Area under curves', 'Differential Equations', 'Vectors', '3D Geometry', 'Probability', 'Statistics'],
    physics: ['EMI', 'AC', 'EM Waves', 'Ray & Wave Optics', 'Modern Physics', 'Semiconductors'],
    chem: ['Aldehydes, Ketones, Carboxylic Acids', 'Amines', 'p-Block', 'Biomolecules', 'Polymers', 'Surface Chemistry'],
  }},
];

// A subject's presence in the Mock Test Tracker form used to be inferred
// silently from whether it had any syllabus content anywhere (a catch-all
// like "Mixed / PYQ" has none, so it never got a score box). That's now an
// explicit, user-editable `inMockTest` flag on each subject (see Settings >
// Subjects & Syllabus). For subjects saved before this flag existed, fall
// back to that same syllabus-content inference so existing setups don't
// change until the person actually touches the new toggle.
export function hydrateSubjects(rawSubjects: any, syllabusForInference: any[]): any[] {
  const list = Array.isArray(rawSubjects) && rawSubjects.length ? rawSubjects : DEFAULT_SUBJECTS;
  return list.map((s: any) => ({
    ...s,
    inMockTest: typeof s.inMockTest === 'boolean'
      ? s.inMockTest
      : syllabusForInference.some((p: any) => Array.isArray(p?.subjects?.[s.key])),
  }));
}
// The syllabus roadmap shows *what* to study, but nothing previously tracked
// *when a topic was last revisited* — the actual mechanism behind forgetting
// month-1 material by month-4. This gives every topic a "last revised" stamp
// and flags anything gone stale.
//
// Topic names aren't unique across phases (e.g. "Vectors" appears in both
// Phase 1 physics and Phase 4 math), so tracking is keyed by phase+subject+topic.

export const REVISION_FRESH_DAYS = 7;   // revised within this window: considered fresh
export const REVISION_DUE_DAYS = 14;    // beyond this: overdue, needs attention

export function getTopicRevisionKey(phase, subject, topic) {
  return `${phase}|${subject}|${topic}`;
}

export function getDaysSinceDate(dateStr) {
  const then = new Date(dateStr + 'T00:00:00').getTime();
  const now = new Date(getLocalDateString() + 'T00:00:00').getTime();
  return Math.max(0, Math.round((now - then) / (1000 * 60 * 60 * 24)));
}

export function getRevisionStatus(lastRevisedStr) {
  if (!lastRevisedStr) return { status: 'never', days: null };
  const days = getDaysSinceDate(lastRevisedStr);
  if (days < REVISION_FRESH_DAYS) return { status: 'fresh', days };
  if (days < REVISION_DUE_DAYS) return { status: 'due', days };
  return { status: 'overdue', days };
}

// Was a module-level const built off a hardcoded ['math','physics','chem']
// list; now a function over whatever subject keys the live syllabus (from
// ConfigContext) actually contains, so a user's own custom subject list
// works the same way the original 3 did.
export function getAllSyllabusTopics(syllabus: any[]) {
  return syllabus.flatMap((p) =>
    Object.keys(p.subjects).flatMap((subject) =>
      p.subjects[subject].map((topic: string) => ({
        key: getTopicRevisionKey(p.phase, subject, topic),
        topic,
        subject,
        phase: p.phase,
        month: p.month,
      }))
    )
  );
}

export interface TrackerItem { id: string; label: string }
// A "date -> { itemId: done }" map. Shape shared by the daily tracker's
// history (globalHistory) and the diet log (dietLog) — same convention,
// different item ids.
export type DailyCheckLog = Record<string, Record<string, boolean>>;
export const DEFAULT_TRACKER_ITEMS: TrackerItem[] = [
  { id: 't1', label: '5 AM Wake-Up' },
  { id: 't2', label: 'Math Block' },
  { id: 't3', label: 'Physics Block' },
  { id: 't4', label: 'Chemistry Block' },
  { id: 't5', label: '11:30 AM Gym' },
  { id: 't6', label: 'All 6 Meals Hit' },
  { id: 't7', label: 'Supplements' },
  { id: 't8', label: 'Grooming Routine' },
  { id: 't9', label: '4L+ Water Hit' },
  { id: 't10', label: '11 PM Sleep Lock' },
];

// ---------- Config Editability ----------
// TRACKER_ITEMS, TIMELINE, and TRAINING used to be hardcoded constants —
// updating the daily routine as the exam gets closer meant editing source
// code. They're now user-editable, backed by localStorage, with these
// DEFAULT_* arrays as the fallback / "Reset to default" target. Everything
// downstream reads the *live* config (via ConfigContext) instead of these
// constants directly.

// Icons can't survive JSON.stringify, so timeline blocks are persisted with
// an `iconName` string key into this small curated set, and resolved back to
// a component at render time.
export const ICON_LIBRARY: Record<string, any> = {
  Sunrise, Sun, Moon, BookOpen, Utensils, Dumbbell, Timer, Sparkles,
  Target, Flame, Activity, Droplets, Bell, ClipboardList, Music2,
};
export const ICON_LIBRARY_KEYS = Object.keys(ICON_LIBRARY);

export function resolveIconName(icon: any): string {
  const found = Object.entries(ICON_LIBRARY).find(([, comp]) => comp === icon);
  return found ? found[0] : 'BookOpen';
}

export const DEFAULT_TIMELINE_STORABLE = DEFAULT_TIMELINE.map((slot) => ({
  ...slot,
  iconName: resolveIconName(slot.icon),
}));

export function hydrateTimeline(rawList: any[]): any[] {
  return rawList.map((slot, i) => ({
    start: slot.start ?? '00:00',
    end: slot.end ?? slot.start ?? '00:00',
    label: slot.label || `Block ${i + 1}`,
    detail: slot.detail || '',
    type: ['study', 'gym', 'meal', 'prep', 'sleep'].includes(slot.type) ? slot.type : 'prep',
    subject: slot.subject || undefined,
    longDesc: slot.longDesc || '',
    iconName: slot.iconName && ICON_LIBRARY[slot.iconName] ? slot.iconName : 'BookOpen',
    icon: ICON_LIBRARY[slot.iconName] || BookOpen,
  }));
}

// Same "storable" convention as DEFAULT_TIMELINE_STORABLE above — this is
// what a brand-new account's Fuel Matrix starts from, and what "Reset to
// default" in Settings > Training & Fuel restores.
export const DEFAULT_DIET_STORABLE = DEFAULT_DIET_MEALS_RAW.map((m, i) => ({
  id: `diet_default_${i}`,
  time: m.time,
  name: m.name,
  items: m.items,
  iconName: resolveIconName(m.icon),
}));

export function hydrateDiet(rawList: any): DietMeal[] {
  const list = Array.isArray(rawList) && rawList.length ? rawList : DEFAULT_DIET_STORABLE;
  // Hard-capped at MAX_DIET_MEALS even on load, so old/foreign data can
  // never sneak past the 6-meal ceiling enforced in the Settings editor.
  return list.slice(0, MAX_DIET_MEALS).map((m: any, i: number) => {
    const iconName = typeof m?.iconName === 'string' && ICON_LIBRARY[m.iconName] ? m.iconName : 'Utensils';
    return {
      id: typeof m?.id === 'string' && m.id ? m.id : makeDietMealId(),
      time: typeof m?.time === 'string' ? m.time : '',
      name: typeof m?.name === 'string' && m.name ? m.name : `Meal ${i + 1}`,
      items: Array.isArray(m?.items) ? m.items.filter((it: any) => typeof it === 'string') : [],
      iconName,
      icon: ICON_LIBRARY[iconName] || Utensils,
    };
  });
}

export function serializeConfig(config: { trackerItems: any[]; timeline: any[]; training: any[]; profile: any; subjects: any[]; syllabus: any[]; countdowns: any[]; overviewOverrides: Record<OverviewOverrideKey, string>; diet: DietMeal[]; dietOverrides: Record<DietOverrideKey, string>; tabLabels: Record<TabLabelKey, string>; tabIcons: Record<TabLabelKey, string>; sectionLabels: Record<string, { label: string; icon: string }>; domains: string[] | null }) {
  return {
    trackerItems: config.trackerItems,
    training: config.training,
    timeline: config.timeline.map(({ icon, ...rest }) => rest),
    profile: config.profile,
    subjects: config.subjects,
    syllabus: config.syllabus,
    countdowns: config.countdowns,
    overviewOverrides: config.overviewOverrides,
    diet: config.diet.map(({ icon, ...rest }) => rest),
    dietOverrides: config.dietOverrides,
    tabLabels: config.tabLabels,
    tabIcons: config.tabIcons,
    sectionLabels: config.sectionLabels,
    domains: config.domains,
  };
}

export function hydrateCountdown(raw: any, fallbackIndex = 0): CountdownItem {
  return {
    id: typeof raw?.id === 'string' && raw.id ? raw.id : makeCountdownId(),
    label: typeof raw?.label === 'string' ? raw.label : '',
    targetDate: typeof raw?.targetDate === 'string' ? raw.targetDate : '',
    targetTime: typeof raw?.targetTime === 'string' ? raw.targetTime : '00:00',
    startMs: typeof raw?.startMs === 'number' ? raw.startMs : null,
    // Older saves (before colors existed) get one assigned by rotation
    // rather than everything defaulting to the same 'sky'.
    color: typeof raw?.color === 'string' && COUNTDOWN_COLOR_PALETTE[raw.color]
      ? raw.color
      : COUNTDOWN_COLOR_NAMES[fallbackIndex % COUNTDOWN_COLOR_NAMES.length],
  };
}

// SECURITY FIX (defense in depth): previously `{ ...DEFAULT_PROFILE,
// ...raw.profile }` copied every key present on a saved/synced profile
// object with no allow-list. Nothing in this app currently turns an
// arbitrary profile key into an XSS sink, but if Supabase Row Level
// Security on `user_data` were ever misconfigured (see the RLS migration
// and the audit note it closes), this was the mechanism by which a
// crafted/poisoned config from a DIFFERENT account could land unfiltered
// in someone's app state. Only keys that already exist on DEFAULT_PROFILE
// are ever copied across; anything else in a saved profile is silently
// dropped instead of merged in.
function pickKnownProfileFields(raw: Record<string, unknown>): Partial<typeof DEFAULT_PROFILE> {
  const picked: Record<string, unknown> = {};
  for (const key of Object.keys(DEFAULT_PROFILE)) {
    if (Object.prototype.hasOwnProperty.call(raw, key)) {
      picked[key] = (raw as Record<string, unknown>)[key];
    }
  }
  return picked as Partial<typeof DEFAULT_PROFILE>;
}

export function deserializeConfig(raw: any) {
  // Migration chain, oldest to newest, so nobody's already-set countdown
  // silently disappears when this shipped as multi-countdown:
  //  1. `countdowns` array (current shape) — used as-is if present.
  //  2. a single `countdown` object (the shape this shipped with initially)
  //     — wrapped into a one-item array.
  //  3. `profile.targetDate` (the very first version, before Settings had
  //     its own Countdown section at all) — wrapped into a one-item array.
  let migratedCountdowns: CountdownItem[] | null = null;
  if (!Array.isArray(raw?.countdowns)) {
    if (raw?.countdown && typeof raw.countdown === 'object' && raw.countdown.targetDate) {
      migratedCountdowns = [hydrateCountdown(raw.countdown)];
    } else if (typeof raw?.profile?.targetDate === 'string' && raw.profile.targetDate) {
      migratedCountdowns = [hydrateCountdown({
        targetDate: raw.profile.targetDate,
        label: raw?.profile?.targets?.[0]?.name || raw?.profile?.goalLabel || '',
      })];
    }
  }

  return {
    trackerItems: Array.isArray(raw?.trackerItems) && raw.trackerItems.length ? raw.trackerItems : DEFAULT_TRACKER_ITEMS,
    training: Array.isArray(raw?.training) && raw.training.length ? raw.training : DEFAULT_TRAINING,
    timeline: Array.isArray(raw?.timeline) && raw.timeline.length ? hydrateTimeline(raw.timeline) : hydrateTimeline(DEFAULT_TIMELINE_STORABLE),
    profile: raw?.profile && typeof raw.profile === 'object'
      ? {
          ...DEFAULT_PROFILE,
          ...pickKnownProfileFields(raw.profile),
          // Migration: pre-birthdate saves only have a static numeric
          // `age`. Back-calculate an approximate birthdate from it so age
          // starts auto-updating going forward instead of staying frozen.
          birthdate: typeof raw.profile.birthdate === 'string' && raw.profile.birthdate
            ? raw.profile.birthdate
            : typeof raw.profile.age === 'number'
            ? estimateBirthdateFromLegacyAge(raw.profile.age)
            : DEFAULT_PROFILE.birthdate,
        }
      : DEFAULT_PROFILE,
    subjects: hydrateSubjects(raw?.subjects, Array.isArray(raw?.syllabus) && raw.syllabus.length ? raw.syllabus : DEFAULT_SYLLABUS),
    syllabus: Array.isArray(raw?.syllabus) && raw.syllabus.length ? raw.syllabus : DEFAULT_SYLLABUS,
    countdowns: Array.isArray(raw?.countdowns)
      ? raw.countdowns.map((cd: any, i: number) => hydrateCountdown(cd, i))
      : (migratedCountdowns ?? DEFAULT_COUNTDOWNS),
    overviewOverrides: hydrateOverviewOverrides(raw?.overviewOverrides),
    diet: hydrateDiet(raw?.diet),
    dietOverrides: hydrateDietOverrides(raw?.dietOverrides),
    tabLabels: hydrateTabLabels(raw?.tabLabels),
    tabIcons: hydrateTabIcons(raw?.tabIcons),
    sectionLabels: hydrateSectionLabels(raw?.sectionLabels),
    domains: hydrateDomains(raw?.domains),
  };
}

export const CONFIG_STORAGE_KEY = 'app_config_v1';

// Shared icon palette for every "pick an icon" control in Settings — both
// the sidebar Tab Names & Icons editor and any per-tab sub-section editor
// (e.g. Dashboard Overview's cards) draw from this same set, referenced by
// a short string key so it can be stored in localStorage/JSON safely
// (React components can't be serialized, so we never store the icon itself).
export const ICON_OPTIONS: Record<string, any> = {
  layoutGrid: LayoutGrid,
  clock3: Clock3,
  dumbbell: Dumbbell,
  bookOpen: BookOpen,
  clipboardList: ClipboardList,
  timer: Timer,
  calendar: Calendar,
  settings: Settings,
  userCircle2: UserCircle2,
  target: Target,
  graduationCap: GraduationCap,
  flame: Flame,
  activity: Activity,
  trendingUp: TrendingUp,
  sparkles: Sparkles,
  crown: Crown,
  swords: Swords,
  shieldCheck: ShieldCheck,
  barChart3: BarChart3,
  music2: Music2,
  bell: Bell,
  checkCircle2: CheckCircle2,
  sun: Sun,
  moon: Moon,
  utensils: Utensils,
  droplets: Droplets,
  ruler: Ruler,
  weight: Weight,
  smile: Smile,
  eye: Eye,
  rotateCcw: RotateCcw,
  alertTriangle: AlertTriangle,
  listChecks: ListChecks,
};

export const ICON_OPTION_KEYS = Object.keys(ICON_OPTIONS);

// Tab names AND icons shown in the sidebar are user-editable (Settings >
// Tab Names & Icons), same "auto unless overridden" convention as
// OverviewOverrideKey above. Keyed by every sidebar destination — the 7
// TABS entries (defined further below) plus the two pinned Settings/Account
// buttons, which aren't in TABS since they're rendered separately at the
// bottom of the rail.
export type TabLabelKey = 'overview' | 'timeline' | 'training' | 'syllabus' | 'mocktests' | 'ashclock' | 'todo' | 'history' | 'settings' | 'account';

export const TAB_LABEL_KEYS: TabLabelKey[] = ['overview', 'timeline', 'training', 'syllabus', 'mocktests', 'ashclock', 'todo', 'history', 'settings', 'account'];

export const DEFAULT_TAB_LABELS: Record<TabLabelKey, string> = {
  overview: 'Dashboard Overview',
  timeline: 'Master Timeline',
  training: 'Training & Fuel',
  syllabus: 'Syllabus Roadmap',
  mocktests: 'Mock Test Tracker',
  ashclock: 'Clock',
  todo: 'To-Do List',
  history: 'Performance Calendar',
  settings: 'Settings',
  account: 'Account',
};

// Matches each tab's shipped icon (see TABS below, and the pinned
// Settings/Account buttons in the sidebar).
export const DEFAULT_TAB_ICONS: Record<TabLabelKey, string> = {
  overview: 'layoutGrid',
  timeline: 'clock3',
  training: 'dumbbell',
  syllabus: 'bookOpen',
  mocktests: 'clipboardList',
  ashclock: 'timer',
  todo: 'listChecks',
  history: 'calendar',
  settings: 'settings',
  account: 'userCircle2',
};

export function hydrateTabLabels(raw: any): Record<TabLabelKey, string> {
  const out = { ...DEFAULT_TAB_LABELS };
  if (raw && typeof raw === 'object') {
    for (const k of TAB_LABEL_KEYS) {
      if (typeof raw[k] === 'string' && raw[k].trim()) out[k] = raw[k];
    }
  }
  return out;
}

export function hydrateTabIcons(raw: any): Record<TabLabelKey, string> {
  const out = { ...DEFAULT_TAB_ICONS };
  if (raw && typeof raw === 'object') {
    for (const k of TAB_LABEL_KEYS) {
      if (typeof raw[k] === 'string' && ICON_OPTIONS[raw[k]]) out[k] = raw[k];
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Per-account goal domains (Phase 8 — Dynamic tab system).
//
// `null` means "unrestricted" — the account gets the full, unfiltered TABS
// list exactly like every account did before this phase existed. This is
// the default for every account today (nothing sets this field yet — see
// PHASE_8_HANDOFF.md), and it's also what a legacy/pre-onboarding account or
// a "Skip" onboarding account permanently gets, by design: dynamic tabs are
// only ever a *narrowing* that a real onboarding completion opts an account
// into, never something that can take a tab away from an account that
// already had it.
//
// A non-null value is a plain string array, not `GoalDomain[]`, on purpose:
// `GoalDomain` lives in questionnaire.ts, and questionnaire.ts already
// imports `TabLabelKey` from *this* file — importing `GoalDomain` back here
// would make the two files circularly depend on each other. Values stored
// here are always written from real `GoalDomain` values by whatever sets
// this field (Phase 9's onboarding wiring), so treating them as strings
// here and re-typing them as `GoalDomain[]` at the one or two call sites
// that resolve a tab set (App.tsx) is a safe, deliberate boundary, not a
// type-safety hole.
export const DEFAULT_DOMAINS: string[] | null = null;

export function hydrateDomains(raw: any): string[] | null {
  if (!Array.isArray(raw)) return DEFAULT_DOMAINS;
  const cleaned = raw.filter((d) => typeof d === 'string' && d.trim()).map((d) => d.trim());
  // An empty array is treated the same as "never set" — there's no such
  // thing as a real account with zero goal domains (the onboarding wizard's
  // intro screen requires picking at least one), so an empty array only
  // ever means corrupted/cleared data, and unrestricted is the safe default
  // for that case, same as `null`.
  return cleaned.length ? cleaned : DEFAULT_DOMAINS;
}

// Sections that live *inside* a tab which is itself shown for more than one
// domain (today, just 'training' — shown for either 'fitness' or 'diet',
// see DOMAIN_TAB_KEYS in questionnaire.ts) sometimes need finer-than-tab
// granularity: a diet-only account should see the Training & Fuel tab (for
// its Fuel Matrix) but not the workout-split section that tab also
// contains. `TAB_LABEL_KEYS`/`SECTION_LABEL_ROWS` above already have the
// per-section `tabKey` grouping this builds on. See
// `isSectionVisibleForDomains` in questionnaire.ts, which is the function
// that actually consumes this — kept there (not here) so every piece of
// "which domain needs which UI" logic lives in one place, next to
// DOMAIN_TAB_KEYS. NOT wired into TrainingFuelTab.tsx's actual JSX this
// phase — see PHASE_8_HANDOFF.md, "Not done this phase."
export const TRAINING_TAB_SECTION_KEYS = { workout: 'tf_workout', fuel: 'tf_fuel' } as const;

// Sub-section labels/icons — the named panels *inside* a tab (e.g. Dashboard
// Overview's "Profile", "Targets", "Today's Shape" cards). Each entry is
// keyed by a stable id prefixed with the tab it lives in ('ov_' = Dashboard
// Overview, 'tl_' = Timeline, 'tf_' = Training & Fuel, 'syl_' = Syllabus,
// 'mt_' = Mock Tests, 'ac_' = Account, 'hist_' = History, 'clk_' = Clock) so
// every tab's sub-sections can share this one map without id collisions.
// `group` is display-only metadata used to cluster rows by tab in Settings.
export const SECTION_LABEL_ROWS: { key: string; defaultLabel: string; defaultIcon: string; group: string; tabKey: TabLabelKey }[] = [
  // Dashboard Overview
  { key: 'ov_countdown', defaultLabel: 'Countdown', defaultIcon: 'target', group: 'Dashboard Overview', tabKey: 'overview' },
  { key: 'ov_profile', defaultLabel: 'Profile', defaultIcon: 'graduationCap', group: 'Dashboard Overview', tabKey: 'overview' },
  { key: 'ov_targets', defaultLabel: 'Targets', defaultIcon: 'target', group: 'Dashboard Overview', tabKey: 'overview' },
  { key: 'ov_shape', defaultLabel: "Today's Shape", defaultIcon: 'clock3', group: 'Dashboard Overview', tabKey: 'overview' },
  { key: 'ov_fuel', defaultLabel: 'Fuel Snapshot', defaultIcon: 'flame', group: 'Dashboard Overview', tabKey: 'overview' },
  { key: 'ov_syllabus', defaultLabel: 'Syllabus Runway', defaultIcon: 'calendar', group: 'Dashboard Overview', tabKey: 'overview' },
  // Timeline
  { key: 'tl_master', defaultLabel: 'Master Timeline', defaultIcon: 'clock3', group: 'Timeline', tabKey: 'timeline' },
  { key: 'tl_weight', defaultLabel: 'Body Weight Trend', defaultIcon: 'trendingUp', group: 'Timeline', tabKey: 'timeline' },
  // Training & Fuel
  { key: 'tf_workout', defaultLabel: 'Hybrid Vascularity Workout Split', defaultIcon: 'dumbbell', group: 'Training & Fuel', tabKey: 'training' },
  { key: 'tf_fuel', defaultLabel: 'Fuel Matrix', defaultIcon: 'flame', group: 'Training & Fuel', tabKey: 'training' },
  // Syllabus
  { key: 'syl_runway', defaultLabel: 'Syllabus Runway', defaultIcon: 'bookOpen', group: 'Syllabus', tabKey: 'syllabus' },
  { key: 'syl_revision', defaultLabel: 'Revision Due', defaultIcon: 'rotateCcw', group: 'Syllabus', tabKey: 'syllabus' },
  // Mock Tests
  { key: 'mt_log', defaultLabel: 'Log a Mock Test', defaultIcon: 'clipboardList', group: 'Mock Tests', tabKey: 'mocktests' },
  { key: 'mt_trend', defaultLabel: 'Score Trend', defaultIcon: 'barChart3', group: 'Mock Tests', tabKey: 'mocktests' },
  { key: 'mt_weak', defaultLabel: 'Weak Topic Priority', defaultIcon: 'alertTriangle', group: 'Mock Tests', tabKey: 'mocktests' },
  { key: 'mt_testlog', defaultLabel: 'Test Log', defaultIcon: 'clipboardList', group: 'Mock Tests', tabKey: 'mocktests' },
  // Clock
  { key: 'clk_subjecthours', defaultLabel: 'Subject Hours', defaultIcon: 'barChart3', group: 'Clock', tabKey: 'ashclock' },
  // History
  { key: 'hist_heatmap', defaultLabel: 'Execution Heatmap Analytics', defaultIcon: 'calendar', group: 'History', tabKey: 'history' },
  // Account
  { key: 'ac_account', defaultLabel: 'Account', defaultIcon: 'userCircle2', group: 'Account', tabKey: 'account' },
  { key: 'ac_backup', defaultLabel: 'Data Backup & Restore', defaultIcon: 'shieldCheck', group: 'Account', tabKey: 'account' },
];

export const DEFAULT_SECTION_LABELS: Record<string, { label: string; icon: string }> = SECTION_LABEL_ROWS.reduce(
  (acc, { key, defaultLabel, defaultIcon }) => ({ ...acc, [key]: { label: defaultLabel, icon: defaultIcon } }),
  {} as Record<string, { label: string; icon: string }>
);

export function hydrateSectionLabels(raw: any): Record<string, { label: string; icon: string }> {
  const out: Record<string, { label: string; icon: string }> = {};
  for (const { key, defaultLabel, defaultIcon } of SECTION_LABEL_ROWS) {
    const r = raw && typeof raw === 'object' ? raw[key] : null;
    out[key] = {
      label: r && typeof r.label === 'string' && r.label.trim() ? r.label : defaultLabel,
      icon: r && typeof r.icon === 'string' && ICON_OPTIONS[r.icon] ? r.icon : defaultIcon,
    };
  }
  return out;
}

export const ConfigContext = React.createContext<{
  trackerItems: any[];
  timeline: any[];
  training: any[];
  profile: any;
  subjects: any[];
  syllabus: any[];
  countdowns: CountdownItem[];
  overviewOverrides: Record<OverviewOverrideKey, string>;
  diet: DietMeal[];
  dietOverrides: Record<DietOverrideKey, string>;
  tabLabels: Record<TabLabelKey, string>;
  tabIcons: Record<TabLabelKey, string>;
  sectionLabels: Record<string, { label: string; icon: string }>;
  domains: string[] | null;
  updateConfig: (partial: Record<string, any>) => void;
  resetConfigSection: (key: 'trackerItems' | 'timeline' | 'training' | 'profile' | 'subjects' | 'syllabus' | 'countdowns' | 'overviewOverrides' | 'diet' | 'dietOverrides' | 'tabLabels' | 'tabIcons' | 'sectionLabels' | 'domains') => void;
}>({
  trackerItems: DEFAULT_TRACKER_ITEMS,
  timeline: hydrateTimeline(DEFAULT_TIMELINE_STORABLE),
  training: DEFAULT_TRAINING,
  profile: DEFAULT_PROFILE,
  subjects: DEFAULT_SUBJECTS,
  syllabus: DEFAULT_SYLLABUS,
  countdowns: DEFAULT_COUNTDOWNS,
  overviewOverrides: DEFAULT_OVERVIEW_OVERRIDES,
  diet: hydrateDiet(DEFAULT_DIET_STORABLE),
  dietOverrides: DEFAULT_DIET_OVERRIDES,
  tabLabels: DEFAULT_TAB_LABELS,
  tabIcons: DEFAULT_TAB_ICONS,
  sectionLabels: DEFAULT_SECTION_LABELS,
  domains: DEFAULT_DOMAINS,
  updateConfig: () => {},
  resetConfigSection: () => {},
});

// ---------- Hunter Rank Progression (Solo Leveling-flavored meta layer) ----------
// Rank climbs permanently based on total lifetime days where every single
// Daily Matrix objective was hit — a slow-burn reward tied to real consistency,
// not just today's percentage.
export const HUNTER_RANKS = [
  { rank: 'E', threshold: 0, label: 'E-Rank Hunter', color: '#94a3b8' },
  { rank: 'D', threshold: 5, label: 'D-Rank Hunter', color: '#38bdf8' },
  { rank: 'C', threshold: 15, label: 'C-Rank Hunter', color: '#22d3ee' },
  { rank: 'B', threshold: 30, label: 'B-Rank Hunter', color: '#a78bfa' },
  { rank: 'A', threshold: 60, label: 'A-Rank Hunter', color: '#fbbf24' },
  { rank: 'S', threshold: 100, label: 'S-Rank — Shadow Monarch', color: '#f472b6' },
];
export type HunterRank = typeof HUNTER_RANKS[number];


export function getHunterRank(clearedDays: number): HunterRank {
  let current = HUNTER_RANKS[0];
  for (const r of HUNTER_RANKS) {
    if (clearedDays >= r.threshold) current = r;
  }
  return current;
}

// Counts consecutive fully-cleared days leading up to today. If today isn't
// finished yet, it doesn't break the streak — it just isn't counted yet,
// so the flame doesn't die mid-afternoon just because the day is in progress.
export function computeCurrentStreak(globalHistory, todayStr, trackerItems = DEFAULT_TRACKER_ITEMS) {
  const isDayComplete = (dateStr) => {
    const dayObj = globalHistory[dateStr];
    return !!dayObj && trackerItems.every((item) => dayObj[item.id]);
  };

  let streak = 0;
  const cursor = new Date(todayStr + 'T00:00:00');
  if (!isDayComplete(todayStr)) {
    cursor.setDate(cursor.getDate() - 1);
  }

  while (true) {
    const dStr = getLocalDateString(cursor);
    if (!isDayComplete(dStr)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

export const TABS = [
  { id: 'overview', label: 'Dashboard Overview', icon: LayoutGrid },
  { id: 'timeline', label: 'Master Timeline', icon: Clock3 },
  { id: 'training', label: 'Training & Fuel', icon: Dumbbell },
  { id: 'syllabus', label: 'Syllabus Roadmap', icon: BookOpen },
  { id: 'mocktests', label: 'Mock Test Tracker', icon: ClipboardList },
  { id: 'ashclock', label: 'Clock', icon: Timer },
  { id: 'todo', label: 'To-Do List', icon: ListChecks },
  { id: 'history', label: 'Performance Calendar', icon: Calendar },
];

// Subject color is stored as a *name* (e.g. 'sky'), never a raw Tailwind
// class — Tailwind can't resolve a dynamically built string like
// `text-${color}-400`, so every place that used to index into a hardcoded
// SUBJECT_STYLE map now calls getSubjectStyle(key, subjects) instead, which
// looks the chosen color up in this fixed palette. Same 'color name' idea
// generateProfileTargets() already uses for targets[].color.
//
// 'sky', 'violet', and 'fuchsia' are deliberately plain `indigo-*`/
// `violet-*`/`fuchsia-*` classes (not arbitrary-hex `text-[#...]` classes)
// — those three Tailwind scales are the ones tailwind.config.js points at
// theme-aware CSS variables (see index.css), so a subject someone colored
// "violet" now re-hues right along with the rest of the app's brand accent
// whenever the Appearance theme changes, the same as everything else built
// from these scales. amber/emerald/rose stay literal on purpose — they're
// genuinely distinct status colors (due/fresh/overdue elsewhere use these
// same hues), not brand accent, so they should stay put across themes.
export const SUBJECT_COLOR_PALETTE: Record<string, { text: string; bg: string; border: string; dot: string }> = {
  sky:      { text: 'text-indigo-400',   bg: 'bg-indigo-500/10',   border: 'border-indigo-500/30',   dot: 'bg-indigo-400' },
  violet:   { text: 'text-violet-400',   bg: 'bg-violet-500/10',   border: 'border-violet-500/30',   dot: 'bg-violet-400' },
  fuchsia:  { text: 'text-fuchsia-400',  bg: 'bg-fuchsia-500/10',  border: 'border-fuchsia-500/30',  dot: 'bg-fuchsia-400' },
  amber:    { text: 'text-amber-400',    bg: 'bg-amber-500/10',    border: 'border-amber-500/30',    dot: 'bg-amber-400' },
  emerald:  { text: 'text-emerald-400',  bg: 'bg-emerald-500/10',  border: 'border-emerald-500/30',  dot: 'bg-emerald-400' },
  rose:     { text: 'text-rose-400',     bg: 'bg-rose-500/10',     border: 'border-rose-500/30',     dot: 'bg-rose-400' },
};

export function getSubjectStyle(key: string, subjects: { key: string; color: string }[]) {
  const found = subjects.find((s) => s.key === key);
  return SUBJECT_COLOR_PALETTE[found?.color || 'sky'];
}

// Hex counterparts of SUBJECT_COLOR_PALETTE for contexts (raw SVG
// stroke/fill attributes) where a Tailwind class string doesn't apply.
// These read the *same* theme-aware CSS variables as the classes above
// (`rgb(var(--indigo-400))` etc.) rather than a frozen hex literal, so an
// inline SVG stroke picks up the live theme too instead of freezing at
// whatever the colorful default happened to be. sky now correctly points
// at the indigo variable (matching its text/dot classes above) instead of
// the previous literal `#38bdf8`, which was real Tailwind `sky` blue — a
// leftover mismatch from before "sky" was renamed to mean indigo.
export const SUBJECT_COLOR_HEX: Record<string, string> = {
  sky: 'rgb(var(--indigo-400))',
  violet: 'rgb(var(--violet-400))',
  fuchsia: 'rgb(var(--fuchsia-400))',
  amber: '#fbbf24',
  emerald: '#34d399',
  rose: '#fb7185',
};

export function getSubjectHex(key: string, subjects: { key: string; color: string }[]) {
  const found = subjects.find((s) => s.key === key);
  return SUBJECT_COLOR_HEX[found?.color || 'sky'];
}

// Same 'stored as a name' convention as SUBJECT_COLOR_PALETTE, but with a
// wider set — countdowns often sit side by side in one card, so more
// variants means less chance two active targets look identical.
export const COUNTDOWN_COLOR_PALETTE: Record<string, { text: string; tileBg: string; tileBorder: string; barBg: string; dot: string }> = {
  // sky/violet/fuchsia use plain theme-aware classes now (see
  // SUBJECT_COLOR_PALETTE above for why) instead of pinned arbitrary-hex
  // ones — a countdown colored "violet" re-hues with the rest of the brand
  // accent when the theme changes. The literal 'indigo' entry further down
  // already did this; sky/violet/fuchsia were just inconsistent with it.
  sky:      { text: 'text-indigo-400',   tileBg: 'bg-indigo-500/[0.03]',   tileBorder: 'border-indigo-500/20',   barBg: 'bg-indigo-500/60',   dot: 'bg-indigo-400' },
  violet:   { text: 'text-violet-400',   tileBg: 'bg-violet-500/[0.03]',   tileBorder: 'border-violet-500/20',   barBg: 'bg-violet-500/60',   dot: 'bg-violet-400' },
  fuchsia:  { text: 'text-fuchsia-400',  tileBg: 'bg-fuchsia-500/[0.03]',  tileBorder: 'border-fuchsia-500/20',  barBg: 'bg-fuchsia-500/60',  dot: 'bg-fuchsia-400' },
  amber:    { text: 'text-amber-400',    tileBg: 'bg-amber-500/[0.03]',    tileBorder: 'border-amber-500/20',    barBg: 'bg-amber-500/60',    dot: 'bg-amber-400' },
  emerald:  { text: 'text-emerald-400',  tileBg: 'bg-emerald-500/[0.03]',  tileBorder: 'border-emerald-500/20',  barBg: 'bg-emerald-500/60',  dot: 'bg-emerald-400' },
  rose:     { text: 'text-rose-400',     tileBg: 'bg-rose-500/[0.03]',     tileBorder: 'border-rose-500/20',     barBg: 'bg-rose-500/60',     dot: 'bg-rose-400' },
  cyan:     { text: 'text-cyan-400',     tileBg: 'bg-cyan-500/[0.03]',     tileBorder: 'border-cyan-500/20',     barBg: 'bg-cyan-500/60',     dot: 'bg-cyan-400' },
  orange:   { text: 'text-orange-400',   tileBg: 'bg-orange-500/[0.03]',   tileBorder: 'border-orange-500/20',   barBg: 'bg-orange-500/60',   dot: 'bg-orange-400' },
  lime:     { text: 'text-lime-400',     tileBg: 'bg-lime-500/[0.03]',     tileBorder: 'border-lime-500/20',     barBg: 'bg-lime-500/60',     dot: 'bg-lime-400' },
  pink:     { text: 'text-pink-400',     tileBg: 'bg-pink-500/[0.03]',     tileBorder: 'border-pink-500/20',     barBg: 'bg-pink-500/60',     dot: 'bg-pink-400' },
  indigo:   { text: 'text-indigo-400',   tileBg: 'bg-indigo-500/[0.03]',   tileBorder: 'border-indigo-500/20',   barBg: 'bg-indigo-500/60',   dot: 'bg-indigo-400' },
  teal:     { text: 'text-teal-400',     tileBg: 'bg-teal-500/[0.03]',     tileBorder: 'border-teal-500/20',     barBg: 'bg-teal-500/60',     dot: 'bg-teal-400' },
};

export const COUNTDOWN_COLOR_NAMES = Object.keys(COUNTDOWN_COLOR_PALETTE);

export function getCountdownColor(name?: string) {
  return COUNTDOWN_COLOR_PALETTE[name || 'sky'] || COUNTDOWN_COLOR_PALETTE.sky;
}

// ---------- Helper Functions for Date & LocalStorage ----------

export const getLocalDateString = (date = new Date()) => {
  const offset = date.getTimezoneOffset();
  const localizedDate = new Date(date.getTime() - (offset * 60 * 1000));
  return localizedDate.toISOString().split('T')[0];
};

export const getDayName = (dateStr) => {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'long' });
};

export const pad2 = (n: number) => String(Math.max(0, n)).padStart(2, '0');

// Derives a whole-years age from a 'YYYY-MM-DD' birthdate, as of today.
// Returns null for anything blank/unparseable so callers can show a
// friendly placeholder instead of "NaN-year-old".
export function calculateAge(birthdate: string | undefined | null): number | null {
  if (!birthdate || !/^\d{4}-\d{2}-\d{2}$/.test(birthdate)) return null;
  const birth = new Date(birthdate + 'T00:00:00');
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const hasHadBirthdayThisYear =
    today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age >= 0 ? age : null;
}

// One-way migration for accounts saved before `birthdate` existed: they only
// have a static `age` number, which would otherwise never update again. We
// back-calculate an approximate birthdate (today minus that many years) so
// age starts auto-updating from here on, instead of staying frozen forever.
export function estimateBirthdateFromLegacyAge(age: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - age);
  return getLocalDateString(d);
}

// Precise, ticking countdown to an exact date+time (not just a day count).
// >= 24h remaining  -> "DD:HH:MM" (days:hours:minutes)
// <  24h remaining  -> "HH:MM:SS" (hours:minutes:seconds), ticks live
export function getPreciseCountdown(targetDateStr: string, targetTimeStr: string, nowMs: number) {
  const time = /^\d{2}:\d{2}$/.test(targetTimeStr || '') ? targetTimeStr : '00:00';
  const targetMs = new Date(`${targetDateStr}T${time}:00`).getTime();
  const diffMs = targetMs - nowMs;

  if (!targetDateStr || Number.isNaN(targetMs)) return null;

  if (diffMs <= 0) {
    return { expired: true, mode: 'hms' as const, text: '00:00:00', days: 0, hours: 0, minutes: 0, seconds: 0, targetMs, diffMs: 0 };
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (diffMs >= 24 * 60 * 60 * 1000) {
    return { expired: false, mode: 'dhm' as const, text: `${pad2(days)}:${pad2(hours)}:${pad2(minutes)}`, days, hours, minutes, seconds, targetMs, diffMs };
  }
  return { expired: false, mode: 'hms' as const, text: `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`, days, hours, minutes, seconds, targetMs, diffMs };
}

// ---------- Fluid Interaction Engine ----------
// Dependency-free primitives that give every tap/click a soft expanding
// ripple, and give the whole app a lagging "magnetic" cursor that swells
// over anything interactive — the same language used across lusion.co.