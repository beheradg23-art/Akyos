import { supabase } from './supabaseClient';

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