import { supabase } from './supabaseClient';
import type {
  DietDomainAnswers, DietType, DietGoal, ActivityLevel,
  FitnessDomainAnswers, FitnessGoalType, ExperienceLevel, EquipmentAccess,
  ExamDomainAnswers, ExamCurrentLevel,
} from './questionnaire';
import { MAX_DIET_MEALS, ICON_LIBRARY_KEYS, estimateItemNutrition, SUBJECT_COLOR_PALETTE } from './appConfig';

// ---------- Hidden content generation ----------
// Not surfaced to the user as an "AI" feature — it's just how the app fills
// in real detail (chapter breakdowns, exercise form guides, starter goals)
// whenever a user adds something of their own instead of using the built-in
// defaults. Everything is cached locally *and* through the same cloud-sync
// mechanism as the rest of the app's data (see CONTENT_CACHE_KEY wired into
// cloudSync.ts's SYNC_KEYS), so a topic/exercise is only ever generated once
// per account, even across devices.

export const CONTENT_CACHE_KEY = 'dcc_content_cache_v1';

type CacheShape = Record<string, any>;

function readCache(): CacheShape {
  try {
    return JSON.parse(localStorage.getItem(CONTENT_CACHE_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeCache(cache: CacheShape) {
  try {
    localStorage.setItem(CONTENT_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.error('[contentGen] failed to write cache', e);
  }
}

function cacheKey(kind: string, input: string) {
  return `${kind}:${input.trim().toLowerCase()}`;
}

/**
 * Calls the generate-content Edge Function for a given "kind" + input,
 * caching the result so repeat lookups (or the same topic added by the
 * same user twice) never hit the network again.
 *
 * Returns null on any failure — callers should fall back to a generic
 * default rather than blocking the UI on a network hiccup.
 */
async function generate(kind: string, input: string, context?: string): Promise<any | null> {
  const cache = readCache();
  const key = cacheKey(kind, input);
  if (cache[key]) return cache[key];

  try {
    const { data, error } = await supabase.functions.invoke('generate-content', {
      body: { kind, input, context },
    });
    if (error) throw error;
    if (!data?.data) return null;

    cache[key] = data.data;
    writeCache(cache);
    return data.data;
  } catch (e) {
    console.error(`[contentGen] generation failed for ${kind}:"${input}"`, e);
    return null;
  }
}

export function generateTopicDetails(topicName: string, subjectContext?: string) {
  return generate('topic', topicName, subjectContext) as Promise<
    { chapters: string[]; focus: string[] } | null
  >;
}

export function generateExerciseGuide(exerciseName: string, context?: string) {
  return generate('exercise', exerciseName, context) as Promise<
    { target: string; instructions: string[]; cues: string } | null
  >;
}

export function generateProfileTargets(goalDescription: string) {
  return generate('profile-targets', goalDescription) as Promise<
    {
      targets: { rank: number; name: string; course: string; tag: string; color: string; desc: string }[];
      baselineLabel: string;
    } | null
  >;
}

export function generateHealthPlan(issue: string, context?: string) {
  return generate('health-plan', issue, context) as Promise<
    { plan: string; details: string[]; tag: string } | null
  >;
}

// ---------- Onboarding content generation ----------
// Powers the first-run questionnaire (OnboardingWizard). Same generate() +
// cache pattern as everything above — each "kind" below needs a matching
// branch in the generate-content Edge Function. Every one of these is keyed
// by the user's own goal description, so two different accounts typing two
// different goals get two entirely different results; nothing here is
// shared or hardcoded per account.
//
// Icon names must come from the app's ICON_LIBRARY (defined in App.tsx).
// Kept as a duplicate list here — rather than importing from App.tsx, which
// would create a circular import — the same way SYNC_KEYS above is kept in
// manual sync with DataBackupCard's export list. If ICON_LIBRARY ever
// changes, update this too.
export const TIMELINE_ICON_OPTIONS = [
  'Sunrise', 'Sun', 'Moon', 'BookOpen', 'Utensils', 'Dumbbell', 'Timer',
  'Sparkles', 'Target', 'Flame', 'Activity', 'Droplets', 'Bell',
  'ClipboardList', 'Music2',
] as const;

/**
 * Generates the "Daily Checklist Items" list (the tracker sidebar) from a
 * free-text goal description. Returns objects without an `id` — the caller
 * assigns ids (e.g. `custom_${i}`) since these need to be stable across
 * saves, not something a generation call should own.
 */
export function generateChecklist(goalDescription: string, context?: string) {
  return generate('onboarding-checklist', goalDescription, context) as Promise<
    { items: { label: string }[] } | null
  >;
}

/**
 * Generates a full day's timeline (wake to sleep) matching the shape the
 * Master Timeline tab and its editor already expect. `context` should carry
 * the user's stated wake/sleep times and any other constraints so blocks
 * land inside their actual day rather than a generic one.
 */
export function generateDailyTimeline(goalDescription: string, context?: string) {
  return generate('onboarding-timeline', goalDescription, context) as Promise<
    {
      blocks: {
        start: string; end: string; label: string; detail: string;
        type: 'study' | 'gym' | 'meal' | 'prep' | 'sleep';
        subject?: string; longDesc: string; iconName: string;
      }[];
    } | null
  >;
}

/**
 * Generates a weekly training split matching the Training & Fuel tab's
 * shape. If the person's goal has nothing to do with physical training,
 * the caller should skip this entirely rather than force a workout plan
 * on someone who never asked for one.
 */
export function generateWeeklyTraining(goalDescription: string, context?: string) {
  return generate('onboarding-training', goalDescription, context) as Promise<
    {
      days: {
        day: string; focus: string; mode: 'gym' | 'calisthenics' | 'rest';
        exercises: { name: string; sets: string }[];
      }[];
    } | null
  >;
}

/**
 * Generates a subject roadmap (subjects + month-by-month phases + topics
 * per subject) for whatever the person is studying toward — not assumed to
 * be any particular exam. Used by the Syllabus Roadmap tab. If the goal
 * has no "subjects to study" component at all, the caller should skip this.
 */
export function generateSyllabus(goalDescription: string, context?: string) {
  return generate('onboarding-syllabus', goalDescription, context) as Promise<
    {
      subjects: { key: string; label: string; color: string }[];
      phases: { phase: number; month: string; label: string; subjects: Record<string, string[]> }[];
    } | null
  >;
}

// ---------------------------------------------------------------------------
// Phase 5 — diet / calorie / macro generation
//
// Everything below is new this phase. See PHASE_5_HANDOFF.md for the full
// writeup; the short version:
//
// - calculateDietTargets() is a pure, synchronous, offline calorie/protein/
//   hydration estimator. It ALWAYS produces real numbers, never null —
//   diet targets are load-bearing (people plan their day around them), not
//   generic placeholder text, so unlike every fallback* helper in
//   OnboardingWizard.tsx (checklist/timeline/training/etc., which show an
//   honest "Generic — not generated" badge), this phase treats the numeric
//   targets as something that should never be allowed to fail outright.
// - buildFallbackDietPlan() builds a real, dietType-aware set of meals
//   entirely locally (no network), scaled toward calculateDietTargets()'s
//   resolved calories using the same nutrition estimator appConfig.ts's
//   Fuel Matrix already relies on (estimateItemNutrition). This is the
//   "offline/API down" path for the *meals* specifically.
// - generateDietPlan() ties both together: always resolves with real
//   targets and real meals, and reports via `usedFallback` whether the
//   meals came from the AI or from the local template so a future caller
//   (Phase 9) can still show the same kind of "Generic — not generated"
//   badge the other sections use, without the numeric targets themselves
//   ever being blocked on that.
// ---------------------------------------------------------------------------

// ---- 1. Deterministic calorie/protein/hydration targets ----
//
// Deliberately simple, documented rule-of-thumb estimates — not a
// clinical formula like Mifflin-St Jeor (which needs height/age/sex, not
// reliably collected here) — same "lightweight, always-overridable" spirit
// as computeDietAutoValues in appConfig.ts (which estimates calories the
// OTHER direction, out of a person's own already-logged meals, rather than
// as a target to hit before any meals exist).

const FALLBACK_WEIGHT_KG = 65; // matches DEFAULT_PROFILE.weight in appConfig.ts

// Rough "kcal per kg bodyweight per day" maintenance estimate by activity
// level — a common bodybuilding-style rule of thumb, intentionally coarse.
const MAINTENANCE_KCAL_PER_KG: Record<ActivityLevel, number> = {
  sedentary: 26,
  light: 28,
  moderate: 31,
  'very-active': 34,
  'extra-active': 38,
};

// kcal/day adjustment layered on top of the maintenance estimate, per diet
// goal (standard surplus/deficit sizing; recomp uses a small deficit).
const GOAL_KCAL_ADJUST: Record<DietGoal, number> = {
  bulk: 350,
  cut: -450,
  maintain: 0,
  recomp: -200,
};

// Grams of protein per kg bodyweight, per diet goal — cut/recomp lean
// higher to protect lean mass in a deficit, per standard guidance.
const GOAL_PROTEIN_G_PER_KG: Record<DietGoal, number> = {
  bulk: 1.8,
  cut: 2.2,
  maintain: 1.6,
  recomp: 2.0,
};

export type DietTargets = {
  calories: number;
  proteinG: number;
  hydrationL: number;
  // true when the person typed an explicit targetCalories in the
  // questionnaire — that number is then respected verbatim, never
  // overridden by the auto-estimate, matching the original request's
  // "2700kcal vegetarian" example and DietDomainAnswers's documented
  // targetCalories convention (null = auto-calculate).
  isExplicitCalories: boolean;
};

/**
 * Resolves real calorie/protein/hydration numbers from a DietDomainAnswers
 * block. Pure and synchronous — no network, never fails, never returns
 * null. Exported on its own (not just used internally by generateDietPlan)
 * so a future caller can show a target instantly, before any AI call even
 * starts.
 */
export function calculateDietTargets(answers: DietDomainAnswers, profileWeightKg?: number): DietTargets {
  const weight = profileWeightKg && profileWeightKg > 0 ? profileWeightKg : FALLBACK_WEIGHT_KG;

  const isExplicitCalories = typeof answers.targetCalories === 'number' && answers.targetCalories > 0;
  const autoCalories = Math.round((weight * MAINTENANCE_KCAL_PER_KG[answers.activityLevel] + GOAL_KCAL_ADJUST[answers.dietGoal]) / 25) * 25;
  const calories = isExplicitCalories ? (answers.targetCalories as number) : Math.max(1200, autoCalories);

  const proteinG = Math.round(weight * GOAL_PROTEIN_G_PER_KG[answers.dietGoal]);

  // Same 35ml/kg baseline computeDietAutoValues (appConfig.ts) uses for
  // hydration — duplicated as one line rather than imported, since that
  // function computes hydration from already-logged meals (opposite
  // direction) and takes a different shape of input (DietMeal[]).
  const hydrationL = Math.round(weight * 0.035 * 2) / 2;

  return { calories, proteinG, hydrationL, isExplicitCalories };
}

// ---- 2. Local, dietType-aware fallback meal templates ----
//
// One reference ~2200kcal-day template per DietType, same six meal-slot
// structure (time-of-day + icon) as DEFAULT_DIET_MEALS_RAW in
// appConfig.ts, just swapped for foods that actually fit each preference.
// buildFallbackDietPlan() scales these toward the resolved target calories
// below, rather than using them verbatim.

export type DietPlanMeal = { time: string; name: string; items: string[]; iconName: string };

const NON_VEG_TEMPLATE: DietPlanMeal[] = [
  { time: '05:00 AM', name: 'Pre-Breakfast', items: ['Warm water + lemon + 1 tsp chia seeds', '2 tbsp sattu drink'], iconName: 'Sunrise' },
  { time: '08:30 AM', name: 'Breakfast', items: ['4 whole eggs + 3 egg whites', '60g oats in water', '1 banana'], iconName: 'Sun' },
  { time: '01:00 PM', name: 'Lunch', items: ['200g grilled chicken breast', '2 rotis', '1 bowl dal', 'large mixed salad'], iconName: 'Dumbbell' },
  { time: '04:30 PM', name: 'Midday Snack', items: ['200g curd', '1 apple', '15 almonds'], iconName: 'Sun' },
  { time: '08:00 PM', name: 'Dinner', items: ['150g chicken breast', 'vegetable stew', 'green salad'], iconName: 'Moon' },
  { time: '10:00 PM', name: 'Night Snack', items: ['250ml milk', '30g roasted chana'], iconName: 'Moon' },
];

const VEGETARIAN_TEMPLATE: DietPlanMeal[] = [
  { time: '05:00 AM', name: 'Pre-Breakfast', items: ['Warm water + lemon + 1 tsp chia seeds', '2 tbsp sattu drink'], iconName: 'Sunrise' },
  { time: '08:30 AM', name: 'Breakfast', items: ['200g curd', '60g oats in water', '1 banana', '10 almonds'], iconName: 'Sun' },
  { time: '01:00 PM', name: 'Lunch', items: ['150g paneer', '2 rotis', '1 bowl dal', 'large mixed salad'], iconName: 'Dumbbell' },
  { time: '04:30 PM', name: 'Midday Snack', items: ['200g curd', '1 apple', '15 almonds'], iconName: 'Sun' },
  { time: '08:00 PM', name: 'Dinner', items: ['150g paneer', '1 bowl dal', 'vegetable stew', 'green salad'], iconName: 'Moon' },
  { time: '10:00 PM', name: 'Night Snack', items: ['250ml milk', '30g roasted chana'], iconName: 'Moon' },
];

const EGGETARIAN_TEMPLATE: DietPlanMeal[] = [
  VEGETARIAN_TEMPLATE[0],
  { time: '08:30 AM', name: 'Breakfast', items: ['3 whole eggs', '60g oats in water', '1 banana'], iconName: 'Sun' },
  VEGETARIAN_TEMPLATE[2],
  VEGETARIAN_TEMPLATE[3],
  VEGETARIAN_TEMPLATE[4],
  VEGETARIAN_TEMPLATE[5],
];

const PESCATARIAN_TEMPLATE: DietPlanMeal[] = [
  VEGETARIAN_TEMPLATE[0],
  VEGETARIAN_TEMPLATE[1],
  { time: '01:00 PM', name: 'Lunch', items: ['200g grilled fish', '2 rotis', '1 bowl dal', 'large mixed salad'], iconName: 'Dumbbell' },
  VEGETARIAN_TEMPLATE[3],
  { time: '08:00 PM', name: 'Dinner', items: ['150g grilled fish', 'vegetable stew', 'green salad'], iconName: 'Moon' },
  VEGETARIAN_TEMPLATE[5],
];

const VEGAN_TEMPLATE: DietPlanMeal[] = [
  { time: '05:00 AM', name: 'Pre-Breakfast', items: ['Warm water + lemon + 1 tsp chia seeds', '2 tbsp sattu drink'], iconName: 'Sunrise' },
  { time: '08:30 AM', name: 'Breakfast', items: ['60g oats in water', '1 banana', '30g peanut butter'], iconName: 'Sun' },
  { time: '01:00 PM', name: 'Lunch', items: ['150g tofu', '2 rotis', '1 bowl dal', 'large mixed salad'], iconName: 'Dumbbell' },
  { time: '04:30 PM', name: 'Midday Snack', items: ['1 apple', '20 almonds', '15 peanuts'], iconName: 'Sun' },
  { time: '08:00 PM', name: 'Dinner', items: ['150g soy chunks', '1 bowl dal', 'vegetable stew', 'green salad'], iconName: 'Moon' },
  { time: '10:00 PM', name: 'Night Snack', items: ['30g roasted chana', 'water'], iconName: 'Moon' },
];

const DIET_MEAL_TEMPLATES: Record<DietType, DietPlanMeal[]> = {
  'non-vegetarian': NON_VEG_TEMPLATE,
  'no-preference': NON_VEG_TEMPLATE, // no restriction stated -> widest/reference template
  vegetarian: VEGETARIAN_TEMPLATE,
  eggetarian: EGGETARIAN_TEMPLATE,
  pescatarian: PESCATARIAN_TEMPLATE,
  vegan: VEGAN_TEMPLATE,
};

// Scales the leading quantity in a single item string (e.g. "200g grilled
// chicken breast" -> "240g grilled chicken breast" at scale 1.2). Whole-
// count items with no unit (eggs, rotis, almonds…) round to the nearest
// whole number; gram/ml amounts round to the nearest 5; kg/l round to the
// nearest 0.1. Leaves anything without a leading number untouched.
function scaleQuantityInText(text: string, scale: number): string {
  const trimmed = text.trim();
  // Phase 10 Part 2 bugfix: the whitespace between the number and its unit
  // word is now captured (group 2) and echoed back in the output, instead
  // of being silently swallowed. This was invisible for gram/ml items
  // ("200g grilled chicken" has no space to lose in the first place) but
  // corrupted every space-separated whole-count/volume item ("2 tbsp sattu
  // drink" -> "2tbsp sattu drink", "1 banana" -> "1banana", "3 whole eggs"
  // -> "3whole eggs") in every diet fallback plan, for every diet-including
  // account, regardless of scale (reproduces even at scale ~1) — found
  // while extending Phase 9 Part 3's diet-only trace with new edge cases
  // per Phase 10's instructions.
  const m = /^(\d+(?:\.\d+)?)(\s*)([a-zA-Z]*)/.exec(trimmed);
  if (!m) return text;
  const num = parseFloat(m[1]);
  if (!num) return text;
  const sep = m[2] || '';
  const unit = m[3] || '';
  const unitLower = unit.toLowerCase();
  const rest = trimmed.slice(m[0].length);
  const scaled = num * scale;

  let rounded: number;
  if (['kg', 'l', 'litre', 'liter'].includes(unitLower)) {
    rounded = Math.max(0.1, Math.round(scaled * 10) / 10);
  } else if (['g', 'gram', 'grams', 'ml'].includes(unitLower)) {
    rounded = Math.max(5, Math.round(scaled / 5) * 5);
  } else {
    rounded = Math.max(1, Math.round(scaled));
  }
  return `${rounded}${sep}${unit}${rest}`;
}

// Drops any item containing a comma-separated allergy/dislike keyword the
// person typed (case-insensitive substring match, same "generator's job to
// parse" convention DietDomainAnswers.allergiesOrDislikes documents). If
// filtering would leave a meal with zero items, a neutral placeholder is
// left instead of an empty meal — editable directly in Settings afterward.
function filterAllergies(items: string[], allergiesOrDislikes: string): string[] {
  const banned = allergiesOrDislikes.toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
  if (!banned.length) return items;
  const filtered = items.filter((item) => !banned.some((b) => item.toLowerCase().includes(b)));
  return filtered.length ? filtered : ['Chef\u2019s choice — adjust to taste in Settings'];
}

/**
 * Builds a real, dietType-aware diet plan entirely locally (no network) —
 * the fallback path for when AI generation isn't available. Starts from
 * the matching template above, sums its calories with the same
 * estimateItemNutrition() the Fuel Matrix already uses, then scales every
 * item's quantity toward the resolved target calories (clamped to a
 * 0.4x-2.2x range so an extreme target never produces an absurd portion),
 * and finally drops anything matching a stated allergy/dislike.
 */
export function buildFallbackDietPlan(answers: DietDomainAnswers, targets: DietTargets): DietPlanMeal[] {
  const template = DIET_MEAL_TEMPLATES[answers.dietType] ?? NON_VEG_TEMPLATE;
  const templateCalories = template.reduce(
    (sum, meal) => sum + meal.items.reduce((s, it) => s + estimateItemNutrition(it).cal, 0),
    0,
  );
  const rawScale = templateCalories > 0 ? targets.calories / templateCalories : 1;
  const scale = Math.min(2.2, Math.max(0.4, rawScale));

  return template.map((meal) => ({
    time: meal.time,
    name: meal.name,
    items: filterAllergies(meal.items.map((it) => scaleQuantityInText(it, scale)), answers.allergiesOrDislikes),
    iconName: meal.iconName,
  }));
}

// ---- 3. AI generation, tying targets + fallback together ----

/**
 * Composes the structured description sent to the `generate-content` edge
 * function for `kind: 'onboarding-diet'`. Deliberately its own function
 * rather than reusing questionnaire.ts's private describeDiet() (that one
 * isn't exported, and Phase 3's file is intentionally left untouched this
 * phase) — this version also folds in the *resolved* numeric targets from
 * calculateDietTargets(), so the AI is told the exact calorie/protein
 * numbers to hit rather than having to infer or recompute them itself.
 */
function describeDietForGeneration(answers: DietDomainAnswers, targets: DietTargets): string {
  const parts = [
    `Diet type: ${answers.dietType.replace(/-/g, ' ')}`,
    `Goal: ${answers.dietGoal}`,
    `Target calories: ${targets.calories}kcal/day${
      targets.isExplicitCalories
        ? ' (user-specified — respect this exact number, do not substitute your own estimate)'
        : ' (auto-estimated — reasonable to fine-tune slightly if the plan clearly needs it)'
    }`,
    `Target protein: ~${targets.proteinG}g/day`,
    `Activity level: ${answers.activityLevel.replace(/-/g, ' ')}`,
  ];
  if (answers.allergiesOrDislikes.trim()) parts.push(`Avoid: ${answers.allergiesOrDislikes.trim()}`);
  return parts.join('. ');
}

export type DietPlanResult = {
  meals: DietPlanMeal[];
  targetCalories: number;
  targetProteinG: number;
  targetHydrationL: number;
  // true if `meals` came from buildFallbackDietPlan() rather than the AI —
  // a future caller (Phase 9) can use this exactly like OnboardingWizard's
  // existing `usedFallback` map to show the same "Generic — not generated"
  // badge the other onboarding sections already have.
  usedFallback: boolean;
};

/**
 * Generates a full diet plan — meals plus calorie/protein/hydration
 * targets — for the onboarding questionnaire's 'diet' domain.
 *
 * Deliberate signature difference from every other generate*() function
 * above: those all take a single free-text `goalDescription` string
 * (built by questionnaire.ts's buildGoalDescription()). This one takes
 * `DietDomainAnswers` directly, because dietType/dietGoal/targetCalories
 * are already typed enums/numbers (Phase 3) — re-parsing them back out of
 * a prose string before an AI call, only to risk the AI getting the number
 * wrong, is strictly worse than sending them as structured data and
 * computing the authoritative number ourselves. This was flagged as a
 * judgment call in PHASE_4_HANDOFF.md's Phase 5 instructions; see
 * PHASE_5_HANDOFF.md for the full reasoning. Whoever wires this into
 * OnboardingWizard.tsx (Phase 9, unless pulled forward) needs a call site
 * shaped differently from the other five generate*() calls as a result.
 *
 * Also deliberately never resolves to `null` the way the other generate*()
 * functions do on failure — the numeric targets are computed synchronously
 * up front and always real, and `meals` always has real, dietType-aware
 * content (AI or local fallback) rather than being left empty. Use
 * `usedFallback` to detect the AI path failed, the same way the other
 * onboarding sections track it today.
 */
export async function generateDietPlan(
  answers: DietDomainAnswers,
  profileWeightKg?: number,
  context?: string,
): Promise<DietPlanResult> {
  const targets = calculateDietTargets(answers, profileWeightKg);
  const input = describeDietForGeneration(answers, targets);

  const aiResult = (await generate('onboarding-diet', input, context).catch(() => null)) as {
    meals?: { time: string; name: string; items: string[]; iconName: string }[];
  } | null;

  const aiMeals = Array.isArray(aiResult?.meals) ? aiResult!.meals : null;
  const usedFallback = !aiMeals || aiMeals.length === 0;

  const meals: DietPlanMeal[] = usedFallback
    ? buildFallbackDietPlan(answers, targets)
    : aiMeals!.slice(0, MAX_DIET_MEALS).map((m) => ({
        time: typeof m?.time === 'string' ? m.time : '',
        name: typeof m?.name === 'string' && m.name ? m.name : 'Meal',
        items: Array.isArray(m?.items) ? m.items.filter((it: any) => typeof it === 'string') : [],
        iconName: typeof m?.iconName === 'string' && (ICON_LIBRARY_KEYS as string[]).includes(m.iconName) ? m.iconName : 'Utensils',
      }));

  return {
    meals,
    targetCalories: targets.calories,
    targetProteinG: targets.proteinG,
    targetHydrationL: targets.hydrationL,
    usedFallback,
  };
}

// ---------------------------------------------------------------------------
// Phase 6 — weekly training plan generation across goal types
//
// See PHASE_6_HANDOFF.md for the full writeup; the short version:
//
// - Same two-layer shape Phase 5 established for diet: a pure/synchronous/
//   never-fails structural layer (buildWeekSkeleton -> which of the 7 days
//   are training days and what each one's focus is, driven by
//   `daysPerWeek`) feeding a pure/synchronous fallback exercise-picker
//   (buildFallbackWeeklyTrainingPlan), plus an AI path tried first
//   (generateTrainingPlan) with the fallback taking over on any failure.
// - Deliberately structured input again, same reasoning as Phase 5:
//   `daysPerWeek`/`equipmentAccess`/`experienceLevel`/`fitnessGoal` are
//   already typed (Phase 3) — this generator takes FitnessDomainAnswers
//   directly rather than re-deriving them from a prose goalDescription.
//   This means generateTrainingPlan()'s signature is genuinely different
//   from today's `generateWeeklyTraining(goalDescription, context?)` (which
//   Phase 4 already wired into OnboardingWizard.tsx and which THIS PHASE
//   DOES NOT TOUCH OR REMOVE — both now exist side by side). Whoever wires
//   Phase 6 in for real (Phase 9, unless pulled forward) picks one call
//   site shape and should say so.
// - Unlike diet targets, a training *split* has no single "must never be
//   wrong" number the way calories/protein do, so this stays closer to the
//   original generate*() convention in spirit — but still always returns a
//   real plan (never null) with a `usedFallback` flag, same convention
//   Phase 5 introduced, since even the fallback path here is strictly
//   better than OnboardingWizard's existing generic fallback (today's
//   hardcoded DEFAULT_TRAINING shape has no daysPerWeek/equipment/
//   experience awareness at all).
// - Open question flagged forward, NOT resolved this phase (same as
//   questionnaire.ts's own DOMAIN_TAB_KEYS comments already flag): should a
//   diet-only account (no 'fitness' domain selected) still get some
//   training content? This function doesn't care either way — it only
//   needs a FitnessDomainAnswers object, regardless of which domain(s) are
//   selected — so *whether* to call it for a diet-only account is a
//   Phase 8/9 wiring question, not something resolved here.
// ---------------------------------------------------------------------------

// ---- 1. Deterministic week skeleton (which days train, what focus) ----

export type WeeklyTrainingDay = {
  day: string;
  focus: string;
  mode: 'gym' | 'calisthenics' | 'rest';
  exercises: { name: string; sets: string }[];
};

const TRAINING_DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// One canonical split per possible daysPerWeek value (1-7), in the order
// those training days should land across the week — this is what actually
// makes `daysPerWeek` size the generated split instead of it being
// whatever the AI happens to return. Chosen splits follow standard, widely
// -used conventions (full body for 1x/week, upper/lower for 2x and folded
// into 4-5x, push/pull/legs for 3x and 6x, a light conditioning day added
// at 7x rather than a 7th hard lifting day, which risks overtraining
// almost everyone).
const FOCUS_SEQUENCE_BY_DAYS_PER_WEEK: Record<number, string[]> = {
  1: ['Full Body'],
  2: ['Upper Body', 'Lower Body'],
  3: ['Push', 'Pull', 'Legs'],
  4: ['Upper Body', 'Lower Body', 'Upper Body', 'Lower Body'],
  5: ['Push', 'Pull', 'Legs', 'Upper Body', 'Lower Body'],
  6: ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs'],
  7: ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs', 'Conditioning'],
};

function clampDaysPerWeek(n: number): number {
  const rounded = Math.round(n);
  return Math.min(7, Math.max(1, Number.isFinite(rounded) && rounded > 0 ? rounded : 1));
}

// Spreads N training days as evenly as possible across the 7-day week
// (rather than bunching them Monday-Tuesday-Wednesday...) so e.g.
// daysPerWeek=3 lands roughly Monday/Wednesday/Saturday, giving real rest
// days between sessions like any real program would.
function distributeAcrossWeek(daysPerWeek: number): boolean[] {
  const n = clampDaysPerWeek(daysPerWeek);
  const slots = new Array(7).fill(false);
  if (n >= 7) return slots.fill(true);
  const gap = 7 / n;
  for (let i = 0; i < n; i++) {
    slots[Math.min(6, Math.round(i * gap))] = true;
  }
  return slots;
}

// Builds the 7-day skeleton (day name + focus, or null for a rest day) —
// pure structure, no exercises picked yet. Exported on its own so a future
// caller (e.g. a "preview my split before generating" UI) can show this
// instantly without waiting on exercise selection or any network call.
export function buildWeekSkeleton(daysPerWeek: number): { day: string; focus: string | null }[] {
  const n = clampDaysPerWeek(daysPerWeek);
  const sequence = FOCUS_SEQUENCE_BY_DAYS_PER_WEEK[n];
  const trainingSlots = distributeAcrossWeek(n);
  let seqIdx = 0;
  return TRAINING_DAY_NAMES.map((day, i) => {
    if (trainingSlots[i]) {
      const focus = sequence[seqIdx] ?? sequence[sequence.length - 1];
      seqIdx++;
      return { day, focus };
    }
    return { day, focus: null };
  });
}

// ---- 2. Local, equipment/experience-aware exercise pools ----
//
// Two equipment tiers, not three: 'full-gym' gets its own pool; both
// 'home-basic' and 'bodyweight-only' share the 'nogym' pool. This is a
// deliberate simplification (flagged here rather than silently made) —
// WeeklyTrainingDay['mode'] only has 'gym' | 'calisthenics' | 'rest' (the
// shape Training & Fuel's UI already renders, see DEFAULT_TRAINING in
// appConfig.ts), so a third tier would need either a UI change (out of
// scope this phase) or would collapse to one of the existing two modes
// anyway. 'home-basic' (a few dumbbells/bands) genuinely could support
// slightly more than pure bodyweight, but sharing the pool means every
// exercise offered is guaranteed doable with zero or minimal equipment,
// which is the safer default absent more granular equipment data.

type PoolExercise = { name: string; riskTags: string[] };
type EquipmentTier = 'gym' | 'nogym';

const EXERCISE_POOL: Record<string, Record<EquipmentTier, PoolExercise[]>> = {
  'Full Body': {
    gym: [
      { name: 'Barbell Back Squat', riskTags: ['knee', 'back'] },
      { name: 'Barbell Bench Press', riskTags: ['shoulder', 'chest'] },
      { name: 'Bent-Over Barbell Row', riskTags: ['back'] },
      { name: 'Overhead Press', riskTags: ['shoulder'] },
      { name: 'Romanian Deadlift', riskTags: ['back', 'hamstring'] },
      { name: 'Plank', riskTags: [] },
    ],
    nogym: [
      { name: 'Bodyweight Squats', riskTags: ['knee'] },
      { name: 'Push-ups', riskTags: ['shoulder', 'wrist'] },
      { name: 'Inverted / Doorframe Rows', riskTags: ['back'] },
      { name: 'Pike Push-ups', riskTags: ['shoulder'] },
      { name: 'Glute Bridges', riskTags: ['back'] },
      { name: 'Plank', riskTags: [] },
    ],
  },
  'Upper Body': {
    gym: [
      { name: 'Lat Pulldown', riskTags: ['shoulder'] },
      { name: 'Flat Barbell Bench Press', riskTags: ['shoulder', 'chest'] },
      { name: 'Seated Cable Row', riskTags: ['back'] },
      { name: 'DB Shoulder Press', riskTags: ['shoulder'] },
      { name: 'DB Bicep Curl', riskTags: ['elbow'] },
      { name: 'Triceps Rope Pushdown', riskTags: ['elbow'] },
    ],
    nogym: [
      { name: 'Pull-ups / Negative Pull-ups', riskTags: ['shoulder', 'elbow'] },
      { name: 'Push-ups', riskTags: ['shoulder', 'wrist'] },
      { name: 'Doorframe Rows', riskTags: ['back'] },
      { name: 'Pike Push-ups', riskTags: ['shoulder'] },
      { name: 'Diamond Push-ups', riskTags: ['wrist', 'elbow'] },
      { name: 'Chair Dips', riskTags: ['shoulder', 'elbow'] },
    ],
  },
  'Lower Body': {
    gym: [
      { name: 'Barbell Back Squat', riskTags: ['knee', 'back'] },
      { name: 'Leg Press', riskTags: ['knee'] },
      { name: 'Romanian Deadlift', riskTags: ['back', 'hamstring'] },
      { name: 'Walking Lunges', riskTags: ['knee'] },
      { name: 'Leg Curl Machine', riskTags: ['hamstring'] },
      { name: 'Standing Calf Raise', riskTags: ['ankle'] },
    ],
    nogym: [
      { name: 'Bodyweight Squats', riskTags: ['knee'] },
      { name: 'Walking Lunges', riskTags: ['knee'] },
      { name: 'Glute Bridges', riskTags: ['back'] },
      { name: 'Single-Leg Romanian Deadlift (bodyweight)', riskTags: ['hamstring', 'back'] },
      { name: 'Wall Sit', riskTags: ['knee'] },
      { name: 'Calf Raises', riskTags: ['ankle'] },
    ],
  },
  Push: {
    gym: [
      { name: 'Flat Barbell Bench Press', riskTags: ['shoulder', 'chest'] },
      { name: 'Incline DB Press', riskTags: ['shoulder'] },
      { name: 'Seated DB Shoulder Press', riskTags: ['shoulder'] },
      { name: 'Cable Lateral Raise', riskTags: ['shoulder'] },
      { name: 'Triceps Rope Pushdown', riskTags: ['elbow'] },
      { name: 'Dips', riskTags: ['shoulder', 'elbow'] },
    ],
    nogym: [
      { name: 'Push-ups', riskTags: ['shoulder', 'wrist'] },
      { name: 'Pike Push-ups', riskTags: ['shoulder'] },
      { name: 'Diamond Push-ups', riskTags: ['wrist', 'elbow'] },
      { name: 'Chair Dips', riskTags: ['shoulder', 'elbow'] },
      { name: 'Wall Handstand Hold', riskTags: ['shoulder', 'wrist'] },
    ],
  },
  Pull: {
    gym: [
      { name: 'Lat Pulldown', riskTags: ['shoulder'] },
      { name: 'Bent-Over Barbell Row', riskTags: ['back'] },
      { name: 'Seated Cable Row', riskTags: ['back'] },
      { name: 'Face Pulls', riskTags: ['shoulder'] },
      { name: 'DB Bicep Curl', riskTags: ['elbow'] },
      { name: 'Straight-Arm Pulldown', riskTags: ['shoulder'] },
    ],
    nogym: [
      { name: 'Pull-ups', riskTags: ['shoulder', 'elbow'] },
      { name: 'Negative Pull-ups', riskTags: ['shoulder', 'elbow'] },
      { name: 'Doorframe Rows', riskTags: ['back'] },
      { name: 'Towel Face Pulls', riskTags: ['shoulder'] },
      { name: 'Superman Holds', riskTags: ['back'] },
    ],
  },
  Legs: {
    gym: [
      { name: 'Barbell Back Squat', riskTags: ['knee', 'back'] },
      { name: 'Leg Press', riskTags: ['knee'] },
      { name: 'Romanian Deadlift', riskTags: ['back', 'hamstring'] },
      { name: 'Walking Lunges', riskTags: ['knee'] },
      { name: 'Leg Extension', riskTags: ['knee'] },
      { name: 'Standing Calf Raise', riskTags: ['ankle'] },
    ],
    nogym: [
      { name: 'Bodyweight Squats', riskTags: ['knee'] },
      { name: 'Bulgarian Split Squats', riskTags: ['knee'] },
      { name: 'Glute Bridges', riskTags: ['back'] },
      { name: 'Wall Sit', riskTags: ['knee'] },
      { name: 'Calf Raises', riskTags: ['ankle'] },
    ],
  },
  Conditioning: {
    gym: [
      { name: 'Rowing Machine Intervals', riskTags: [] },
      { name: 'Assault Bike Sprints', riskTags: ['knee'] },
      { name: 'Kettlebell Swings', riskTags: ['back'] },
      { name: 'Battle Ropes', riskTags: ['shoulder'] },
    ],
    nogym: [
      { name: 'Jump Rope Intervals', riskTags: ['knee', 'ankle'] },
      { name: 'Bodyweight Burpees', riskTags: ['knee', 'shoulder'] },
      { name: 'Mountain Climbers', riskTags: ['wrist'] },
      { name: 'Brisk Walk / Jog', riskTags: ['knee'] },
    ],
  },
};

const REST_DAY_EXERCISES = [
  { name: 'Light stretching / mobility work', sets: '10-15 min' },
  { name: 'Foam rolling', sets: '10 min' },
  { name: 'Rest, or an easy walk', sets: 'as needed' },
];

// Simple, deliberately coarse keyword list for injuriesOrLimits filtering —
// same "generator's job to parse a free-text field" convention Phase 5's
// filterAllergies() already established for DietDomainAnswers.
// allergiesOrDislikes. A person typing "bad left knee, avoid deep squats"
// only needs to hit 'knee' for every knee-tagged exercise across every
// pool to be excluded.
const INJURY_KEYWORDS = ['knee', 'back', 'shoulder', 'wrist', 'elbow', 'ankle', 'hamstring', 'hip', 'neck', 'chest'];

function parseInjuryKeywords(injuriesOrLimits: string): string[] {
  const lower = injuriesOrLimits.toLowerCase();
  return INJURY_KEYWORDS.filter((k) => lower.includes(k));
}

// Number of exercises assigned per training day, scaled by experience —
// a beginner gets a shorter, more manageable session; advanced gets more
// exercise variety/volume.
const EXERCISES_PER_DAY_BY_EXPERIENCE: Record<ExperienceLevel, number> = {
  beginner: 3,
  intermediate: 4,
  advanced: 5,
};

// Rep-range convention per fitness goal (standard strength-training
// guidance: low reps/heavy for strength, moderate for hypertrophy, high
// for endurance). Set count also scales gently with experience so an
// advanced trainee's session carries more total volume than a beginner's
// for the same goal.
const REP_RANGE_BY_GOAL: Record<FitnessGoalType, string> = {
  strength: '4-6',
  hypertrophy: '10-12',
  endurance: '15-20',
  'general-health': '10-15',
  'sport-specific': '6-10 (explosive tempo)',
};

const SET_COUNT_BY_EXPERIENCE: Record<ExperienceLevel, number> = {
  beginner: 3,
  intermediate: 4,
  advanced: 5,
};

function setsLabelFor(experienceLevel: ExperienceLevel, fitnessGoal: FitnessGoalType): string {
  return `${SET_COUNT_BY_EXPERIENCE[experienceLevel]}×${REP_RANGE_BY_GOAL[fitnessGoal]}`;
}

const FOCUS_GOAL_SUFFIX: Record<FitnessGoalType, string> = {
  strength: 'Strength Focus',
  hypertrophy: 'Hypertrophy Focus',
  endurance: 'Endurance Focus',
  'general-health': 'General Fitness',
  'sport-specific': 'Sport-Specific Conditioning',
};

function focusLabel(focus: string, fitnessGoal: FitnessGoalType): string {
  if (focus === 'Conditioning') return 'Conditioning & Cardio';
  return `${focus} (${FOCUS_GOAL_SUFFIX[fitnessGoal]})`;
}

// Picks this day's exercises from the matching focus+equipment pool,
// filtering out anything matching a stated injury/limitation, and
// rotating through the pool using `occurrence` (this focus's Nth
// appearance this week, 0-indexed) so a 6-day Push/Pull/Legs x2 split
// doesn't repeat the exact same exercises on both Push days.
function pickExercises(
  focus: string,
  equipmentAccess: EquipmentAccess,
  experienceLevel: ExperienceLevel,
  fitnessGoal: FitnessGoalType,
  injuriesOrLimits: string,
  occurrence: number,
): { name: string; sets: string }[] {
  const tier: EquipmentTier = equipmentAccess === 'full-gym' ? 'gym' : 'nogym';
  const pool = EXERCISE_POOL[focus]?.[tier] ?? [];
  if (!pool.length) return [];

  const banned = parseInjuryKeywords(injuriesOrLimits);
  const safePool = banned.length ? pool.filter((ex) => !ex.riskTags.some((tag) => banned.includes(tag))) : pool;
  // If filtering against this small a pool would wipe it out entirely,
  // falling back to the full (unfiltered) pool is safer than returning
  // zero exercises for the day — a real trainer would substitute, not
  // skip the session; the person still sees exactly which exercises were
  // picked and can swap them out themselves.
  const usablePool = safePool.length ? safePool : pool;

  const count = Math.min(EXERCISES_PER_DAY_BY_EXPERIENCE[experienceLevel], usablePool.length);
  const setsLabel = setsLabelFor(experienceLevel, fitnessGoal);
  const picked: { name: string; sets: string }[] = [];
  for (let i = 0; i < count; i++) {
    const idx = (occurrence * count + i) % usablePool.length;
    picked.push({ name: usablePool[idx].name, sets: setsLabel });
  }
  return picked;
}

/**
 * Builds a full 7-day weekly training plan entirely locally (no network) —
 * the fallback path for when AI generation isn't available, and honors
 * every field in FitnessDomainAnswers: `daysPerWeek` sizes the split (via
 * buildWeekSkeleton), `equipmentAccess` picks the exercise tier (and the
 * resulting gym/calisthenics mode), `experienceLevel` sizes both exercise
 * count and set count, `fitnessGoal` sets the rep range, and
 * `injuriesOrLimits` filters out anything matching a stated body-part
 * keyword.
 */
export function buildFallbackWeeklyTrainingPlan(answers: FitnessDomainAnswers): WeeklyTrainingDay[] {
  const skeleton = buildWeekSkeleton(answers.daysPerWeek);
  const mode: 'gym' | 'calisthenics' = answers.equipmentAccess === 'full-gym' ? 'gym' : 'calisthenics';
  const occurrenceByFocus: Record<string, number> = {};

  return skeleton.map(({ day, focus }) => {
    if (!focus) {
      return { day, focus: 'Rest', mode: 'rest', exercises: REST_DAY_EXERCISES.map((e) => ({ ...e })) };
    }
    const occurrence = occurrenceByFocus[focus] ?? 0;
    occurrenceByFocus[focus] = occurrence + 1;
    const exercises = pickExercises(
      focus, answers.equipmentAccess, answers.experienceLevel, answers.fitnessGoal, answers.injuriesOrLimits, occurrence,
    );
    return { day, focus: focusLabel(focus, answers.fitnessGoal), mode, exercises };
  });
}

// ---- 3. AI generation, tying the skeleton + fallback together ----

/**
 * Composes the structured description sent to the `generate-content` edge
 * function for `kind: 'onboarding-training-structured'`. New kind,
 * deliberately NOT reusing today's `kind: 'onboarding-training'` (which
 * `generateWeeklyTraining` below still uses, unchanged) — that existing
 * kind's contract is a free-text goalDescription with no guarantee about
 * exactly how many days should be training days; this one explicitly
 * tells the AI the exact daysPerWeek constraint plus the resolved
 * equipment/experience/goal, the same "send the authoritative structured
 * facts, don't make the AI reconstruct them from prose" reasoning Phase 5
 * used for diet targets.
 */
function describeFitnessForGeneration(answers: FitnessDomainAnswers): string {
  const parts = [
    `Fitness goal: ${answers.fitnessGoal.replace(/-/g, ' ')}`,
    `Experience level: ${answers.experienceLevel}`,
    `Training days per week: ${answers.daysPerWeek} out of 7 (exactly this many days of the week should have real training content; every other day should be mode: 'rest' with light recovery activity)`,
    `Equipment access: ${answers.equipmentAccess.replace(/-/g, ' ')}`,
  ];
  if (answers.injuriesOrLimits.trim()) parts.push(`Injuries/limitations — avoid or substitute around: ${answers.injuriesOrLimits.trim()}`);
  return parts.join('. ');
}

export type WeeklyTrainingResult = {
  days: WeeklyTrainingDay[];
  // true if `days` came from buildFallbackWeeklyTrainingPlan() rather than
  // the AI — same convention as DietPlanResult.usedFallback (Phase 5).
  usedFallback: boolean;
};

/**
 * Generates a full 7-day weekly training plan for the onboarding
 * questionnaire's 'fitness' domain (or any caller with a
 * FitnessDomainAnswers object — see the "open question flagged forward"
 * note at the top of this section for whether a diet-only account should
 * also get one).
 *
 * Deliberate signature difference from today's
 * `generateWeeklyTraining(goalDescription, context?)`, which is untouched
 * by this phase and still exists below — see the block comment above this
 * section for the reasoning (same judgment call Phase 5 made for diet).
 *
 * Always resolves with a real, `daysPerWeek`-sized plan (AI or local
 * fallback) rather than null; use `usedFallback` to detect the AI path
 * failed, same convention as `generateDietPlan`.
 */
export async function generateTrainingPlan(
  answers: FitnessDomainAnswers,
  context?: string,
): Promise<WeeklyTrainingResult> {
  const input = describeFitnessForGeneration(answers);

  const aiResult = (await generate('onboarding-training-structured', input, context).catch(() => null)) as {
    days?: { day: string; focus: string; mode: string; exercises: { name: string; sets: string }[] }[];
  } | null;

  const aiDays = Array.isArray(aiResult?.days) ? aiResult!.days : null;
  // Requires a full 7-day week back, matching WeeklyTrainingDay's shape and
  // DEFAULT_TRAINING's own 7-entry convention in appConfig.ts — anything
  // short of that (missing days, wrong length) is treated as a failed
  // generation rather than silently rendering a partial week.
  const usedFallback = !aiDays || aiDays.length !== 7;

  const days: WeeklyTrainingDay[] = usedFallback
    ? buildFallbackWeeklyTrainingPlan(answers)
    : aiDays!.map((d) => ({
        day: typeof d?.day === 'string' && d.day ? d.day : '',
        focus: typeof d?.focus === 'string' && d.focus ? d.focus : 'Training',
        mode: d?.mode === 'gym' || d?.mode === 'calisthenics' || d?.mode === 'rest' ? d.mode : 'gym',
        exercises: Array.isArray(d?.exercises)
          ? d.exercises
              .filter((e: any) => typeof e?.name === 'string' && e.name)
              .map((e: any) => ({ name: e.name, sets: typeof e.sets === 'string' ? e.sets : '' }))
          : [],
      }));

  return { days, usedFallback };
}
// ---------------------------------------------------------------------------
// Phase 7 — syllabus / study-plan generation beyond JEE-shaped assumptions
//
// Same two-layer shape Phases 5 and 6 established: a pure/synchronous/
// never-fails structural layer (resolveMonthsRemaining + buildRoadmapSkeleton
// -> exactly how many phases, and what stage each one is, driven by
// `currentLevel` + time-to-exam) feeding a pure/synchronous fallback content
// builder (buildFallbackSyllabus), plus an AI path tried first
// (generateExamSyllabus) with the fallback taking over on any failure or
// structural mismatch.
//
// STRUCTURED INPUT VS goalDescription STRING — the judgment call flagged in
// PHASE_6_HANDOFF.md, made deliberately here rather than by default:
// this generator takes `ExamDomainAnswers` directly (like Phase 5/6), NOT a
// free-text goalDescription. The reasoning is narrower than Phase 5/6's
// (subjectsHint is free text, not an enum — there's less "the AI might get a
// typed number wrong" risk to avoid), but `currentLevel` is still a typed
// enum and it is the single most important lever this phase has to pull:
// the actual number of roadmap phases and which stages they are must be
// computed deterministically from currentLevel + time remaining, not left to
// an AI's discretion, or "revision-only with 2 months left" and
// "just-starting with 8 months left" could come back looking similar. That
// determinism is exactly Phase 5/6's reason for going structured, and it
// applies here too, so the same call is made. subjectsHint/examName are
// still passed through as free text within the structured object — going
// structured doesn't mean re-typing everything, just not falling back to a
// single opaque prose string for the fields that matter for shape.
// generateSyllabus(goalDescription, context) above is completely UNCHANGED
// and untouched — it still exists side by side, same "both now exist"
// pattern Phase 6 used for generateWeeklyTraining vs generateTrainingPlan.
//
// MONTH LABELING — the other judgment call the handoff asked to be made
// deliberately: this uses relative "Month 1" / "Month 2" labels, NOT
// calendar month names (unlike DEFAULT_SYLLABUS in appConfig.ts, which is
// JEE-shaped and uses real months like 'July'/'August'). Reasoning:
// `examDate` is optional (ExamDomainAnswers docs it as such), and this
// generator explicitly has to serve flexible-pace goals with no fixed
// calendar deadline (a professional cert studied "whenever I get to it").
// Calendar-month labels would be actively misleading for that case (there's
// no real 'Month 1 = July' anchor), whereas relative labels degrade
// gracefully for every case — this matches the convention
// OnboardingWizard.tsx's own existing fallbackSyllabus() already uses
// ('Month 1', 'This month'), so it's also the less surprising choice, not a
// new one.
// ---------------------------------------------------------------------------

// ---- 1. Deterministic phase count + stage sequence ----

// Roadmap depth (in months) to assume when no valid examDate was given —
// scaled by currentLevel since that's the best signal we have absent a real
// date: someone 'just-starting' with no stated date gets a fuller runway
// than someone in 'revision-only' with no stated date (who by definition has
// already finished learning the material, so a short runway is the honest
// default either way).
const DEFAULT_MONTHS_BY_LEVEL: Record<ExamCurrentLevel, number> = {
  'just-starting': 6,
  'mid-prep': 4,
  'final-stretch': 2,
  'revision-only': 1,
};

// Whole calendar months between `now` and `dateStr`, rounding any partial
// month UP (a target 8 days past an even N-month mark still needs a full
// extra month of runway) — a ceiling, not a round-to-nearest. Returns null
// for an empty/unparseable date, letting the caller fall back to
// DEFAULT_MONTHS_BY_LEVEL.
function monthsBetween(dateStr: string, now: Date): number | null {
  if (!dateStr) return null;
  const target = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const months = (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth());
  const dayAdjust = target.getDate() > now.getDate() ? 1 : 0;
  return months + dayAdjust;
}

/**
 * Resolves how many months of roadmap to build. Pure and synchronous,
 * never fails. Prefers a real `examDate` when it parses to a future date;
 * otherwise (no date, unparseable date, or a date that's already passed)
 * falls back to a currentLevel-scaled default. Always clamped to 1-12 —
 * below 1 there's no meaningful roadmap to build, and above 12 the phase
 * granularity (one entry per month) stops being useful, same spirit as
 * `clampDaysPerWeek` in the Phase 6 section above.
 */
export function resolveMonthsRemaining(
  answers: Pick<ExamDomainAnswers, 'examDate' | 'currentLevel'>,
  now: Date = new Date(),
): number {
  const parsed = monthsBetween(answers.examDate, now);
  const raw = parsed !== null && parsed > 0 ? parsed : DEFAULT_MONTHS_BY_LEVEL[answers.currentLevel];
  return Math.min(12, Math.max(1, Math.round(raw)));
}

// The roadmap always ends on this stage, regardless of currentLevel or
// monthsRemaining — a final mock-tests-and-weak-areas phase is the honest
// last step for every prep level, including someone with only one month
// left total (in which case it's the *only* phase — there's no time for
// anything else, which is itself an accurate signal to show the person).
const FINAL_STAGE = 'Final Mock & Weak-Area Drilling';

// Every stage BEFORE the guaranteed final one, per currentLevel, in
// earliest-to-latest order. This is what makes 'revision-only' and
// 'just-starting' produce visibly different roadmaps for the same
// monthsRemaining: 'revision-only' skips straight to revision content
// (the person has already learned the material), while 'just-starting'
// walks through foundations first. 'mid-prep' and 'final-stretch' sit
// between the two, each skipping the stages that prep level implies are
// already behind the person.
const PRE_FINAL_STAGES_BY_LEVEL: Record<ExamCurrentLevel, string[]> = {
  'just-starting': ['Foundations', 'Core Buildout', 'Advanced / Applied', 'Full Revision'],
  'mid-prep': ['Core Buildout', 'Advanced / Applied', 'Full Revision'],
  'final-stretch': ['Advanced / Applied Consolidation', 'Full Revision'],
  'revision-only': ['Full Revision'],
};

export type RoadmapStage = { phase: number; month: string; stageLabel: string };

/**
 * Builds the phase-by-phase stage sequence — pure structure, no subjects or
 * topics yet. Always returns exactly `monthsRemaining` (clamped 1-12)
 * entries, always ending on FINAL_STAGE. When monthsRemaining is smaller
 * than the level's full pre-final stage list, earlier (lower-index) stages
 * are kept and later ones (typically 'Full Revision') are the ones dropped
 * from the pre-final portion — on a tight timeline, actually covering
 * foundational/core content matters more than a dedicated revision phase,
 * since FINAL_STAGE itself already covers final review and drilling. When
 * monthsRemaining is larger, earlier stages are the ones stretched across
 * more months (more time to build foundations properly), not later ones.
 * Both directions use the same proportional (floor-indexed) mapping, so the
 * behavior is one rule, not two special cases — exercised directly (not
 * just type-checked) for every currentLevel x several monthsRemaining
 * combinations before trusting it; see PHASE_7_HANDOFF.md.
 */
export function buildRoadmapSkeleton(currentLevel: ExamCurrentLevel, monthsRemaining: number): RoadmapStage[] {
  const n = Math.min(12, Math.max(1, Math.round(monthsRemaining)));
  const preFinal = PRE_FINAL_STAGES_BY_LEVEL[currentLevel];
  const m = n - 1; // months available before the guaranteed final phase
  const stages: string[] = [];
  if (m > 0) {
    const L = preFinal.length;
    for (let i = 0; i < m; i++) {
      const idx = Math.min(L - 1, Math.floor((i * L) / m));
      stages.push(preFinal[idx]);
    }
  }
  stages.push(FINAL_STAGE);
  return stages.map((stageLabel, i) => ({ phase: i + 1, month: `Month ${i + 1}`, stageLabel }));
}

// ---- 2. Local, stage-aware topic templates + subject inference ----

// Deliberately genuine-but-generic per-stage topic phrasing (not just "Add
// your first topic" — same "the fallback should still be real, useful
// content" bar Phase 5/6 held themselves to) rather than actual curriculum
// content, since unlike diet macros or a training rep range, this sandbox
// has no way to know the real chapter breakdown of an arbitrary exam/
// skill/course offline. Getting real subject-specific topics (e.g. "NLM &
// Friction" for NEET Physics) is exactly what the AI path
// (`onboarding-syllabus-structured`) is for — this is the honest, always-
// available floor under it.
function topicsForStage(stageLabel: string, subjectLabel: string): string[] {
  switch (stageLabel) {
    case 'Foundations':
      return [`${subjectLabel}: fundamentals & core concepts`, `${subjectLabel}: basic practice problems`];
    case 'Core Buildout':
      return [`${subjectLabel}: intermediate topics`, `${subjectLabel}: applied problem-solving`];
    case 'Advanced / Applied':
    case 'Advanced / Applied Consolidation':
      return [`${subjectLabel}: advanced / high-weightage topics`, `${subjectLabel}: previous-year style questions`];
    case 'Full Revision':
      return [`${subjectLabel}: full syllabus revision`, `${subjectLabel}: formula / concept sheet review`];
    default: // FINAL_STAGE
      return [`${subjectLabel}: full-length mock tests`, `${subjectLabel}: weak-area drilling`];
  }
}

// Small set of common exam/cert name -> subject-breakdown presets, matched
// by case-insensitive substring against `examName`. Deliberately modest in
// size (not an attempt at an exhaustive exam database) — it exists so the
// most common cases (NEET, JEE, UPSC, AWS, etc.) get a real subject split
// instead of a single generic bucket even when the person leaves
// `subjectsHint` blank, while anything not on this list still degrades
// gracefully to the generic single-subject fallback below rather than
// guessing wrong.
const EXAM_SUBJECT_PRESETS: { keywords: string[]; subjects: string[] }[] = [
  { keywords: ['neet'], subjects: ['Physics', 'Chemistry', 'Biology'] },
  { keywords: ['jee'], subjects: ['Mathematics', 'Physics', 'Chemistry'] },
  { keywords: ['upsc', 'civil services', 'ias'], subjects: ['General Studies', 'CSAT', 'Essay & Ethics'] },
  { keywords: ['cat'], subjects: ['Quantitative Ability', 'Verbal Ability & Reading Comprehension', 'Data Interpretation & Logical Reasoning'] },
  { keywords: ['gate'], subjects: ['Core Engineering', 'Engineering Mathematics', 'General Aptitude'] },
  { keywords: ['gre'], subjects: ['Verbal Reasoning', 'Quantitative Reasoning', 'Analytical Writing'] },
  { keywords: ['gmat'], subjects: ['Quantitative', 'Verbal', 'Data Insights'] },
  { keywords: ['aws'], subjects: ['Cloud Concepts', 'Security', 'Core Services & Technology', 'Billing & Pricing'] },
  { keywords: ['pmp'], subjects: ['People', 'Process', 'Business Environment'] },
  { keywords: ['cfa'], subjects: ['Ethics & Quant Methods', 'Financial Statement Analysis', 'Portfolio Management'] },
];

function matchExamPreset(examName: string): string[] | null {
  const lower = examName.toLowerCase();
  for (const preset of EXAM_SUBJECT_PRESETS) {
    if (preset.keywords.some((kw) => lower.includes(kw))) return preset.subjects;
  }
  return null;
}

// Comma/semicolon-separated free text -> trimmed, non-empty parts, matching
// the "generator's job to parse" convention DietDomainAnswers.
// allergiesOrDislikes already documents in questionnaire.ts.
function parseSubjectsHint(hint: string): string[] {
  return hint.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
}

function slugifySubjectLabel(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'subject';
}

export type ExamSyllabusSubject = { key: string; label: string; color: string };

/**
 * Resolves the subject list for a syllabus roadmap. Priority order: (1) a
 * person-supplied `subjectsHint` is always respected verbatim over guessing
 * — they told us directly; (2) failing that, a known exam-name preset
 * (EXAM_SUBJECT_PRESETS); (3) failing that, one generic subject named after
 * the exam itself, so "AWS SAA-C03" with no hint still gets a real (if
 * unspecific) subject rather than the app inventing wrong physics/chemistry/
 * biology subjects for something that isn't NEET. Pure and synchronous,
 * never fails, never returns an empty list.
 */
export function deriveExamSubjects(answers: Pick<ExamDomainAnswers, 'examName' | 'subjectsHint'>): ExamSyllabusSubject[] {
  const colorNames = Object.keys(SUBJECT_COLOR_PALETTE);
  const hinted = parseSubjectsHint(answers.subjectsHint);
  const labels = hinted.length ? hinted : matchExamPreset(answers.examName) ?? [`${answers.examName.trim() || 'Exam'} Core Topics`];

  const seenKeys = new Set<string>();
  return labels.map((label, i) => {
    let key = slugifySubjectLabel(label);
    while (seenKeys.has(key)) key = `${key}_${i}`;
    seenKeys.add(key);
    return { key, label, color: colorNames[i % colorNames.length] };
  });
}

export type ExamSyllabusPhase = { phase: number; month: string; label: string; subjects: Record<string, string[]> };

/**
 * Builds a full syllabus roadmap entirely locally (no network) — the
 * fallback path for when AI generation isn't available, and honors every
 * field in ExamDomainAnswers that matters for shape: `currentLevel` +
 * `examDate` decide the phase count and stage sequence (via
 * resolveMonthsRemaining + buildRoadmapSkeleton), `subjectsHint`/`examName`
 * decide the subject list (via deriveExamSubjects), and every phase gets
 * real stage-appropriate topic text (via topicsForStage) rather than a
 * placeholder.
 */
export function buildFallbackSyllabus(
  answers: ExamDomainAnswers,
  now: Date = new Date(),
): { subjects: ExamSyllabusSubject[]; phases: ExamSyllabusPhase[] } {
  const subjects = deriveExamSubjects(answers);
  const monthsRemaining = resolveMonthsRemaining(answers, now);
  const skeleton = buildRoadmapSkeleton(answers.currentLevel, monthsRemaining);

  const phases: ExamSyllabusPhase[] = skeleton.map(({ phase, month, stageLabel }) => ({
    phase,
    month,
    label: stageLabel,
    subjects: Object.fromEntries(subjects.map((s) => [s.key, topicsForStage(stageLabel, s.label)])),
  }));

  return { subjects, phases };
}

// ---- 3. AI generation, tying the skeleton + fallback together ----

/**
 * Composes the structured description sent to the `generate-content` edge
 * function for `kind: 'onboarding-syllabus-structured'`. New kind,
 * deliberately NOT reusing today's `kind: 'onboarding-syllabus'` (which
 * `generateSyllabus` above still uses, unchanged) — same "new kind for a new
 * structured contract, old kind left alone" pattern Phase 6 used for
 * training. Tells the AI the exact phase count and stage order our skeleton
 * already computed (so its roadmap shape matches currentLevel/timeline the
 * same way the fallback's does), plus subjectsHint/examName so it can supply
 * real subject-specific topic content the fallback can't.
 */
function describeExamForGeneration(answers: ExamDomainAnswers, monthsRemaining: number, skeleton: RoadmapStage[]): string {
  const parts = [
    `Exam / skill / course: ${answers.examName.trim() || 'unspecified — infer a reasonable one from context'}`,
    `Current prep level: ${answers.currentLevel.replace(/-/g, ' ')}`,
    `Months remaining: ${monthsRemaining}`,
    `Roadmap must have exactly ${skeleton.length} phase(s), in this order: ${skeleton.map((s) => s.stageLabel).join(' -> ')}`,
  ];
  if (answers.examDate) parts.push(`Exam date: ${answers.examDate}`);
  parts.push(
    answers.subjectsHint.trim()
      ? `Subjects — use exactly these, do not substitute your own: ${answers.subjectsHint.trim()}`
      : 'No subjects given — infer the real subject/module breakdown for this exam/skill/course yourself.',
  );
  return parts.join('. ');
}

export type ExamSyllabusResult = {
  subjects: ExamSyllabusSubject[];
  phases: ExamSyllabusPhase[];
  // true if `subjects`/`phases` came from buildFallbackSyllabus() rather
  // than the AI — same convention as DietPlanResult.usedFallback (Phase 5)
  // and WeeklyTrainingResult.usedFallback (Phase 6).
  usedFallback: boolean;
};

/**
 * Generates a full syllabus/study-plan roadmap for the onboarding
 * questionnaire's 'exam' domain (or any caller with an ExamDomainAnswers
 * object) — generalized beyond JEE-shaped assumptions: works for any named
 * exam, certification, or skill, honors `currentLevel` to shape a visibly
 * different roadmap for someone starting from scratch vs someone in pure
 * revision, and uses `subjectsHint` when given instead of assuming a fixed
 * subject list.
 *
 * Deliberate signature difference from today's
 * `generateSyllabus(goalDescription, context?)`, which is untouched by this
 * phase and still exists above — see the block comment at the top of this
 * section for the reasoning (same judgment call Phase 5/6 made).
 *
 * Always resolves with a real, currentLevel/timeline-shaped roadmap (AI or
 * local fallback) rather than null; use `usedFallback` to detect the AI path
 * failed, same convention as `generateDietPlan`/`generateTrainingPlan`.
 */
export async function generateExamSyllabus(
  answers: ExamDomainAnswers,
  context?: string,
  now: Date = new Date(),
): Promise<ExamSyllabusResult> {
  const monthsRemaining = resolveMonthsRemaining(answers, now);
  const skeleton = buildRoadmapSkeleton(answers.currentLevel, monthsRemaining);
  const input = describeExamForGeneration(answers, monthsRemaining, skeleton);

  const aiResult = (await generate('onboarding-syllabus-structured', input, context).catch(() => null)) as {
    subjects?: { key: string; label: string; color: string }[];
    phases?: { phase: number; month: string; label: string; subjects: Record<string, string[]> }[];
  } | null;

  const aiSubjects = Array.isArray(aiResult?.subjects) ? aiResult!.subjects : null;
  const aiPhases = Array.isArray(aiResult?.phases) ? aiResult!.phases : null;
  // Requires at least one subject and exactly the phase count our skeleton
  // called for — anything short of that (missing phases, wrong length) is
  // treated as a failed generation rather than silently rendering a roadmap
  // that doesn't actually match the requested currentLevel/timeline shape,
  // same convention Phase 6 used for `generateTrainingPlan`'s 7-day check.
  const usedFallback = !aiSubjects || !aiSubjects.length || !aiPhases || aiPhases.length !== skeleton.length;

  if (usedFallback) {
    return { ...buildFallbackSyllabus(answers, now), usedFallback: true };
  }

  const colorNames = Object.keys(SUBJECT_COLOR_PALETTE);
  const subjects: ExamSyllabusSubject[] = aiSubjects!.map((s, i) => ({
    key: typeof s?.key === 'string' && s.key ? s.key : `subject_${i}`,
    label: typeof s?.label === 'string' && s.label ? s.label : `Subject ${i + 1}`,
    color: typeof s?.color === 'string' && colorNames.includes(s.color) ? s.color : colorNames[i % colorNames.length],
  }));

  const phases: ExamSyllabusPhase[] = aiPhases!.map((p, i) => ({
    phase: typeof p?.phase === 'number' ? p.phase : i + 1,
    month: typeof p?.month === 'string' && p.month ? p.month : skeleton[i].month,
    label: typeof p?.label === 'string' && p.label ? p.label : skeleton[i].stageLabel,
    subjects: Object.fromEntries(
      subjects.map((s) => [
        s.key,
        Array.isArray(p?.subjects?.[s.key]) ? p.subjects[s.key].filter((t: any) => typeof t === 'string') : [],
      ]),
    ),
  }));

  return { subjects, phases, usedFallback: false };
}
