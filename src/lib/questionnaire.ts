// ---------------------------------------------------------------------------
// Questionnaire data model (Phase 3)
//
// DESIGN ONLY — no UI here. This file defines the shape of what the
// onboarding questionnaire will collect once Phase 4 rebuilds
// OnboardingWizard.tsx, and the shape of the extra profile fields that
// Phases 5-7 will need in contentGen.ts to generate diet/training/syllabus
// content for goal types beyond "generic exam prep."
//
// Why a new file instead of piling this into appConfig.ts: appConfig.ts is
// already 1000+ lines of config/domain logic for the *steady-state* app
// (what an account looks like once it's set up). This file is scoped to
// *first-run intake* (what we ask, and how we turn the answers into the
// goalDescription/context strings the existing generate*() functions in
// contentGen.ts already accept) — a different lifecycle stage with its own
// types, so it gets its own module. Nothing in appConfig.ts was changed by
// this phase (see PHASE_3_HANDOFF.md).
//
// What THIS phase deliberately does NOT do:
// - No OnboardingWizard.tsx UI changes (Phase 4).
// - No new contentGen.ts generate*() functions for diet/training/syllabus
//   breadth (Phases 5-7). buildGoalDescription()/buildGoalContext() below
//   exist so those future functions have a real string to send the AI
//   *today's* generate() plumbing already expects — not a replacement for
//   giving those functions proper structured-input signatures later, which
//   is a judgment call left to Phases 5-7 once they're looking at the
//   actual generation code.
// - No dynamic tab wiring in App.tsx (Phase 8). DOMAIN_TAB_KEYS below is
//   just the lookup table Phase 8 will need — it isn't consumed anywhere
//   yet.
// ---------------------------------------------------------------------------

import type { TabLabelKey } from './appConfig';

// ============================================================================
// 1. GOAL DOMAINS
// ============================================================================
// A "domain" is one broad category of goal the questionnaire branches on.
// A person picks ONE OR MORE (multi-select) — this is the mechanism that
// covers the original request's NEET-aspirant-who-also-wants-to-bulk
// example: domains = ['exam', 'fitness', 'diet'], and each selected domain
// contributes its own answers + downstream generated content, all stitched
// into the same account rather than forcing a single "type" of user.

export type GoalDomain = 'exam' | 'fitness' | 'diet' | 'productivity' | 'custom';

export const GOAL_DOMAINS: { key: GoalDomain; label: string; blurb: string }[] = [
  {
    key: 'exam',
    label: 'Exam / Certification Prep',
    blurb: 'Studying for a specific exam, board, entrance test, or certification (JEE, NEET, UPSC, a professional cert, a school subject, anything with a syllabus).',
  },
  {
    key: 'fitness',
    label: 'Fitness / Training',
    blurb: 'A training goal — strength, muscle, endurance, general fitness — independent of any specific diet target.',
  },
  {
    key: 'diet',
    label: 'Diet / Nutrition',
    blurb: 'A nutrition goal — bulking, cutting, maintaining, or just eating on-plan — independent of any specific training split.',
  },
  {
    key: 'productivity',
    label: 'General Productivity / Routine',
    blurb: "Building a daily structure around focus, work, or habits that isn't exam- or fitness-shaped.",
  },
  {
    key: 'custom',
    label: 'Something else',
    blurb: "Doesn't fit the above — describe it in your own words and we'll do our best with it.",
  },
];

export const GOAL_DOMAIN_KEYS: GoalDomain[] = GOAL_DOMAINS.map((d) => d.key);

// ============================================================================
// 2. PER-DOMAIN ANSWER SHAPES
// ============================================================================
// Each selected domain contributes one of these to QuestionnaireAnswers.
// Every field here is intentionally optional/nullable-friendly so a blank
// questionnaire (or a "skip" path, matching OnboardingWizard's existing
// `skip()` behavior) is always a valid value, never `undefined` reaching a
// generator function.

export type ExamCurrentLevel = 'just-starting' | 'mid-prep' | 'final-stretch' | 'revision-only';

export type ExamDomainAnswers = {
  // Free text on purpose — "NEET", "UPSC Prelims 2027", "AWS SAA-C03",
  // "Class 10 Boards" all need to work, and a fixed dropdown of exams
  // would immediately fight the "diverse range of goal types" requirement.
  examName: string;
  examDate: string; // 'YYYY-MM-DD', optional — feeds the countdown widget same as today's targetDate
  // Optional free-text seed for generateSyllabus (Phase 7) — lets someone
  // who already knows their subject breakdown (e.g. "Physics, Chemistry,
  // Biology" or "Modules 1-6 of the AWS blueprint") hand it over directly,
  // rather than the generator having to infer subjects purely from
  // examName. Left blank, generation falls back to inferring from
  // examName + the composed goal description, same as today.
  subjectsHint: string;
  currentLevel: ExamCurrentLevel;
};

export const DEFAULT_EXAM_ANSWERS: ExamDomainAnswers = {
  examName: '',
  examDate: '',
  subjectsHint: '',
  currentLevel: 'just-starting',
};

export type FitnessGoalType = 'strength' | 'hypertrophy' | 'endurance' | 'general-health' | 'sport-specific';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type EquipmentAccess = 'full-gym' | 'home-basic' | 'bodyweight-only';

export type FitnessDomainAnswers = {
  fitnessGoal: FitnessGoalType;
  experienceLevel: ExperienceLevel;
  daysPerWeek: number; // 1-7, how many training days generateWeeklyTraining should actually fill (rest of DAY_NAMES stays 'rest')
  equipmentAccess: EquipmentAccess;
  injuriesOrLimits: string; // free text, optional — e.g. "bad left knee, avoid deep squats"
};

export const DEFAULT_FITNESS_ANSWERS: FitnessDomainAnswers = {
  fitnessGoal: 'general-health',
  experienceLevel: 'beginner',
  daysPerWeek: 4,
  equipmentAccess: 'full-gym',
  injuriesOrLimits: '',
};

export type DietType = 'vegetarian' | 'non-vegetarian' | 'vegan' | 'eggetarian' | 'pescatarian' | 'no-preference';
export type DietGoal = 'bulk' | 'cut' | 'maintain' | 'recomp';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very-active' | 'extra-active';

export type DietDomainAnswers = {
  dietType: DietType;
  dietGoal: DietGoal;
  // null = "auto-calculate from weight/activity/goal" (Phase 5's job, using
  // the same "auto unless overridden" convention appConfig.ts already uses
  // for DietOverrideKey / OverviewOverrideKey). A number here is a person
  // who already knows their number and wants it respected verbatim — e.g.
  // the original request's "2700kcal vegetarian" example.
  targetCalories: number | null;
  activityLevel: ActivityLevel;
  allergiesOrDislikes: string; // free text, optional — comma-separated is fine, generator's job to parse
};

export const DEFAULT_DIET_ANSWERS: DietDomainAnswers = {
  dietType: 'no-preference',
  dietGoal: 'maintain',
  targetCalories: null,
  activityLevel: 'moderate',
  allergiesOrDislikes: '',
};

export type RoutineStyle = 'strict-blocks' | 'flexible-flow';

export type ProductivityDomainAnswers = {
  focusAreas: string; // free text — "deep work on my startup", "reading + writing habit", etc.
  routineStyle: RoutineStyle;
};

export const DEFAULT_PRODUCTIVITY_ANSWERS: ProductivityDomainAnswers = {
  focusAreas: '',
  routineStyle: 'flexible-flow',
};

export type CustomDomainAnswers = {
  // This is deliberately the same free-text box OnboardingWizard already
  // has today (`goalDescription`) — 'custom' is the escape hatch that
  // preserves 100% of today's behavior for anyone who doesn't fit the
  // other four domains, or who picks 'custom' alongside them for something
  // extra that doesn't have its own domain yet.
  description: string;
};

export const DEFAULT_CUSTOM_ANSWERS: CustomDomainAnswers = {
  description: '',
};

// ============================================================================
// 3. FULL QUESTIONNAIRE ANSWER BUNDLE
// ============================================================================
// This is the shape Phase 4's rebuilt OnboardingWizard will hold in state
// and pass to generation. `domains` drives which of the optional per-domain
// blocks are populated/asked — Phase 4's UI branches on this exactly the
// way the plan in PHASE_2_HANDOFF.md describes ("branching questions per
// goal domain chosen").

export type QuestionnaireAnswers = {
  // ---- Always asked, regardless of domain (mirrors today's intro screen) ----
  name: string;
  birthdate: string; // 'YYYY-MM-DD' — replaces today's raw `age` text input, consistent with DEFAULT_PROFILE's existing birthdate field (appConfig.ts already derives age from this, not the other way around)
  wake: string; // 'HH:MM'
  sleep: string; // 'HH:MM'
  targetDate: string; // 'YYYY-MM-DD', optional overall countdown — kept even with per-domain exam.examDate, since a fitness-only or productivity-only goal can still want a countdown (e.g. a race day, a launch date)

  // ---- Domain selection ----
  domains: GoalDomain[]; // 1+ required; UI should not let this be empty — 'custom' is the fallback if nothing else fits

  // ---- Per-domain answers — only ever read if the matching key is in `domains` ----
  exam: ExamDomainAnswers;
  fitness: FitnessDomainAnswers;
  diet: DietDomainAnswers;
  productivity: ProductivityDomainAnswers;
  custom: CustomDomainAnswers;
};

// Always-populated defaults for every domain block, not just selected ones —
// this way `answers.diet.dietType` is never `undefined` even if 'diet'
// isn't in `domains`, so buildGoalDescription/buildGoalContext (and Phase
// 4's form state) never need optional-chaining gymnastics. Domains not in
// `domains` simply have their block ignored by the composers below.
export const DEFAULT_QUESTIONNAIRE_ANSWERS: QuestionnaireAnswers = {
  name: '',
  birthdate: '',
  wake: '06:00',
  sleep: '23:00',
  targetDate: '',
  domains: [],
  exam: { ...DEFAULT_EXAM_ANSWERS },
  fitness: { ...DEFAULT_FITNESS_ANSWERS },
  diet: { ...DEFAULT_DIET_ANSWERS },
  productivity: { ...DEFAULT_PRODUCTIVITY_ANSWERS },
  custom: { ...DEFAULT_CUSTOM_ANSWERS },
};

export function hasDomain(answers: QuestionnaireAnswers, domain: GoalDomain): boolean {
  return answers.domains.includes(domain);
}

// ============================================================================
// 4. COMPOSITION HELPERS
// ============================================================================
// contentGen.ts's existing generate*() functions all take a free-text
// `goalDescription: string` (+ optional `context: string`). Rather than
// changing every one of those signatures in this phase (that's Phases
// 5-7's call once they're actually touching that generation logic), these
// two pure functions turn a structured QuestionnaireAnswers into the same
// shape of string those functions already accept today — so Phase 4 can
// wire the new branching UI straight into the *existing* generation calls
// immediately, and Phases 5-7 can upgrade individual generators to accept
// richer structured input later without anything upstream breaking in the
// meantime.
//
// Kept deliberately dumb (string concatenation, no AI calls, no
// network) — these are synchronous and trivially unit-testable.

const EXAM_LEVEL_TEXT: Record<ExamCurrentLevel, string> = {
  'just-starting': 'just starting preparation',
  'mid-prep': 'mid-way through preparation',
  'final-stretch': 'in the final stretch before the exam',
  'revision-only': 'past syllabus completion, in pure revision mode',
};

function describeExam(a: ExamDomainAnswers): string {
  const parts = [`preparing for ${a.examName || 'an exam'}`];
  if (a.currentLevel) parts.push(EXAM_LEVEL_TEXT[a.currentLevel]);
  if (a.examDate) parts.push(`exam date ${a.examDate}`);
  if (a.subjectsHint.trim()) parts.push(`subjects: ${a.subjectsHint.trim()}`);
  return parts.join(', ');
}

const FITNESS_GOAL_TEXT: Record<FitnessGoalType, string> = {
  strength: 'building strength',
  hypertrophy: 'building muscle (hypertrophy)',
  endurance: 'building endurance',
  'general-health': 'general fitness and health',
  'sport-specific': 'training for a specific sport',
};

function describeFitness(a: FitnessDomainAnswers): string {
  const parts = [
    FITNESS_GOAL_TEXT[a.fitnessGoal],
    `${a.experienceLevel} level`,
    `${a.daysPerWeek} training day${a.daysPerWeek === 1 ? '' : 's'} per week`,
    `equipment: ${a.equipmentAccess.replace(/-/g, ' ')}`,
  ];
  if (a.injuriesOrLimits.trim()) parts.push(`limitations: ${a.injuriesOrLimits.trim()}`);
  return parts.join(', ');
}

const DIET_TYPE_TEXT: Record<DietType, string> = {
  vegetarian: 'vegetarian',
  'non-vegetarian': 'non-vegetarian',
  vegan: 'vegan',
  eggetarian: 'eggetarian',
  pescatarian: 'pescatarian',
  'no-preference': 'no specific dietary preference',
};

const DIET_GOAL_TEXT: Record<DietGoal, string> = {
  bulk: 'bulking (calorie surplus)',
  cut: 'cutting (calorie deficit)',
  maintain: 'maintaining current weight',
  recomp: 'body recomposition',
};

function describeDiet(a: DietDomainAnswers): string {
  const parts = [DIET_TYPE_TEXT[a.dietType], DIET_GOAL_TEXT[a.dietGoal], `${a.activityLevel.replace(/-/g, ' ')} activity level`];
  parts.push(a.targetCalories ? `target ${a.targetCalories}kcal/day` : 'auto-calculate target calories');
  if (a.allergiesOrDislikes.trim()) parts.push(`avoid: ${a.allergiesOrDislikes.trim()}`);
  return parts.join(', ');
}

function describeProductivity(a: ProductivityDomainAnswers): string {
  const parts: string[] = [];
  if (a.focusAreas.trim()) parts.push(a.focusAreas.trim());
  parts.push(a.routineStyle === 'strict-blocks' ? 'prefers a strictly time-blocked routine' : 'prefers a flexible, flow-based routine');
  return parts.join(', ');
}

/**
 * Builds the single `goalDescription` string every existing generate*()
 * function in contentGen.ts takes as its first argument — one clause per
 * selected domain, joined together, plus the custom free-text box if
 * present. This is what makes a multi-domain pick (e.g. exam + fitness +
 * diet) work with today's generation functions unchanged: each function
 * still gets one string, it's just now a composed one instead of a single
 * free-text box's raw contents.
 *
 * Falls back to a generic phrase if somehow nothing was filled in (should
 * only happen via a direct skip, which OnboardingWizard already handles
 * separately without calling generation at all).
 */
export function buildGoalDescription(answers: QuestionnaireAnswers): string {
  const clauses: string[] = [];
  if (hasDomain(answers, 'exam')) clauses.push(describeExam(answers.exam));
  if (hasDomain(answers, 'fitness')) clauses.push(describeFitness(answers.fitness));
  if (hasDomain(answers, 'diet')) clauses.push(describeDiet(answers.diet));
  if (hasDomain(answers, 'productivity')) clauses.push(describeProductivity(answers.productivity));
  if (hasDomain(answers, 'custom') && answers.custom.description.trim()) clauses.push(answers.custom.description.trim());

  if (!clauses.length) return 'General self-improvement and daily routine building';
  return clauses.join('. ');
}

/**
 * Builds the `context` string most generate*() calls already accept
 * alongside goalDescription (wake/sleep/name today — see
 * OnboardingWizard's existing `context` constant). Kept separate from
 * buildGoalDescription because context is meta-information about the
 * person's day/identity, not part of "what is the goal," and some future
 * generator may want one but not the other.
 */
export function buildGoalContext(answers: QuestionnaireAnswers): string {
  const parts = [
    `Wake time: ${answers.wake}.`,
    `Sleep time: ${answers.sleep}.`,
    `Name: ${answers.name || 'not given'}.`,
  ];
  if (answers.targetDate) parts.push(`Target date: ${answers.targetDate}.`);
  return parts.join(' ');
}

// ============================================================================
// 5. DOMAIN -> TAB MAPPING
// ============================================================================
// Design reference for Phase 8 ("Dynamic tab system"), not consumed by any
// code yet. `CORE_TAB_KEYS` are tabs every account gets regardless of
// domain (a daily overview, a timeline, and a history view are universal —
// nobody's setup should lack a "how did today/this month go" view just
// because their goal is diet-only). `DOMAIN_TAB_KEYS` are additive per
// selected domain; Phase 8's job is to union CORE_TAB_KEYS with
// DOMAIN_TAB_KEYS[d] for every d in the account's stored domains.
//
// Two things intentionally flagged rather than resolved here, since
// resolving them means touching tab/section rendering code, which is out
// of scope for a types-only phase:
//
// 1. 'training' is shared by both 'fitness' and 'diet' — the tab is
//    currently named "Training & Fuel" and contains two sections
//    (tf_workout, tf_fuel — see SECTION_LABEL_ROWS in appConfig.ts). A
//    diet-only account (no 'fitness' domain) should probably still get
//    this tab for the Fuel Matrix section, but NOT the workout split
//    section. Phase 8 will need section-level granularity, not just
//    tab-level — SECTION_LABEL_ROWS already has the tabKey grouping this
//    would build on (tf_workout vs tf_fuel are already distinct keys).
// 2. 'ashclock' (Clock/subject-hours) and 'mocktests' are exam-shaped by
//    default (subject hours, mock test scores) — mapped under 'exam' below.
//    RESOLVED in Phase 9 Part 2 (was left open through Phases 8 and 9 Part
//    1 — see PHASE_8_HANDOFF.md and PHASE_9_PART1_HANDOFF.md): 'ashclock'
//    is now ALSO given to 'productivity' accounts; 'mocktests' stays
//    exam-only. Reasoning: 'ashclock' is a fade-digit clock + Pomodoro
//    focus-timer + per-"subject" hour log — nothing about that component
//    is actually exam-flavored (`PomodoroSubjectStats`/`PomodoroView` both
//    already read `subjects` generically off `ConfigContext`, and a
//    non-exam account already gets a real, non-empty `subjects` array —
//    see `fallbackSyllabus(goalDescription, false)` in
//    OnboardingWizard.tsx, which produces a single generic "General"
//    subject rather than leaving the array empty). A 'productivity'
//    account choosing to track focused work sessions against a
//    "subject" (really: a project/activity) is exactly what this
//    component is for, just without exam framing. 'mocktests', by
//    contrast, is fundamentally about logging *practice-test scores*
//    against a *max-marks* — there's no productivity-domain equivalent of
//    "a test" to log, so generalizing it would mean inventing a feature,
//    not just relaxing a gate. 'custom' and 'diet'/'fitness'-only accounts
//    still don't get 'ashclock' by default — 'custom' has no well-defined
//    shape to justify it, and a diet/fitness-only account already has a
//    dedicated Training & Fuel tab for its actual tracking needs.
export const CORE_TAB_KEYS: TabLabelKey[] = ['overview', 'timeline', 'todo', 'akyboard', 'history'];

export const DOMAIN_TAB_KEYS: Record<GoalDomain, TabLabelKey[]> = {
  exam: ['syllabus', 'mocktests', 'ashclock'],
  fitness: ['training'],
  diet: ['training'],
  productivity: ['ashclock'],
  custom: [],
};

/**
 * Pure preview helper for Phase 8 to build on (or replace) once it wires
 * this into App.tsx's real tab list. Returns a de-duplicated, TABS-ordered
 * set of tab keys for a given set of selected domains. `tabOrder` should be
 * the app's canonical TABS order (see appConfig.ts) so this never
 * reshuffles tabs relative to today's fixed order — it only ever removes
 * ones that aren't relevant.
 */
export function resolveTabKeysForDomains(domains: GoalDomain[], tabOrder: TabLabelKey[]): TabLabelKey[] {
  const wanted = new Set<TabLabelKey>(CORE_TAB_KEYS);
  for (const d of domains) {
    for (const k of DOMAIN_TAB_KEYS[d] ?? []) wanted.add(k);
  }
  // Settings/account are pinned outside TABS in the sidebar today (see
  // DEFAULT_TAB_LABELS/TAB_LABEL_KEYS including them separately) — this
  // function only resolves the *TABS array* tabs, so it doesn't need to
  // special-case them, but it's safe either way since Set + filter just
  // ignores keys tabOrder doesn't contain.
  return tabOrder.filter((k) => wanted.has(k));
}

// ----------------------------------------------------------------------------
// Phase 8 addendum — resolves open question 1 left above: 'training' is
// shown (via DOMAIN_TAB_KEYS) for EITHER 'fitness' OR 'diet', but the tab
// itself bundles two sections (see SECTION_LABEL_ROWS in appConfig.ts:
// 'tf_workout' — the workout split — and 'tf_fuel' — the Fuel Matrix).
// A diet-only account (no 'fitness' domain) should see the tab, for its
// Fuel Matrix, but not the workout-split section that has nothing to do
// with its goal; symmetrically, a fitness-only account (no 'diet' domain)
// shouldn't see the Fuel Matrix. This map + function give that
// section-level granularity, resolved here rather than left open, per
// Phase 8's instructions.
//
// Deliberately small and explicit rather than derived from
// DOMAIN_TAB_KEYS automatically: only sections that are STRICTLY narrower
// than their tab's own domain gating need an entry here at all. Every
// other section in SECTION_LABEL_ROWS (e.g. 'ov_profile', 'syl_runway')
// is exactly as visible as its parent tab already is once
// resolveTabKeysForDomains has run — gating it again here would be
// redundant, not wrong, so it's simply left out.
//
// Phase 9 Part 2 addendum: that reasoning silently assumed every section's
// parent tab is itself domain-gated. 'ov_syllabus' lives on the Overview
// tab, which is in CORE_TAB_KEYS (always visible, every account) — so
// unlike tf_workout/tf_fuel's parent (Training & Fuel, domain-gated),
// nothing was actually narrowing 'ov_syllabus' for a non-exam account.
// Confirmed live by reading OnboardingWizard.tsx's `fallbackSyllabus`:
// a non-exam account still gets a real (if generic, "This month —
// Getting started") syllabus/phase written to config so nothing crashes,
// which meant a diet-only or fitness-only account was seeing a "Syllabus
// Runway" card with placeholder exam-prep content that has nothing to do
// with their actual goal. Added here so OverviewTab.tsx can gate it the
// same way TrainingFuelTab.tsx gates tf_workout/tf_fuel.
export const SECTION_DOMAIN_KEYS: Partial<Record<string, GoalDomain[]>> = {
  tf_workout: ['fitness'],
  tf_fuel: ['diet'],
  ov_syllabus: ['exam'],
};

/**
 * Pure visibility check for a single SECTION_LABEL_ROWS key, given an
 * account's resolved domains. `domains === null` means "legacy/unrestricted
 * account" (see DEFAULT_DOMAINS in appConfig.ts) — always visible, same
 * "dynamic tabs only ever narrow a real onboarded account" rule
 * resolveTabKeysForDomains's caller (App.tsx) applies at the tab level.
 * A section with no entry in SECTION_DOMAIN_KEYS is ungated at this level
 * (its tab's own gating already covers it) and is always visible once its
 * tab is.
 *
 * NOT wired into TrainingFuelTab.tsx's actual JSX this phase — the
 * mechanism exists and is unit-tested, but consuming it to conditionally
 * render tf_workout/tf_fuel is a component-render change outside this
 * phase's file scope (appConfig.ts + App.tsx + this file only, see
 * PHASE_8_HANDOFF.md). Flagged forward for Phase 9 or whoever next touches
 * TrainingFuelTab.tsx.
 *
 * Phase 9 Part 2 update: now wired in for real. TrainingFuelTab.tsx calls
 * this for 'tf_workout'/'tf_fuel', and OverviewTab.tsx calls it for the
 * 'ov_syllabus' entry added above. This doc comment is left largely intact
 * (rather than rewritten) as a record of the original deferral, per this
 * project's convention of not silently erasing prior phases' reasoning.
 */
export function isSectionVisibleForDomains(sectionKey: string, domains: GoalDomain[] | null): boolean {
  if (domains === null) return true;
  const required = SECTION_DOMAIN_KEYS[sectionKey];
  if (!required || required.length === 0) return true;
  return required.some((d) => domains.includes(d));
}

// ============================================================================
// 6. PROFILE FIELD EXTENSIONS
// ============================================================================
// appConfig.ts's DEFAULT_PROFILE/Profile-shaped objects are intentionally
// NOT modified in this phase (see PHASE_3_HANDOFF.md — "design + types
// only"). This type describes the *additional* fields a generated profile
// will need once Phase 9 ("wire it all end-to-end") actually merges
// questionnaire answers into a real profile object. It's additive/optional
// on purpose so an existing account's profile (missing all of these) stays
// perfectly valid — same "hydrate with defaults for anything missing"
// convention appConfig.ts already uses throughout (hydrateDietOverrides,
// hydrateTabLabels, etc.).
export type QuestionnaireProfileFields = {
  domains: GoalDomain[];
  dietType?: DietType;
  dietGoal?: DietGoal;
  targetCalories?: number | null;
  activityLevel?: ActivityLevel;
  fitnessGoal?: FitnessGoalType;
  experienceLevel?: ExperienceLevel;
  examName?: string;
};

/**
 * Derives the profile-extension fields from a completed questionnaire.
 * Pure and synchronous — no defaults are invented here beyond "leave the
 * field out if that domain wasn't selected," matching
 * QuestionnaireProfileFields's all-optional shape above. Phase 9 spreads
 * this onto whatever profile object it's building (`{ ...DEFAULT_PROFILE,
 * ...deriveProfileFields(answers), ... }`), the same pattern the app
 * already uses for hydration everywhere else.
 */
export function deriveProfileFields(answers: QuestionnaireAnswers): QuestionnaireProfileFields {
  const out: QuestionnaireProfileFields = { domains: answers.domains };
  if (hasDomain(answers, 'diet')) {
    out.dietType = answers.diet.dietType;
    out.dietGoal = answers.diet.dietGoal;
    out.targetCalories = answers.diet.targetCalories;
    out.activityLevel = answers.diet.activityLevel;
  }
  if (hasDomain(answers, 'fitness')) {
    out.fitnessGoal = answers.fitness.fitnessGoal;
    out.experienceLevel = answers.fitness.experienceLevel;
  }
  if (hasDomain(answers, 'exam') && answers.exam.examName.trim()) {
    out.examName = answers.exam.examName.trim();
  }
  return out;
}