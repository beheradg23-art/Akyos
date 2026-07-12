// Unit tests for the pure, synchronous parts of contentGen.ts's onboarding
// generation:
// - Phase 5: diet/calorie/macro generation (calculateDietTargets,
//   buildFallbackDietPlan).
// - Phase 6: weekly training plan generation (buildWeekSkeleton,
//   buildFallbackWeeklyTrainingPlan).
// - Phase 7: syllabus/study-plan roadmap generation (resolveMonthsRemaining,
//   buildRoadmapSkeleton, deriveExamSubjects, buildFallbackSyllabus).
//
// generateDietPlan()/generateTrainingPlan()/generateExamSyllabus()
// themselves call the Supabase edge function (via generate()) and aren't
// covered here — same reasoning appConfig.test.ts / cloudSync.test.ts /
// questionnaire.test.ts already use: no network in this sandbox, so only
// the pure logic is unit-tested directly. The generate() call path is
// exercised manually (see PHASE_5/6/7_HANDOFF.md "Still could not be run in
// this sandbox").
//
// Run with: npx vitest run src/lib/contentGen.test.ts
import { describe, it, expect } from 'vitest';
import {
  calculateDietTargets, buildFallbackDietPlan,
  buildWeekSkeleton, buildFallbackWeeklyTrainingPlan,
  resolveMonthsRemaining, buildRoadmapSkeleton, deriveExamSubjects, buildFallbackSyllabus,
} from './contentGen';
import {
  DEFAULT_DIET_ANSWERS, type DietDomainAnswers,
  DEFAULT_FITNESS_ANSWERS, type FitnessDomainAnswers,
  DEFAULT_EXAM_ANSWERS, type ExamDomainAnswers,
} from './questionnaire';

function diet(overrides: Partial<DietDomainAnswers>): DietDomainAnswers {
  return { ...DEFAULT_DIET_ANSWERS, ...overrides };
}

function fitness(overrides: Partial<FitnessDomainAnswers>): FitnessDomainAnswers {
  return { ...DEFAULT_FITNESS_ANSWERS, ...overrides };
}

function exam(overrides: Partial<ExamDomainAnswers>): ExamDomainAnswers {
  return { ...DEFAULT_EXAM_ANSWERS, ...overrides };
}

// Fixed reference "now" so date-math tests (resolveMonthsRemaining) are
// deterministic regardless of when the test suite actually runs.
const FIXED_NOW = new Date('2026-07-12T00:00:00');

describe('calculateDietTargets', () => {
  it('respects an explicit targetCalories verbatim (the "2700kcal vegetarian" example)', () => {
    const t = calculateDietTargets(diet({ dietType: 'vegetarian', dietGoal: 'bulk', targetCalories: 2700 }), 70);
    expect(t.calories).toBe(2700);
    expect(t.isExplicitCalories).toBe(true);
  });

  it('auto-calculates calories when targetCalories is null', () => {
    const t = calculateDietTargets(diet({ targetCalories: null, activityLevel: 'moderate', dietGoal: 'maintain' }), 70);
    expect(t.isExplicitCalories).toBe(false);
    expect(t.calories).toBeGreaterThan(1200);
    // rounded to the nearest 25, matching computeDietAutoValues's rounding convention
    expect(t.calories % 25).toBe(0);
  });

  it('bulk auto-calculates higher than cut for the same person', () => {
    const bulk = calculateDietTargets(diet({ targetCalories: null, dietGoal: 'bulk' }), 70);
    const cut = calculateDietTargets(diet({ targetCalories: null, dietGoal: 'cut' }), 70);
    expect(bulk.calories).toBeGreaterThan(cut.calories);
  });

  it('never returns fewer than 1200 auto-calculated calories even for a very light/low profile', () => {
    const t = calculateDietTargets(diet({ targetCalories: null, activityLevel: 'sedentary', dietGoal: 'cut' }), 40);
    expect(t.calories).toBeGreaterThanOrEqual(1200);
  });

  it('falls back to a reference bodyweight when no profile weight is given', () => {
    const withWeight = calculateDietTargets(diet({ targetCalories: null }), 65);
    const withoutWeight = calculateDietTargets(diet({ targetCalories: null }));
    expect(withoutWeight.calories).toBe(withWeight.calories);
  });

  it('sizes protein higher for cut than for maintain at the same bodyweight', () => {
    const cut = calculateDietTargets(diet({ dietGoal: 'cut' }), 70);
    const maintain = calculateDietTargets(diet({ dietGoal: 'maintain' }), 70);
    expect(cut.proteinG).toBeGreaterThan(maintain.proteinG);
  });

  it('computes hydration from bodyweight, rounded to the nearest 0.5L', () => {
    const t = calculateDietTargets(diet({}), 80);
    expect(t.hydrationL).toBeCloseTo(Math.round(80 * 0.035 * 2) / 2, 5);
  });
});

describe('buildFallbackDietPlan', () => {
  it('produces exactly 6 meals for every diet type', () => {
    const types: DietDomainAnswers['dietType'][] = ['vegetarian', 'non-vegetarian', 'vegan', 'eggetarian', 'pescatarian', 'no-preference'];
    for (const dietType of types) {
      const a = diet({ dietType });
      const targets = calculateDietTargets(a, 70);
      const meals = buildFallbackDietPlan(a, targets);
      expect(meals).toHaveLength(6);
      for (const m of meals) {
        expect(m.time).toBeTruthy();
        expect(m.name).toBeTruthy();
        expect(m.items.length).toBeGreaterThan(0);
        expect(m.iconName).toBeTruthy();
      }
    }
  });

  it('never includes meat/fish/eggs/dairy in a vegan plan', () => {
    const a = diet({ dietType: 'vegan' });
    const targets = calculateDietTargets(a, 70);
    const meals = buildFallbackDietPlan(a, targets);
    const allItems = meals.flatMap((m) => m.items).join(' ').toLowerCase();
    for (const banned of ['chicken', 'egg', 'fish', 'paneer', 'curd', 'milk']) {
      expect(allItems).not.toContain(banned);
    }
  });

  it('never includes meat/fish/eggs in a vegetarian plan', () => {
    const a = diet({ dietType: 'vegetarian' });
    const targets = calculateDietTargets(a, 70);
    const meals = buildFallbackDietPlan(a, targets);
    const allItems = meals.flatMap((m) => m.items).join(' ').toLowerCase();
    for (const banned of ['chicken', 'egg', 'fish']) {
      expect(allItems).not.toContain(banned);
    }
  });

  it('scales portions up for a higher target calorie count', () => {
    const a = diet({ dietType: 'non-vegetarian' });
    const lowTargets = calculateDietTargets(a, 50); // small reference weight -> lower auto calories
    const highTargets = { ...lowTargets, calories: 4000, isExplicitCalories: true };
    const lowMeals = buildFallbackDietPlan(a, lowTargets);
    const highMeals = buildFallbackDietPlan(a, highTargets);

    // Robust check that doesn't depend on exact rounding: sum of every
    // item's leading quantity number should rise with a higher target.
    const sumLeadingNumbers = (meals: typeof lowMeals) =>
      meals.flatMap((m) => m.items).reduce((sum, it) => {
        const match = /^(\d+(?:\.\d+)?)/.exec(it.trim());
        return sum + (match ? parseFloat(match[1]) : 0);
      }, 0);
    expect(sumLeadingNumbers(highMeals)).toBeGreaterThan(sumLeadingNumbers(lowMeals));
  });

  it('drops items matching a stated allergy/dislike', () => {
    const a = diet({ dietType: 'non-vegetarian', allergiesOrDislikes: 'almonds, curd' });
    const targets = calculateDietTargets(a, 70);
    const meals = buildFallbackDietPlan(a, targets);
    const allItems = meals.flatMap((m) => m.items).join(' ').toLowerCase();
    expect(allItems).not.toContain('almond');
    expect(allItems).not.toContain('curd');
  });

  it('never leaves a meal with zero items even if every item is filtered out', () => {
    const a = diet({ dietType: 'vegan', allergiesOrDislikes: 'oats, banana, peanut, tofu, roti, dal, salad, apple, almond, chana, water' });
    const targets = calculateDietTargets(a, 70);
    const meals = buildFallbackDietPlan(a, targets);
    for (const m of meals) {
      expect(m.items.length).toBeGreaterThan(0);
    }
  });

  // Phase 10 Part 2 regression test: scaleQuantityInText used to swallow the
  // whitespace between a leading number and a space-separated unit word
  // (e.g. "2 tbsp sattu drink" -> "2tbsp sattu drink", "1 banana" ->
  // "1banana"), corrupting every space-separated whole-count/volume item in
  // every diet fallback plan at every scale, including ~1x. Gram/ml items
  // ("200g grilled chicken") were never affected since they have no space to
  // lose in the source data. None of the tests above caught this since they
  // only check substrings/leading numbers, never full-item formatting.
  it('preserves the space between a scaled number and its unit word', () => {
    const a = diet({ dietType: 'non-vegetarian' });
    const targets = calculateDietTargets(a, 70);
    const meals = buildFallbackDietPlan(a, targets);
    const allItems = meals.flatMap((m) => m.items);
    // Space-separated whole-count/volume items should never have the number
    // mashed directly against the following word. Checked against the
    // specific space-separated unit words the templates actually use
    // (rather than a generic "digit+2 letters" pattern, which would
    // false-positive on legitimate no-space units like "245ml").
    for (const it of allItems) {
      expect(it).not.toMatch(/^\d+(\.\d+)?(tbsp|tsp|whole|banana|roti|rotis|bowl|apple|almonds?|cup|slice)/i);
    }
    // Concrete known case: the non-veg template's "1 banana" item should
    // survive with its space intact (banana isn't touched by allergy
    // filtering here, so it's always present to check).
    const banana = allItems.find((it) => it.toLowerCase().includes('banana'));
    expect(banana).toBeDefined();
    expect(banana).toMatch(/^\d+(\.\d+)? banana$/);
    // Gram/ml items are unaffected by the fix -- still no space (matches
    // the original source data's "200g grilled chicken" shape).
    const chicken = allItems.find((it) => it.toLowerCase().includes('chicken breast') && it.toLowerCase().includes('grilled'));
    expect(chicken).toBeDefined();
    expect(chicken).toMatch(/^\d+g /);
  });
});

describe('buildWeekSkeleton', () => {
  it('always returns exactly 7 days, one per weekday, regardless of daysPerWeek', () => {
    for (let n = 1; n <= 7; n++) {
      const skeleton = buildWeekSkeleton(n);
      expect(skeleton).toHaveLength(7);
      expect(skeleton.map((d) => d.day)).toEqual([
        'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
      ]);
    }
  });

  it('marks exactly daysPerWeek days with a non-null focus, the rest null (rest)', () => {
    for (let n = 1; n <= 7; n++) {
      const skeleton = buildWeekSkeleton(n);
      const trainingDays = skeleton.filter((d) => d.focus !== null);
      expect(trainingDays).toHaveLength(n);
    }
  });

  it('clamps out-of-range daysPerWeek into 1-7 instead of erroring', () => {
    expect(buildWeekSkeleton(0).filter((d) => d.focus !== null)).toHaveLength(1);
    expect(buildWeekSkeleton(-3).filter((d) => d.focus !== null)).toHaveLength(1);
    expect(buildWeekSkeleton(10).filter((d) => d.focus !== null)).toHaveLength(7);
    expect(buildWeekSkeleton(3.6).filter((d) => d.focus !== null)).toHaveLength(4); // rounds first
  });

  it('spreads training days across the week rather than bunching them at the start', () => {
    const skeleton = buildWeekSkeleton(3);
    const trainingIndices = skeleton.map((d, i) => (d.focus !== null ? i : -1)).filter((i) => i >= 0);
    // Not Monday/Tuesday/Wednesday back-to-back — real spacing between sessions.
    expect(trainingIndices).not.toEqual([0, 1, 2]);
  });

  it('7 days per week trains every day of the week', () => {
    const skeleton = buildWeekSkeleton(7);
    expect(skeleton.every((d) => d.focus !== null)).toBe(true);
  });
});

describe('buildFallbackWeeklyTrainingPlan', () => {
  it('produces exactly 7 WeeklyTrainingDay entries with the right number of training vs rest days', () => {
    for (let n = 1; n <= 7; n++) {
      const plan = buildFallbackWeeklyTrainingPlan(fitness({ daysPerWeek: n }));
      expect(plan).toHaveLength(7);
      const restDays = plan.filter((d) => d.mode === 'rest');
      const trainingDays = plan.filter((d) => d.mode !== 'rest');
      expect(restDays).toHaveLength(7 - n);
      expect(trainingDays).toHaveLength(n);
      for (const d of trainingDays) {
        expect(d.exercises.length).toBeGreaterThan(0);
      }
      for (const d of restDays) {
        expect(d.focus).toBe('Rest');
        expect(d.exercises.length).toBeGreaterThan(0); // real recovery content, not an empty day
      }
    }
  });

  it('uses gym mode + gym-only exercise names for full-gym access', () => {
    const plan = buildFallbackWeeklyTrainingPlan(fitness({ daysPerWeek: 4, equipmentAccess: 'full-gym' }));
    const trainingDays = plan.filter((d) => d.mode !== 'rest');
    expect(trainingDays.every((d) => d.mode === 'gym')).toBe(true);
  });

  it('uses calisthenics mode and never prescribes barbell/machine work for bodyweight-only access', () => {
    const plan = buildFallbackWeeklyTrainingPlan(fitness({ daysPerWeek: 4, equipmentAccess: 'bodyweight-only' }));
    const trainingDays = plan.filter((d) => d.mode !== 'rest');
    expect(trainingDays.every((d) => d.mode === 'calisthenics')).toBe(true);
    const allNames = trainingDays.flatMap((d) => d.exercises.map((e) => e.name)).join(' ').toLowerCase();
    for (const banned of ['barbell', 'machine', 'cable', 'db ']) {
      expect(allNames).not.toContain(banned);
    }
  });

  it('gives an advanced trainee more exercises per day than a beginner, same goal/equipment', () => {
    const beginner = buildFallbackWeeklyTrainingPlan(fitness({ daysPerWeek: 3, experienceLevel: 'beginner' }));
    const advanced = buildFallbackWeeklyTrainingPlan(fitness({ daysPerWeek: 3, experienceLevel: 'advanced' }));
    const avgCount = (plan: typeof beginner) => {
      const days = plan.filter((d) => d.mode !== 'rest');
      return days.reduce((s, d) => s + d.exercises.length, 0) / days.length;
    };
    expect(avgCount(advanced)).toBeGreaterThan(avgCount(beginner));
  });

  it('uses a lower rep range label for strength than for endurance, same experience level', () => {
    const strength = buildFallbackWeeklyTrainingPlan(fitness({ daysPerWeek: 3, fitnessGoal: 'strength', experienceLevel: 'intermediate' }));
    const endurance = buildFallbackWeeklyTrainingPlan(fitness({ daysPerWeek: 3, fitnessGoal: 'endurance', experienceLevel: 'intermediate' }));
    const firstSets = (plan: typeof strength) => plan.find((d) => d.mode !== 'rest')!.exercises[0].sets;
    expect(firstSets(strength)).toContain('4-6');
    expect(firstSets(endurance)).toContain('15-20');
  });

  it('excludes exercises tagged with a stated injury/limitation keyword', () => {
    const plan = buildFallbackWeeklyTrainingPlan(fitness({ daysPerWeek: 5, equipmentAccess: 'full-gym', injuriesOrLimits: 'bad knee, avoid deep squats' }));
    const allNames = plan.flatMap((d) => d.exercises.map((e) => e.name)).join(' ').toLowerCase();
    // Every knee-tagged gym exercise in the pool contains "squat" or "lunge" or "leg press"/"leg extension"/"calf raise"
    expect(allNames).not.toContain('squat');
    expect(allNames).not.toContain('lunge');
  });

  it('rotates exercises across repeated occurrences of the same focus (e.g. 6-day PPL x2)', () => {
    const plan = buildFallbackWeeklyTrainingPlan(fitness({ daysPerWeek: 6, equipmentAccess: 'full-gym' }));
    const pushDays = plan.filter((d) => d.focus.startsWith('Push'));
    expect(pushDays).toHaveLength(2);
    const namesA = pushDays[0].exercises.map((e) => e.name).join(',');
    const namesB = pushDays[1].exercises.map((e) => e.name).join(',');
    expect(namesA).not.toBe(namesB);
  });

  it('is deterministic — same input always produces the same plan', () => {
    const a = fitness({ daysPerWeek: 5, fitnessGoal: 'hypertrophy', experienceLevel: 'intermediate', equipmentAccess: 'home-basic' });
    const plan1 = buildFallbackWeeklyTrainingPlan(a);
    const plan2 = buildFallbackWeeklyTrainingPlan(a);
    expect(JSON.stringify(plan1)).toBe(JSON.stringify(plan2));
  });
});

describe('resolveMonthsRemaining', () => {
  it('uses a currentLevel-scaled default when no examDate is given', () => {
    expect(resolveMonthsRemaining(exam({ examDate: '', currentLevel: 'just-starting' }), FIXED_NOW)).toBe(6);
    expect(resolveMonthsRemaining(exam({ examDate: '', currentLevel: 'mid-prep' }), FIXED_NOW)).toBe(4);
    expect(resolveMonthsRemaining(exam({ examDate: '', currentLevel: 'final-stretch' }), FIXED_NOW)).toBe(2);
    expect(resolveMonthsRemaining(exam({ examDate: '', currentLevel: 'revision-only' }), FIXED_NOW)).toBe(1);
  });

  it('computes real months remaining from a valid future examDate', () => {
    // FIXED_NOW is 2026-07-12; 2027-01-12 is exactly 6 calendar months out
    expect(resolveMonthsRemaining(exam({ examDate: '2027-01-12', currentLevel: 'just-starting' }), FIXED_NOW)).toBe(6);
  });

  it('falls back to the currentLevel default for a past examDate', () => {
    expect(resolveMonthsRemaining(exam({ examDate: '2020-01-01', currentLevel: 'mid-prep' }), FIXED_NOW)).toBe(4);
  });

  it('falls back to the currentLevel default for an unparseable examDate', () => {
    expect(resolveMonthsRemaining(exam({ examDate: 'not-a-date', currentLevel: 'final-stretch' }), FIXED_NOW)).toBe(2);
  });

  it('clamps a far-future examDate to 12 months', () => {
    expect(resolveMonthsRemaining(exam({ examDate: '2030-01-01', currentLevel: 'just-starting' }), FIXED_NOW)).toBe(12);
  });

  it('never returns fewer than 1', () => {
    expect(resolveMonthsRemaining(exam({ examDate: '2026-07-13', currentLevel: 'revision-only' }), FIXED_NOW)).toBeGreaterThanOrEqual(1);
  });
});

describe('buildRoadmapSkeleton', () => {
  it('always returns exactly monthsRemaining phases (clamped 1-12)', () => {
    for (const level of ['just-starting', 'mid-prep', 'final-stretch', 'revision-only'] as const) {
      for (const n of [1, 2, 3, 6, 12]) {
        expect(buildRoadmapSkeleton(level, n)).toHaveLength(n);
      }
      expect(buildRoadmapSkeleton(level, 0)).toHaveLength(1); // clamped up
      expect(buildRoadmapSkeleton(level, 20)).toHaveLength(12); // clamped down
    }
  });

  it('always ends on the Final Mock & Weak-Area Drilling stage', () => {
    for (const level of ['just-starting', 'mid-prep', 'final-stretch', 'revision-only'] as const) {
      for (const n of [1, 2, 5, 12]) {
        const sk = buildRoadmapSkeleton(level, n);
        expect(sk[sk.length - 1].stageLabel).toBe('Final Mock & Weak-Area Drilling');
      }
    }
  });

  it('produces a visibly different roadmap for revision-only vs just-starting at the same monthsRemaining', () => {
    const justStarting = buildRoadmapSkeleton('just-starting', 2).map((s) => s.stageLabel);
    const revisionOnly = buildRoadmapSkeleton('revision-only', 2).map((s) => s.stageLabel);
    expect(justStarting).not.toEqual(revisionOnly);
    expect(justStarting[0]).toBe('Foundations');
    expect(revisionOnly[0]).toBe('Full Revision');
  });

  it('a 1-month roadmap is just the final stage, for every currentLevel', () => {
    for (const level of ['just-starting', 'mid-prep', 'final-stretch', 'revision-only'] as const) {
      const sk = buildRoadmapSkeleton(level, 1);
      expect(sk).toEqual([{ phase: 1, month: 'Month 1', stageLabel: 'Final Mock & Weak-Area Drilling' }]);
    }
  });

  it('gives a longer runway (just-starting, 6 months) a Foundations stage and later stages too', () => {
    const sk = buildRoadmapSkeleton('just-starting', 6).map((s) => s.stageLabel);
    expect(sk).toContain('Foundations');
    expect(sk).toContain('Core Buildout');
    expect(sk).toContain('Advanced / Applied');
    expect(sk).toContain('Full Revision');
    expect(sk[sk.length - 1]).toBe('Final Mock & Weak-Area Drilling');
  });

  it('numbers phases sequentially starting at 1, with relative month labels', () => {
    const sk = buildRoadmapSkeleton('mid-prep', 4);
    expect(sk.map((s) => s.phase)).toEqual([1, 2, 3, 4]);
    expect(sk.map((s) => s.month)).toEqual(['Month 1', 'Month 2', 'Month 3', 'Month 4']);
  });

  it('is deterministic — same input always produces the same skeleton', () => {
    const a = buildRoadmapSkeleton('just-starting', 5);
    const b = buildRoadmapSkeleton('just-starting', 5);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('deriveExamSubjects', () => {
  it('respects an explicit subjectsHint verbatim, split on commas', () => {
    const subjects = deriveExamSubjects(exam({ examName: 'Something Custom', subjectsHint: 'Module 1, Module 2, Module 3' }));
    expect(subjects.map((s) => s.label)).toEqual(['Module 1', 'Module 2', 'Module 3']);
    expect(subjects.map((s) => s.key)).toEqual(['module_1', 'module_2', 'module_3']);
  });

  it('uses a known exam preset when no hint is given (NEET example from the original request)', () => {
    const subjects = deriveExamSubjects(exam({ examName: 'NEET', subjectsHint: '' }));
    expect(subjects.map((s) => s.label)).toEqual(['Physics', 'Chemistry', 'Biology']);
  });

  it('matches presets case-insensitively and via substring (e.g. a specific AWS cert code)', () => {
    const subjects = deriveExamSubjects(exam({ examName: 'aws saa-c03', subjectsHint: '' }));
    expect(subjects.length).toBeGreaterThan(1);
    expect(subjects.map((s) => s.label)).toContain('Cloud Concepts');
  });

  it('falls back to a single generic subject named after the exam when nothing matches and no hint given', () => {
    const subjects = deriveExamSubjects(exam({ examName: 'Class 10 Boards', subjectsHint: '' }));
    expect(subjects).toHaveLength(1);
    expect(subjects[0].label).toBe('Class 10 Boards Core Topics');
  });

  it('never returns an empty list, even with a blank examName and blank hint', () => {
    const subjects = deriveExamSubjects(exam({ examName: '', subjectsHint: '' }));
    expect(subjects.length).toBeGreaterThan(0);
  });

  it('assigns a valid palette color to every subject and de-duplicates keys', () => {
    const subjects = deriveExamSubjects(exam({ examName: 'X', subjectsHint: 'Same, Same, Same' }));
    const keys = subjects.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length); // all unique
    for (const s of subjects) expect(s.color).toBeTruthy();
  });
});

describe('buildFallbackSyllabus', () => {
  it('produces the NEET-bulking-style example: real subjects, a roadmap sized to currentLevel/timeline', () => {
    const result = buildFallbackSyllabus(
      exam({ examName: 'NEET', examDate: '2027-01-12', subjectsHint: '', currentLevel: 'just-starting' }),
      FIXED_NOW,
    );
    expect(result.subjects.map((s) => s.label)).toEqual(['Physics', 'Chemistry', 'Biology']);
    expect(result.phases).toHaveLength(6); // 6 months out, computed above
    expect(result.phases[result.phases.length - 1].label).toBe('Final Mock & Weak-Area Drilling');
  });

  it('gives every subject real, non-empty topic content in every phase', () => {
    const result = buildFallbackSyllabus(exam({ examName: 'JEE', currentLevel: 'mid-prep' }), FIXED_NOW);
    for (const phase of result.phases) {
      for (const subject of result.subjects) {
        expect(phase.subjects[subject.key]?.length).toBeGreaterThan(0);
      }
    }
  });

  it('produces a non-JEE-shaped roadmap for an arbitrary certification with no hint', () => {
    const result = buildFallbackSyllabus(exam({ examName: 'AWS SAA-C03', subjectsHint: '', currentLevel: 'revision-only', examDate: '2026-09-12' }), FIXED_NOW);
    expect(result.subjects.map((s) => s.label)).not.toContain('Mathematics');
    expect(result.subjects.map((s) => s.label)).not.toContain('Physics');
    expect(result.phases.map((p) => p.label)).toEqual(['Full Revision', 'Final Mock & Weak-Area Drilling']);
  });

  it('is deterministic — same input always produces the same roadmap', () => {
    const a = exam({ examName: 'UPSC Prelims 2027', currentLevel: 'mid-prep', examDate: '2027-02-01' });
    const r1 = buildFallbackSyllabus(a, FIXED_NOW);
    const r2 = buildFallbackSyllabus(a, FIXED_NOW);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });
});
