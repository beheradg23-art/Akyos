import React, { useEffect, useState } from 'react';
import { NO_SELECT_CSS } from '../styles/noSelect';
import { DateField, TimeField } from './ui/Primitives';
import {
  Sparkles, Loader2, RefreshCcw, ArrowRight, ArrowLeft, ClipboardList,
  Clock3, Dumbbell, Target, CheckCircle2, BookOpen, GraduationCap,
  Utensils, LayoutGrid,
} from 'lucide-react';
import {
  generateChecklist,
  generateDailyTimeline,
  generateProfileTargets,
  // Phase 9 Part 1: the wizard now calls the structured, domain-aware
  // generators Phases 5-7 built (generateDietPlan / generateTrainingPlan /
  // generateExamSyllabus) instead of the original generic
  // generateWeeklyTraining / generateSyllabus. Those two original functions
  // are UNCHANGED and still exist in contentGen.ts (kept for anything else
  // that might call them) — this file just no longer imports them. See
  // PHASE_9_PART1_HANDOFF.md for the full reasoning.
  generateDietPlan,
  generateTrainingPlan,
  generateExamSyllabus,
  // Last-resort, fully-local fallback builders — used only if the structured
  // generate*() calls above somehow throw past their own internal try/catch
  // (defensive; shouldn't happen in practice, see PHASE_9_PART1_HANDOFF.md).
  // Reusing these (rather than this file's own generic fallbackTraining/
  // fallbackSyllabus) means even a total-failure path still produces
  // daysPerWeek/currentLevel-aware content instead of a one-size-fits-all
  // placeholder.
  calculateDietTargets,
  buildFallbackDietPlan,
  buildFallbackWeeklyTrainingPlan,
  buildFallbackSyllabus,
  type DietPlanMeal,
} from '../lib/contentGen';
import {
  GOAL_DOMAINS,
  DEFAULT_QUESTIONNAIRE_ANSWERS,
  hasDomain,
  buildGoalDescription,
  buildGoalContext,
  deriveProfileFields,
  type GoalDomain,
  type QuestionnaireAnswers,
  type ExamCurrentLevel,
  type FitnessGoalType,
  type ExperienceLevel,
  type EquipmentAccess,
  type DietType,
  type DietGoal,
  type ActivityLevel,
  type RoutineStyle,
} from '../lib/questionnaire';
// Phase 9 Part 1: hydrate generated timeline/diet data into the real,
// icon-bearing shape appConfig.ts's own state already uses (see "Bug fixed"
// in PHASE_9_PART1_HANDOFF.md — config.timeline/config.diet items need a
// resolved `.icon` component, not just an `iconName` string, or the
// Timeline/Training & Fuel tabs crash trying to render `<slot.icon />`).
import { hydrateTimeline, hydrateDiet, DEFAULT_DIET_OVERRIDES, type DietOverrideKey } from '../lib/appConfig';

// ---------- First-run setup ----------
// Shown once, right after a new account picks its passcode (see App.tsx —
// gated on `akyos_onboarding_completed_v1`). Phase 4: this is a rebuild of
// the wizard's UI on top of Phase 3's `questionnaire.ts` data model — the
// old single "describe your goal" textbox + two checkboxes is replaced by
// a domain multi-select (a person can pick more than one — e.g. exam prep
// + fitness + diet all at once) followed by one branching question screen
// per selected domain. Generation itself (the five generate*() calls
// below) is UNCHANGED from before — buildGoalDescription()/
// buildGoalContext() compose the structured answers into the same
// goalDescription/context strings those functions already accepted, so
// this phase only touches what's asked and how it's assembled, not how
// it's generated. If generation fails for a section (offline, API
// hiccup), we fall back to a plain generic default for that section only
// — never to someone else's real data.

type Stage = 'intro' | 'domain' | 'generating' | 'review';

type ChecklistItem = { id: string; label: string };
type TimelineBlock = {
  start: string; end: string; label: string; detail: string;
  type: 'study' | 'gym' | 'meal' | 'prep' | 'sleep';
  subject?: string; longDesc: string; iconName: string;
};
type TrainingDay = { day: string; focus: string; mode: 'gym' | 'calisthenics' | 'rest'; exercises: { name: string; sets: string }[] };
type ProfileTarget = { rank: number; name: string; course: string; tag: string; color: string; desc: string };
type Subject = { key: string; label: string; color: string };
type SyllabusPhase = { phase: number; month: string; label: string; subjects: Record<string, string[]> };

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Icon per domain, for the intro screen's multi-select chips. Kept as a
// local lookup (rather than adding an icon field to GOAL_DOMAINS in
// questionnaire.ts) since questionnaire.ts is deliberately UI-agnostic —
// see its Phase 3 header comment.
const DOMAIN_ICONS: Record<GoalDomain, any> = {
  exam: GraduationCap,
  fitness: Dumbbell,
  diet: Utensils,
  productivity: LayoutGrid,
  custom: Sparkles,
};

function fallbackChecklist(): ChecklistItem[] {
  return [
    { id: 'ob_1', label: 'Morning routine done' },
    { id: 'ob_2', label: 'Main focus block completed' },
    { id: 'ob_3', label: 'Movement / exercise' },
    { id: 'ob_4', label: 'Wind down on time' },
  ];
}

function fallbackTimeline(wake: string, sleep: string): TimelineBlock[] {
  return [
    { start: wake, end: addMinutes(wake, 30), label: 'Wake & Prep', detail: 'Ease into the day', type: 'prep', longDesc: 'A simple start — hydrate and get ready for the day ahead.', iconName: 'Sunrise' },
    { start: addMinutes(wake, 30), end: addMinutes(wake, 210), label: 'Main Focus Block', detail: 'Your top priority for the day', type: 'study', longDesc: 'Edit this in Settings to describe exactly what you\'re working on.', iconName: 'BookOpen' },
    { start: addMinutes(wake, 210), end: addMinutes(wake, 240), label: 'Meal Break', detail: '', type: 'meal', longDesc: '', iconName: 'Utensils' },
    { start: addMinutes(wake, 240), end: subMinutes(sleep, 60), label: 'Second Focus Block', detail: 'Continue working toward your goal', type: 'study', longDesc: '', iconName: 'BookOpen' },
    { start: subMinutes(sleep, 60), end: sleep, label: 'Wind Down', detail: 'Screens off, plan tomorrow', type: 'prep', longDesc: '', iconName: 'Moon' },
    { start: sleep, end: sleep, label: 'Sleep', detail: 'Hard stop.', type: 'sleep', longDesc: '', iconName: 'Moon' },
  ];
}

function fallbackTraining(wantsTraining: boolean): TrainingDay[] {
  if (!wantsTraining) {
    return DAY_NAMES.map((day) => ({ day, focus: 'Rest / Recovery', mode: 'rest', exercises: [{ name: 'Not part of your current plan', sets: '—' }] }));
  }
  return DAY_NAMES.map((day, i) => (
    i % 2 === 0
      ? { day, focus: 'Full-Body Strength', mode: 'gym', exercises: [{ name: 'Squats', sets: '3×10' }, { name: 'Push-ups', sets: '3×12' }, { name: 'Rows', sets: '3×12' }] }
      : { day, focus: 'Active Recovery', mode: 'rest', exercises: [{ name: 'Light walk or stretch', sets: '20 min' }] }
  ));
}

function fallbackTargets(goalDescription: string): { targets: ProfileTarget[]; baselineLabel: string } {
  return {
    baselineLabel: 'Baseline Score',
    targets: [
      { rank: 1, name: goalDescription.slice(0, 60) || 'Your main goal', course: '', tag: 'Top Priority', color: 'blue', desc: 'Edit this in Settings > Profile & Goals to add specifics.' },
    ],
  };
}

// When the person's goal has no "subjects to study" component at all (or
// generation fails), fall back to a single generic subject/phase built
// from their own goal text — never to someone else's syllabus (e.g. JEE's
// math/physics/chem, which is just this app's own DEFAULT_SUBJECTS/
// DEFAULT_SYLLABUS fallback in App.tsx, used only if this step is skipped
// entirely).
function fallbackSyllabus(goalDescription: string, wantsSyllabus: boolean): { subjects: Subject[]; syllabus: SyllabusPhase[] } {
  if (!wantsSyllabus) {
    return {
      subjects: [{ key: 'general', label: 'General', color: 'sky' }],
      syllabus: [{ phase: 1, month: 'This month', label: 'Getting started', subjects: { general: [] } }],
    };
  }
  return {
    subjects: [{ key: 'subject_1', label: goalDescription.slice(0, 30) || 'Main Subject', color: 'sky' }],
    syllabus: [{ phase: 1, month: 'Month 1', label: 'Getting started', subjects: { subject_1: ['Add your first topic'] } }],
  };
}

// ---- Phase 9 Part 1: last-resort local fallbacks for the three structured
// generators. generateDietPlan/generateTrainingPlan/generateExamSyllabus
// already resolve internally to their own buildFallback*() on an AI
// failure, so these wrappers only ever run if the call itself throws past
// that (network layer blowing up before generate()'s own try/catch, etc.) —
// belt-and-suspenders, matching this project's established defensive style.
// Kept separate from the generic fallbackTraining()/fallbackSyllabus()
// above so even this total-failure path stays domain-aware (real
// daysPerWeek-sized split, real currentLevel-shaped roadmap) instead of a
// one-size-fits-all placeholder.
function localDietFallback(a: QuestionnaireAnswers['diet']) {
  const targets = calculateDietTargets(a);
  return {
    meals: buildFallbackDietPlan(a, targets),
    targetCalories: targets.calories,
    targetProteinG: targets.proteinG,
    targetHydrationL: targets.hydrationL,
    usedFallback: true,
  };
}
function localTrainingFallback(a: QuestionnaireAnswers['fitness']) {
  return { days: buildFallbackWeeklyTrainingPlan(a), usedFallback: true };
}
function localSyllabusFallback(a: QuestionnaireAnswers['exam']) {
  return { ...buildFallbackSyllabus(a), usedFallback: true };
}

function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = (h * 60 + m + mins + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
function subMinutes(time: string, mins: number): string {
  return addMinutes(time, -mins);
}

// A neutral default birthdate (~18 years ago), same convention as
// DEFAULT_PROFILE.birthdate in appConfig.ts — used only if the person
// leaves the birthdate field untouched.
function defaultBirthdate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d.toISOString().split('T')[0];
}

const inputCls = 'w-full rounded-xl border border-neutral-800 bg-neutral-900/80 px-4 py-3 text-[13px] text-neutral-100 placeholder-neutral-600 outline-none transition-colors focus:border-violet-500/50';
const labelCls = 'text-[11px] uppercase tracking-wide text-neutral-500 font-semibold block mb-1.5';
const hintCls = 'mt-1 text-[11px] text-neutral-600';

// Reusable "pick one" chip row — used throughout the per-domain question
// screens below (currentLevel, fitnessGoal, dietType, etc.). Deliberately
// tiny/local rather than a shared Primitives export: these option sets are
// specific to this wizard's copy and unlikely to be reused elsewhere.
function ChipSelect<T extends string>({
  options, value, onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-lg border px-3 py-2 text-[12px] font-medium transition-colors ${
              active
                ? 'border-violet-500/60 bg-violet-500/15 text-violet-300'
                : 'border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:text-neutral-200'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

const EXAM_LEVEL_OPTIONS: { value: ExamCurrentLevel; label: string }[] = [
  { value: 'just-starting', label: 'Just starting' },
  { value: 'mid-prep', label: 'Mid-way through' },
  { value: 'final-stretch', label: 'Final stretch' },
  { value: 'revision-only', label: 'Revision only' },
];

const FITNESS_GOAL_OPTIONS: { value: FitnessGoalType; label: string }[] = [
  { value: 'strength', label: 'Strength' },
  { value: 'hypertrophy', label: 'Build muscle' },
  { value: 'endurance', label: 'Endurance' },
  { value: 'general-health', label: 'General health' },
  { value: 'sport-specific', label: 'A specific sport' },
];

const EXPERIENCE_OPTIONS: { value: ExperienceLevel; label: string }[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

const EQUIPMENT_OPTIONS: { value: EquipmentAccess; label: string }[] = [
  { value: 'full-gym', label: 'Full gym' },
  { value: 'home-basic', label: 'Home / basic kit' },
  { value: 'bodyweight-only', label: 'Bodyweight only' },
];

const DIET_TYPE_OPTIONS: { value: DietType; label: string }[] = [
  { value: 'no-preference', label: 'No preference' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'non-vegetarian', label: 'Non-vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'eggetarian', label: 'Eggetarian' },
  { value: 'pescatarian', label: 'Pescatarian' },
];

const DIET_GOAL_OPTIONS: { value: DietGoal; label: string }[] = [
  { value: 'maintain', label: 'Maintain' },
  { value: 'bulk', label: 'Bulk' },
  { value: 'cut', label: 'Cut' },
  { value: 'recomp', label: 'Recomposition' },
];

const ACTIVITY_LEVEL_OPTIONS: { value: ActivityLevel; label: string }[] = [
  { value: 'sedentary', label: 'Sedentary' },
  { value: 'light', label: 'Lightly active' },
  { value: 'moderate', label: 'Moderately active' },
  { value: 'very-active', label: 'Very active' },
  { value: 'extra-active', label: 'Extra active' },
];

const ROUTINE_STYLE_OPTIONS: { value: RoutineStyle; label: string }[] = [
  { value: 'flexible-flow', label: 'Flexible / go with the flow' },
  { value: 'strict-blocks', label: 'Strict time blocks' },
];

export default function OnboardingWizard({
  onComplete,
}: {
  onComplete: (partial: {
    trackerItems: ChecklistItem[]; timeline: TimelineBlock[]; training: TrainingDay[]; profile: any;
    subjects: Subject[]; syllabus: SyllabusPhase[];
    // Phase 9 Part 1 additions — all optional so this stays a strict
    // superset of what onComplete accepted before. `domains` is the
    // TOP-LEVEL config.domains field Phase 8 built the dynamic tab system
    // around (deliberately distinct from `profile.domains`, which
    // deriveProfileFields() already puts on the profile object itself — see
    // that function's own doc comment on why they're separate fields).
    // `diet`/`dietOverrides` are only ever included when the 'diet' domain
    // was selected (see finish() below) — a non-diet account's
    // config.diet/config.dietOverrides are left completely untouched.
    domains?: GoalDomain[];
    diet?: any[];
    dietOverrides?: Partial<Record<DietOverrideKey, string>>;
  }) => void;
}) {
  const [stage, setStage] = useState<Stage>('intro');
  const [answers, setAnswers] = useState<QuestionnaireAnswers>(() => ({
    ...DEFAULT_QUESTIONNAIRE_ANSWERS,
    birthdate: defaultBirthdate(),
  }));
  // Index into the person's *selected* domains (in GOAL_DOMAINS' canonical
  // order) while stepping through the branching question screens — one
  // domain's questions per screen, advanced by the Next/Back buttons.
  const [domainStep, setDomainStep] = useState(0);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [error, setError] = useState('');

  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [timeline, setTimeline] = useState<TimelineBlock[]>([]);
  const [training, setTraining] = useState<TrainingDay[]>([]);
  const [targets, setTargets] = useState<{ targets: ProfileTarget[]; baselineLabel: string }>({ targets: [], baselineLabel: 'Baseline Score' });
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [syllabus, setSyllabus] = useState<SyllabusPhase[]>([]);
  // Phase 9 Part 1: only meaningful when the 'diet' domain is selected —
  // stays empty otherwise, and finish()/skip() only ever write config.diet/
  // config.dietOverrides when it's populated, so a non-diet account's Fuel
  // Matrix is left completely untouched (still whatever DEFAULT_DIET_*
  // appConfig.ts already starts every account with), exactly like before
  // this phase.
  const [diet, setDiet] = useState<DietPlanMeal[]>([]);
  const [dietTargets, setDietTargets] = useState<{ calories: number; proteinG: number; hydrationL: number } | null>(null);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  // Tracks which sections are showing generic fallback content rather than
  // the actual AI-generated plan (generation failed, timed out, or was
  // skipped). Surfaced in the review screen so the person knows what they're
  // looking at isn't personalized yet, instead of silently passing off a
  // placeholder as the real thing.
  const [usedFallback, setUsedFallback] = useState<Record<'checklist' | 'timeline' | 'training' | 'targets' | 'syllabus' | 'diet', boolean>>({
    checklist: false, timeline: false, training: false, targets: false, syllabus: false, diet: false,
  });

  const loadingMessages = [
    'Reading what you told us…',
    'Building your daily checklist…',
    'Laying out your timeline…',
    'Putting together your plan…',
  ];

  useEffect(() => {
    if (stage !== 'generating') return;
    const t = setInterval(() => setLoadingMsgIdx((i) => (i + 1) % loadingMessages.length), 1400);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // Selected domains, kept in GOAL_DOMAINS' fixed display order regardless
  // of the order they were clicked in — so the question-screen sequence
  // (and the composed goalDescription's clause order) is always stable and
  // predictable rather than depending on click order.
  const selectedDomains: GoalDomain[] = GOAL_DOMAINS
    .map((d) => d.key)
    .filter((k) => hasDomain(answers, k));

  const wantsTraining = hasDomain(answers, 'fitness');
  const wantsSyllabus = hasDomain(answers, 'exam');
  const wantsDiet = hasDomain(answers, 'diet');

  const goalDescription = buildGoalDescription(answers);
  const context = buildGoalContext(answers);

  const runGeneration = async () => {
    setStage('generating');
    setError('');

    // Phase 9 Part 1: training/syllabus/diet now go through the structured,
    // domain-aware generators (Phases 5-7) instead of the generic
    // goalDescription-string ones — see the import block's comment for why.
    // checklist/timeline/targets are untouched: they have no structured
    // per-domain answer shape to upgrade to, so they still take the composed
    // goalDescription/context strings exactly as before.
    const [checklistRes, timelineRes, trainingRes, targetsRes, syllabusRes, dietRes] = await Promise.all([
      generateChecklist(goalDescription, context).catch(() => null),
      generateDailyTimeline(goalDescription, context).catch(() => null),
      wantsTraining ? generateTrainingPlan(answers.fitness, context).catch(() => null) : Promise.resolve(null),
      generateProfileTargets(goalDescription).catch(() => null),
      wantsSyllabus ? generateExamSyllabus(answers.exam, context).catch(() => null) : Promise.resolve(null),
      wantsDiet ? generateDietPlan(answers.diet, undefined, context).catch(() => null) : Promise.resolve(null),
    ]);

    const checklistOk = !!checklistRes?.items?.length;
    const timelineOk = !!timelineRes?.blocks?.length;
    const targetsOk = !!targetsRes?.targets?.length;

    // trainingRes/syllabusRes/dietRes already resolve to real, usable
    // content themselves (they never return null on an AI failure — only a
    // total exception makes them null here). If one IS null, fall through to
    // this file's own local*Fallback() wrappers (still domain-aware, see
    // above) rather than treating a null result as "nothing to show."
    const trainingResolved = wantsTraining ? (trainingRes ?? localTrainingFallback(answers.fitness)) : null;
    const syllabusResolved = wantsSyllabus ? (syllabusRes ?? localSyllabusFallback(answers.exam)) : null;
    const dietResolved = wantsDiet ? (dietRes ?? localDietFallback(answers.diet)) : null;

    setChecklist(checklistOk ? checklistRes!.items.map((it, i) => ({ id: `ob_${i}`, label: it.label })) : fallbackChecklist());
    setTimeline(timelineOk ? timelineRes!.blocks : fallbackTimeline(answers.wake, answers.sleep));
    setTraining(trainingResolved ? trainingResolved.days : fallbackTraining(false));
    setTargets(
      targetsOk
        ? { targets: targetsRes!.targets, baselineLabel: targetsRes!.baselineLabel || 'Baseline Score' }
        : fallbackTargets(goalDescription)
    );
    if (syllabusResolved) {
      setSubjects(syllabusResolved.subjects);
      setSyllabus(syllabusResolved.phases);
    } else {
      const fb = fallbackSyllabus(goalDescription, false);
      setSubjects(fb.subjects);
      setSyllabus(fb.syllabus);
    }
    if (dietResolved) {
      setDiet(dietResolved.meals);
      setDietTargets({ calories: dietResolved.targetCalories, proteinG: dietResolved.targetProteinG, hydrationL: dietResolved.targetHydrationL });
    } else {
      setDiet([]);
      setDietTargets(null);
    }

    setUsedFallback({
      checklist: !checklistOk,
      timeline: !timelineOk,
      training: trainingResolved ? trainingResolved.usedFallback : false,
      targets: !targetsOk,
      syllabus: syllabusResolved ? syllabusResolved.usedFallback : false,
      diet: dietResolved ? dietResolved.usedFallback : false,
    });

    setStage('review');
  };

  const regenerate = async (section: 'checklist' | 'timeline' | 'training' | 'targets' | 'syllabus' | 'diet') => {
    setRegenerating(section);
    try {
      if (section === 'checklist') {
        const res = await generateChecklist(goalDescription, context).catch(() => null);
        const ok = !!res?.items?.length;
        setChecklist(ok ? res!.items.map((it, i) => ({ id: `ob_${i}`, label: it.label })) : fallbackChecklist());
        setUsedFallback((f) => ({ ...f, checklist: !ok }));
      } else if (section === 'timeline') {
        const res = await generateDailyTimeline(goalDescription, context).catch(() => null);
        const ok = !!res?.blocks?.length;
        setTimeline(ok ? res!.blocks : fallbackTimeline(answers.wake, answers.sleep));
        setUsedFallback((f) => ({ ...f, timeline: !ok }));
      } else if (section === 'training') {
        const res = wantsTraining ? await generateTrainingPlan(answers.fitness, context).catch(() => null) : null;
        const resolved = wantsTraining ? (res ?? localTrainingFallback(answers.fitness)) : null;
        setTraining(resolved ? resolved.days : fallbackTraining(false));
        setUsedFallback((f) => ({ ...f, training: resolved ? resolved.usedFallback : false }));
      } else if (section === 'syllabus') {
        const res = wantsSyllabus ? await generateExamSyllabus(answers.exam, context).catch(() => null) : null;
        const resolved = wantsSyllabus ? (res ?? localSyllabusFallback(answers.exam)) : null;
        if (resolved) {
          setSubjects(resolved.subjects);
          setSyllabus(resolved.phases);
        } else {
          const fb = fallbackSyllabus(goalDescription, false);
          setSubjects(fb.subjects);
          setSyllabus(fb.syllabus);
        }
        setUsedFallback((f) => ({ ...f, syllabus: resolved ? resolved.usedFallback : false }));
      } else if (section === 'diet') {
        const res = wantsDiet ? await generateDietPlan(answers.diet, undefined, context).catch(() => null) : null;
        const resolved = wantsDiet ? (res ?? localDietFallback(answers.diet)) : null;
        if (resolved) {
          setDiet(resolved.meals);
          setDietTargets({ calories: resolved.targetCalories, proteinG: resolved.targetProteinG, hydrationL: resolved.targetHydrationL });
        } else {
          setDiet([]);
          setDietTargets(null);
        }
        setUsedFallback((f) => ({ ...f, diet: resolved ? resolved.usedFallback : false }));
      } else {
        const res = await generateProfileTargets(goalDescription).catch(() => null);
        const ok = !!res?.targets?.length;
        setTargets(ok ? { targets: res!.targets, baselineLabel: res!.baselineLabel || 'Baseline Score' } : fallbackTargets(goalDescription));
        setUsedFallback((f) => ({ ...f, targets: !ok }));
      }
    } finally {
      setRegenerating(null);
    }
  };

  // Short human label for the profile card / target-1 fallback name.
  // Prefers whatever's most specific to what was actually asked: an exam
  // name, then the custom free-text box, then the full composed
  // description as a last resort.
  const goalLabel = (answers.exam.examName || answers.custom.description || goalDescription).slice(0, 60);

  const finish = () => {
    // Phase 9 Part 1 bug fix: hydrate through appConfig.ts's own
    // hydrateTimeline/hydrateDiet before handing off to config — both
    // generated (AI or fallback) timeline blocks and diet meals only carry
    // an `iconName` string, but TimelineTab/TrainingFuelTab read `.icon` as
    // an actual component (`<slot.icon />` / `<m.icon />`). Without this,
    // finishing onboarding with a real timeline (every account) or a
    // generated diet plan (any 'diet'-domain account) would crash the very
    // next render — see PHASE_9_PART1_HANDOFF.md, "Bug fixed", for the full
    // trace. updateConfig() in App.tsx just spreads whatever's handed to it
    // with no hydration step of its own, so this has to happen here.
    const hydratedTimeline = hydrateTimeline(timeline);
    const hydratedDiet = wantsDiet ? hydrateDiet(diet) : undefined;
    const dietOverridesOut: Partial<Record<DietOverrideKey, string>> | undefined = wantsDiet && dietTargets
      ? {
          // Explicit numeric targets, not left to re-derive from the
          // (possibly scaled/approximated) meal text via
          // computeDietAutoValues — this is what makes an explicit
          // "2700kcal vegetarian" answer stay exactly 2700kcal once it
          // lands in the live Fuel Matrix, not just during onboarding.
          calories: `~${dietTargets.calories} kcal`,
          protein: `~${dietTargets.proteinG}g protein`,
          hydration: `~${dietTargets.hydrationL.toFixed(1)}L water/day`,
        }
      : undefined;

    onComplete({
      trackerItems: checklist,
      timeline: hydratedTimeline as TimelineBlock[],
      training,
      profile: {
        name: answers.name || 'Your Name',
        goalLabel: goalLabel || 'Add your goal',
        birthdate: answers.birthdate || defaultBirthdate(),
        height: 170,
        weight: 65,
        category: '',
        baseline: 0,
        baselineLabel: targets.baselineLabel,
        boards: 0,
        targetDate: answers.targetDate || answers.exam.examDate || '',
        targets: targets.targets,
        // Extra fields from the questionnaire (domains, dietType, dietGoal,
        // targetCalories, activityLevel, fitnessGoal, experienceLevel,
        // examName). This is a DIFFERENT field than the top-level `domains`
        // below — see deriveProfileFields()'s own doc comment in
        // questionnaire.ts for why they're kept separate.
        ...deriveProfileFields(answers),
      },
      subjects,
      syllabus,
      // Phase 9 Part 1: this is what actually makes Phase 8's dynamic tab
      // system live for the first time — App.tsx's `visibleTabs` reads
      // config.domains directly (not profile.domains).
      domains: answers.domains,
      ...(hydratedDiet ? { diet: hydratedDiet } : {}),
      ...(dietOverridesOut ? { dietOverrides: dietOverridesOut } : {}),
    });
  };

  const skip = () => {
    const fb = fallbackSyllabus('', true);
    onComplete({
      trackerItems: fallbackChecklist(),
      timeline: hydrateTimeline(fallbackTimeline(answers.wake, answers.sleep)) as TimelineBlock[],
      training: fallbackTraining(true),
      profile: { name: answers.name || 'Your Name', goalLabel: 'Add your goal', birthdate: answers.birthdate || defaultBirthdate() } as any,
      subjects: fb.subjects,
      syllabus: fb.syllabus,
      // "Skip" never asked about domains, so this intentionally leaves
      // `domains` unset -> config.domains stays at its DEFAULT_DOMAINS
      // (null / "unrestricted") value, same as every legacy/pre-Phase-8
      // account. A skip-onboarding account seeing the full, unfiltered tab
      // set is the correct, conservative behavior here, not a gap.
    });
  };

  const toggleDomain = (key: GoalDomain) => {
    setAnswers((a) => ({
      ...a,
      domains: a.domains.includes(key) ? a.domains.filter((d) => d !== key) : [...a.domains, key],
    }));
    setError('');
  };

  const startQuestions = () => {
    if (!selectedDomains.length) {
      setError('Pick at least one — "Something else" is fine if nothing above fits.');
      return;
    }
    setDomainStep(0);
    setStage('domain');
  };

  const goNextDomain = () => {
    if (domainStep < selectedDomains.length - 1) {
      setDomainStep((i) => i + 1);
    } else {
      runGeneration();
    }
  };

  const goBackDomain = () => {
    if (domainStep > 0) {
      setDomainStep((i) => i - 1);
    } else {
      setStage('intro');
    }
  };

  // ---------------- Intro ----------------
  if (stage === 'intro') {
    return (
      <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-zinc-950 px-6 py-10 overflow-y-auto sm:px-10">
        <style>{NO_SELECT_CSS}</style>
        <div className="w-full max-w-md sm:max-w-lg md:max-w-xl">
          <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 via-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/20">
            <Sparkles className="h-5 w-5 text-neutral-950" strokeWidth={2} />
          </div>
          <h1 className="mb-1.5 text-[17px] font-semibold tracking-tight text-neutral-50">Let's set up Akyos for you</h1>
          <p className="mb-6 text-[12.5px] leading-relaxed text-neutral-500">
            Nothing here is a template built for someone else. Pick whatever you're working toward — you can pick more than one — and we'll build your checklist, schedule, and plan around exactly that. Everything stays editable afterward.
          </p>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Name</label>
                <input value={answers.name} onChange={(e) => setAnswers((a) => ({ ...a, name: e.target.value }))} placeholder="Optional" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Birthdate</label>
                <DateField value={answers.birthdate} onChange={(e) => setAnswers((a) => ({ ...a, birthdate: e.target.value }))} className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Wake time</label>
                <TimeField value={answers.wake} onChange={(e) => setAnswers((a) => ({ ...a, wake: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Sleep time</label>
                <TimeField value={answers.sleep} onChange={(e) => setAnswers((a) => ({ ...a, sleep: e.target.value }))} className={inputCls} />
              </div>
            </div>

            <div>
              <label className={labelCls}>Target date (optional)</label>
              <DateField value={answers.targetDate} onChange={(e) => setAnswers((a) => ({ ...a, targetDate: e.target.value }))} className={inputCls} />
              <p className={hintCls}>Powers the countdown widget on your Overview tab. Skip if your goal isn't date-bound.</p>
            </div>

            <div>
              <label className={labelCls}>What are you working toward? Pick all that apply.</label>
              <div className="grid grid-cols-1 gap-2">
                {GOAL_DOMAINS.map((d) => {
                  const Icon = DOMAIN_ICONS[d.key];
                  const active = answers.domains.includes(d.key);
                  return (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => toggleDomain(d.key)}
                      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                        active
                          ? 'border-violet-500/60 bg-violet-500/10'
                          : 'border-neutral-800 bg-neutral-900/50 hover:border-neutral-700'
                      }`}
                    >
                      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${active ? 'text-violet-400' : 'text-neutral-500'}`} strokeWidth={2} />
                      <div>
                        <div className={`text-[12.5px] font-semibold ${active ? 'text-violet-300' : 'text-neutral-300'}`}>{d.label}</div>
                        <div className="text-[11.5px] text-neutral-500">{d.blurb}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {error && <p className="text-[12px] text-rose-400">{error}</p>}

            <button
              onClick={startQuestions}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-sky-400 via-violet-500 to-fuchsia-500 py-3 text-[13px] font-semibold text-neutral-950 transition-opacity hover:opacity-90"
            >
              Continue <ArrowRight className="h-4 w-4" />
            </button>
            <button onClick={skip} className="w-full text-center text-[12px] font-medium text-neutral-600 hover:text-neutral-400">
              Skip — I'll set everything up myself
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------- Domain question screens ----------------
  if (stage === 'domain') {
    const domain = selectedDomains[domainStep];
    const isLast = domainStep === selectedDomains.length - 1;
    const domainMeta = GOAL_DOMAINS.find((d) => d.key === domain)!;
    const Icon = DOMAIN_ICONS[domain];

    let fields: React.ReactNode = null;

    if (domain === 'exam') {
      const a = answers.exam;
      const set = (patch: Partial<typeof a>) => setAnswers((prev) => ({ ...prev, exam: { ...prev.exam, ...patch } }));
      fields = (
        <div className="space-y-4">
          <div>
            <label className={labelCls}>What exam / certification / subject?</label>
            <input value={a.examName} onChange={(e) => set({ examName: e.target.value })} placeholder="e.g. NEET, UPSC Prelims, AWS SAA-C03, Class 10 Boards" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Exam date (optional)</label>
            <DateField value={a.examDate} onChange={(e) => set({ examDate: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Subjects (optional)</label>
            <input value={a.subjectsHint} onChange={(e) => set({ subjectsHint: e.target.value })} placeholder="e.g. Physics, Chemistry, Biology" className={inputCls} />
            <p className={hintCls}>Leave blank and we'll infer them from the exam name.</p>
          </div>
          <div>
            <label className={labelCls}>Where are you right now?</label>
            <ChipSelect options={EXAM_LEVEL_OPTIONS} value={a.currentLevel} onChange={(v) => set({ currentLevel: v })} />
          </div>
        </div>
      );
    } else if (domain === 'fitness') {
      const a = answers.fitness;
      const set = (patch: Partial<typeof a>) => setAnswers((prev) => ({ ...prev, fitness: { ...prev.fitness, ...patch } }));
      fields = (
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Main training goal</label>
            <ChipSelect options={FITNESS_GOAL_OPTIONS} value={a.fitnessGoal} onChange={(v) => set({ fitnessGoal: v })} />
          </div>
          <div>
            <label className={labelCls}>Experience level</label>
            <ChipSelect options={EXPERIENCE_OPTIONS} value={a.experienceLevel} onChange={(v) => set({ experienceLevel: v })} />
          </div>
          <div>
            <label className={labelCls}>Equipment access</label>
            <ChipSelect options={EQUIPMENT_OPTIONS} value={a.equipmentAccess} onChange={(v) => set({ equipmentAccess: v })} />
          </div>
          <div>
            <label className={labelCls}>Training days per week: {a.daysPerWeek}</label>
            <input
              type="range" min={1} max={7} step={1}
              value={a.daysPerWeek}
              onChange={(e) => set({ daysPerWeek: Number(e.target.value) })}
              className="w-full accent-violet-500"
            />
          </div>
          <div>
            <label className={labelCls}>Injuries or limitations (optional)</label>
            <input value={a.injuriesOrLimits} onChange={(e) => set({ injuriesOrLimits: e.target.value })} placeholder="e.g. bad left knee, avoid deep squats" className={inputCls} />
          </div>
        </div>
      );
    } else if (domain === 'diet') {
      const a = answers.diet;
      const set = (patch: Partial<typeof a>) => setAnswers((prev) => ({ ...prev, diet: { ...prev.diet, ...patch } }));
      fields = (
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Diet type</label>
            <ChipSelect options={DIET_TYPE_OPTIONS} value={a.dietType} onChange={(v) => set({ dietType: v })} />
          </div>
          <div>
            <label className={labelCls}>Goal</label>
            <ChipSelect options={DIET_GOAL_OPTIONS} value={a.dietGoal} onChange={(v) => set({ dietGoal: v })} />
          </div>
          <div>
            <label className={labelCls}>Activity level</label>
            <ChipSelect options={ACTIVITY_LEVEL_OPTIONS} value={a.activityLevel} onChange={(v) => set({ activityLevel: v })} />
          </div>
          <div>
            <label className={labelCls}>Target daily calories (optional)</label>
            <input
              value={a.targetCalories ?? ''}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '');
                set({ targetCalories: digits ? Number(digits) : null });
              }}
              placeholder="Leave blank to auto-calculate"
              inputMode="numeric"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Allergies or dislikes (optional)</label>
            <input value={a.allergiesOrDislikes} onChange={(e) => set({ allergiesOrDislikes: e.target.value })} placeholder="e.g. peanuts, dairy" className={inputCls} />
          </div>
        </div>
      );
    } else if (domain === 'productivity') {
      const a = answers.productivity;
      const set = (patch: Partial<typeof a>) => setAnswers((prev) => ({ ...prev, productivity: { ...prev.productivity, ...patch } }));
      fields = (
        <div className="space-y-4">
          <div>
            <label className={labelCls}>What are you focusing on?</label>
            <textarea
              value={a.focusAreas}
              onChange={(e) => set({ focusAreas: e.target.value })}
              placeholder="e.g. deep work on my startup, a reading habit, cutting down screen time"
              rows={3}
              className={`${inputCls} resize-none`}
            />
          </div>
          <div>
            <label className={labelCls}>Routine style</label>
            <ChipSelect options={ROUTINE_STYLE_OPTIONS} value={a.routineStyle} onChange={(v) => set({ routineStyle: v })} />
          </div>
        </div>
      );
    } else {
      const a = answers.custom;
      fields = (
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Describe it in your own words</label>
            <textarea
              value={a.description}
              onChange={(e) => setAnswers((prev) => ({ ...prev, custom: { description: e.target.value } }))}
              placeholder="Tell us what you're working toward — even a rough sentence is enough."
              rows={4}
              className={`${inputCls} resize-none`}
            />
          </div>
        </div>
      );
    }

    return (
      <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-zinc-950 px-6 py-10 overflow-y-auto sm:px-10">
        <style>{NO_SELECT_CSS}</style>
        <div className="w-full max-w-md sm:max-w-lg md:max-w-xl">
          <div className="mb-1.5 flex items-center gap-2">
            {selectedDomains.map((_, i) => (
              <span key={i} className={`h-1 flex-1 rounded-full ${i <= domainStep ? 'bg-violet-500' : 'bg-neutral-800'}`} />
            ))}
          </div>
          <p className="mb-4 text-[11px] text-neutral-600">Step {domainStep + 1} of {selectedDomains.length}</p>

          <div className="mb-6 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 via-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/20 shrink-0">
              <Icon className="h-4 w-4 text-neutral-950" strokeWidth={2} />
            </div>
            <h1 className="text-[16px] font-semibold tracking-tight text-neutral-50">{domainMeta.label}</h1>
          </div>

          {fields}

          <div className="mt-6 flex gap-3">
            <button
              onClick={goBackDomain}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-[13px] font-semibold text-neutral-400 hover:text-neutral-200 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <button
              onClick={goNextDomain}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-sky-400 via-violet-500 to-fuchsia-500 py-3 text-[13px] font-semibold text-neutral-950 transition-opacity hover:opacity-90"
            >
              {isLast ? 'Generate my setup' : 'Next'} <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------- Generating ----------------
  if (stage === 'generating') {
    return (
      <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-zinc-950 px-6 gap-4">
        <style>{NO_SELECT_CSS}</style>
        <Loader2 className="h-7 w-7 text-violet-400 animate-spin" strokeWidth={2} />
        <p className="text-[13px] text-neutral-400">{loadingMessages[loadingMsgIdx]}</p>
      </div>
    );
  }

  // ---------------- Review ----------------
  const sectionCard = (
    icon: any,
    title: string,
    subtitle: string,
    key: 'checklist' | 'timeline' | 'training' | 'targets' | 'syllabus' | 'diet',
    children: React.ReactNode
  ) => {
    const Icon = icon;
    const isFallback = usedFallback[key];
    return (
      <div className={`rounded-2xl border p-4 sm:p-5 ${isFallback ? 'border-amber-700/40 bg-amber-950/10' : 'border-neutral-800 bg-neutral-950/60'}`}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <Icon className="h-4 w-4 text-violet-400" strokeWidth={2} />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[13px] font-bold text-neutral-100">{title}</h3>
                {isFallback && (
                  <span
                    className="rounded-full border border-amber-700/50 bg-amber-900/30 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-amber-400"
                    title="AI generation didn't come through for this section, so this is generic placeholder content, not something built for your goal. Edit it directly or hit Regenerate to try again."
                  >
                    Generic — not generated
                  </span>
                )}
              </div>
              <p className="text-[11.5px] text-neutral-500">{subtitle}</p>
            </div>
          </div>
          <button
            onClick={() => regenerate(key)}
            disabled={regenerating === key}
            aria-label={`Regenerate ${title}`}
            className="shrink-0 flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-[11px] font-semibold text-neutral-400 hover:text-neutral-200 transition-colors disabled:opacity-50"
          >
            <RefreshCcw className={`h-3 w-3 ${regenerating === key ? 'animate-spin' : ''}`} /> Regenerate
          </button>
        </div>
        {isFallback && (
          <p className="mb-2.5 text-[11.5px] leading-relaxed text-amber-500/80">
            This section couldn't be generated from your goal, so it's showing generic placeholder content instead. Edit it in Settings after finishing, or try Regenerate now.
          </p>
        )}
        {children}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[999] flex flex-col items-center bg-zinc-950 px-6 py-10 overflow-y-auto sm:px-10">
      <style>{NO_SELECT_CSS}</style>
      <div className="w-full max-w-lg sm:max-w-xl md:max-w-2xl">
        <h1 className="mb-1.5 text-[17px] font-semibold tracking-tight text-neutral-50">Here's what we built</h1>
        <p className="mb-4 text-[12.5px] leading-relaxed text-neutral-500">
          Not quite right? Regenerate any section, or just continue — everything below stays fully editable in Settings afterward.
        </p>

        {Object.values(usedFallback).some(Boolean) && (
          <div className="mb-4 rounded-xl border border-amber-700/40 bg-amber-950/10 px-4 py-2.5 text-[12px] leading-relaxed text-amber-400/90">
            One or more sections below (marked "Generic — not generated") couldn't be built from your goal and are showing generic placeholder content instead of a real plan. Regenerate them, or edit directly in Settings once you're in.
          </div>
        )}

        <div className="space-y-3">
          {sectionCard(ClipboardList, 'Daily Checklist', `${checklist.length} objectives`, 'checklist', (
            <ul className="space-y-1.5">
              {checklist.slice(0, 6).map((it) => (
                <li key={it.id} className="text-[12.5px] text-neutral-300 flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-violet-400/60 shrink-0" /> {it.label}
                </li>
              ))}
            </ul>
          ))}

          {sectionCard(Clock3, 'Daily Timeline', `${timeline.length} blocks, ${answers.wake}–${answers.sleep}`, 'timeline', (
            <ul className="space-y-1.5">
              {timeline.slice(0, 6).map((b, i) => (
                <li key={i} className="text-[12.5px] text-neutral-300 flex items-center gap-2">
                  <span className="text-neutral-600 tabular-nums text-[11px] w-[92px] shrink-0">{b.start}–{b.end}</span> {b.label}
                </li>
              ))}
            </ul>
          ))}

          {sectionCard(Dumbbell, 'Training Split', wantsTraining ? `${training.length} days planned` : 'Not included', 'training', (
            <ul className="space-y-1.5">
              {training.slice(0, 7).map((d, i) => (
                <li key={i} className="text-[12.5px] text-neutral-300 flex items-center gap-2">
                  <span className="text-neutral-600 text-[11px] w-[70px] shrink-0">{d.day.slice(0, 3)}</span> {d.focus}
                </li>
              ))}
            </ul>
          ))}

          {sectionCard(Target, 'Goal Targets', `${targets.targets.length} target${targets.targets.length === 1 ? '' : 's'}`, 'targets', (
            <ul className="space-y-1.5">
              {targets.targets.map((t, i) => (
                <li key={i} className="text-[12.5px] text-neutral-300">
                  <span className="font-semibold text-neutral-200">{t.name}</span>{t.course ? ` — ${t.course}` : ''}
                </li>
              ))}
            </ul>
          ))}

          {sectionCard(BookOpen, 'Syllabus Roadmap', wantsSyllabus ? `${subjects.length} subject${subjects.length === 1 ? '' : 's'}, ${syllabus.length} phase${syllabus.length === 1 ? '' : 's'}` : 'Not included', 'syllabus', (
            <ul className="space-y-1.5">
              {subjects.map((s) => (
                <li key={s.key} className="text-[12.5px] text-neutral-300 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-violet-400/60 shrink-0" /> {s.label}
                </li>
              ))}
            </ul>
          ))}

          {wantsDiet && dietTargets && sectionCard(Utensils, 'Diet Plan', `${diet.length} meal${diet.length === 1 ? '' : 's'}, ~${dietTargets.calories}kcal/day`, 'diet', (
            <>
              <div className="mb-2 flex flex-wrap gap-1.5">
                <span className="rounded-full border border-neutral-800 bg-neutral-900/60 px-2 py-1 text-[11px] text-neutral-400">~{dietTargets.calories} kcal</span>
                <span className="rounded-full border border-neutral-800 bg-neutral-900/60 px-2 py-1 text-[11px] text-neutral-400">~{dietTargets.proteinG}g protein</span>
                <span className="rounded-full border border-neutral-800 bg-neutral-900/60 px-2 py-1 text-[11px] text-neutral-400">~{dietTargets.hydrationL.toFixed(1)}L water</span>
              </div>
              <ul className="space-y-1.5">
                {diet.slice(0, 6).map((m, i) => (
                  <li key={i} className="text-[12.5px] text-neutral-300 flex items-center gap-2">
                    <span className="text-neutral-600 tabular-nums text-[11px] w-[80px] shrink-0">{m.time}</span> {m.name}
                  </li>
                ))}
              </ul>
            </>
          ))}
        </div>

        <button
          onClick={finish}
          className="mt-6 w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-sky-400 via-violet-500 to-fuchsia-500 py-3 text-[13px] font-semibold text-neutral-950 transition-opacity hover:opacity-90"
        >
          Looks good — Enter Akyos <ArrowRight className="h-4 w-4" />
        </button>
        <button onClick={() => { setStage('intro'); setDomainStep(0); }} className="mt-3 w-full text-center text-[12px] font-medium text-neutral-600 hover:text-neutral-400">
          Start over
        </button>
      </div>
    </div>
  );
}