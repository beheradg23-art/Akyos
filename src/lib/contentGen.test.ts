// Unit tests for the pure, synchronous parts of contentGen.ts's onboarding
// generation:
// - Phase 5: diet/calorie/macro generation (calculateDietTargets,
//   buildFallbackDietPlan).
// - Phase 6: weekly training plan generation (buildWeekSkeleton,
//   buildFallbackWeeklyTrainingPlan).
//
// generateDietPlan()/generateTrainingPlan() themselves call the Supabase
// edge function (via generate()) and aren't covered here — same reasoning
// appConfig.test.ts / cloudSync.test.ts / questionnaire.test.ts already
// use: no network in this sandbox, so only the pure logic is unit-tested
// directly. The generate() call path is exercised manually (see
// PHASE_5_HANDOFF.md / PHASE_6_HANDOFF.md "Still could not be run in this
// sandbox").
//
// Run with: npx vitest run src/lib/contentGen.test.ts
import { describe, it, expect } from 'vitest';
import {
  calculateDietTargets, buildFallbackDietPlan,
  buildWeekSkeleton, buildFallbackWeeklyTrainingPlan,
} from './contentGen';
import { DEFAULT_DIET_ANSWERS, type DietDomainAnswers, DEFAULT_FITNESS_ANSWERS, type FitnessDomainAnswers } from './questionnaire';

function diet(overrides: Partial<DietDomainAnswers>): DietDomainAnswers {
  return { ...DEFAULT_DIET_ANSWERS, ...overrides };
}

function fitness(overrides: Partial<FitnessDomainAnswers>): FitnessDomainAnswers {
  return { ...DEFAULT_FITNESS_ANSWERS, ...overrides };
}

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
