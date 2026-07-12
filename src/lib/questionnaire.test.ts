// Unit tests for the pure functions in questionnaire.ts.
//
// These are plain data transforms (string composition, set math) with no
// network/AI/localStorage involved, so they're tested directly the same
// way appConfig.test.ts covers appConfig.ts's pure helpers.
//
// Run with: npx vitest run src/lib/questionnaire.test.ts
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_QUESTIONNAIRE_ANSWERS,
  GOAL_DOMAIN_KEYS,
  hasDomain,
  buildGoalDescription,
  buildGoalContext,
  resolveTabKeysForDomains,
  deriveProfileFields,
  CORE_TAB_KEYS,
  type QuestionnaireAnswers,
} from './questionnaire';
import { TAB_LABEL_KEYS, type TabLabelKey } from './appConfig';

function withDomains(...domains: QuestionnaireAnswers['domains']): QuestionnaireAnswers {
  return { ...DEFAULT_QUESTIONNAIRE_ANSWERS, domains };
}

describe('GOAL_DOMAIN_KEYS', () => {
  it('covers exactly the five domains the plan requires', () => {
    expect(GOAL_DOMAIN_KEYS.sort()).toEqual(['custom', 'diet', 'exam', 'fitness', 'productivity'].sort());
  });
});

describe('hasDomain', () => {
  it('is true only for domains actually in the list', () => {
    const a = withDomains('exam', 'fitness');
    expect(hasDomain(a, 'exam')).toBe(true);
    expect(hasDomain(a, 'fitness')).toBe(true);
    expect(hasDomain(a, 'diet')).toBe(false);
  });
});

describe('buildGoalDescription', () => {
  it('falls back to a generic phrase when nothing is filled in', () => {
    const a = withDomains();
    expect(buildGoalDescription(a)).toBe('General self-improvement and daily routine building');
  });

  it('describes a single exam-only goal', () => {
    const a: QuestionnaireAnswers = {
      ...withDomains('exam'),
      exam: { examName: 'NEET', examDate: '2027-05-03', subjectsHint: '', currentLevel: 'just-starting' },
    };
    const desc = buildGoalDescription(a);
    expect(desc).toContain('NEET');
    expect(desc).toContain('just starting preparation');
    expect(desc).toContain('2027-05-03');
  });

  it('reproduces the NEET-aspirant-who-also-wants-to-bulk example as one composed description', () => {
    const a: QuestionnaireAnswers = {
      ...withDomains('exam', 'fitness', 'diet'),
      exam: { examName: 'NEET', examDate: '', subjectsHint: 'Physics, Chemistry, Biology', currentLevel: 'mid-prep' },
      fitness: { fitnessGoal: 'hypertrophy', experienceLevel: 'beginner', daysPerWeek: 4, equipmentAccess: 'full-gym', injuriesOrLimits: '' },
      diet: { dietType: 'vegetarian', dietGoal: 'bulk', targetCalories: 2700, activityLevel: 'moderate', allergiesOrDislikes: '' },
    };
    const desc = buildGoalDescription(a);
    // All three domains show up in one string, so a single generate*() call
    // (which only accepts one goalDescription today) still sees the whole
    // combined goal rather than just one of the three.
    expect(desc).toContain('NEET');
    expect(desc).toContain('building muscle (hypertrophy)');
    expect(desc).toContain('vegetarian');
    expect(desc).toContain('bulking (calorie surplus)');
    expect(desc).toContain('2700kcal');
  });

  it('auto-calculates calories when targetCalories is null', () => {
    const a: QuestionnaireAnswers = {
      ...withDomains('diet'),
      diet: { dietType: 'vegan', dietGoal: 'cut', targetCalories: null, activityLevel: 'light', allergiesOrDislikes: 'peanuts' },
    };
    const desc = buildGoalDescription(a);
    expect(desc).toContain('auto-calculate target calories');
    expect(desc).toContain('avoid: peanuts');
  });

  it('includes the custom free-text box only when custom domain is selected and non-empty', () => {
    const withText = withDomains('custom');
    withText.custom = { description: 'Learning to paint on weekends' };
    expect(buildGoalDescription(withText)).toBe('Learning to paint on weekends');

    const withoutSelection = withDomains('exam');
    withoutSelection.custom = { description: 'Should not appear' };
    expect(buildGoalDescription(withoutSelection)).not.toContain('Should not appear');
  });
});

describe('buildGoalContext', () => {
  it('always includes wake/sleep/name, and target date only when present', () => {
    const a = { ...withDomains(), name: 'Asha', wake: '05:30', sleep: '22:30', targetDate: '' };
    const ctx = buildGoalContext(a);
    expect(ctx).toContain('Wake time: 05:30.');
    expect(ctx).toContain('Sleep time: 22:30.');
    expect(ctx).toContain('Name: Asha.');
    expect(ctx).not.toContain('Target date');

    const withDate = { ...a, targetDate: '2027-01-01' };
    expect(buildGoalContext(withDate)).toContain('Target date: 2027-01-01.');
  });

  it('falls back to "not given" for a blank name, matching OnboardingWizard today', () => {
    expect(buildGoalContext(withDomains())).toContain('Name: not given.');
  });
});

describe('resolveTabKeysForDomains', () => {
  it('always includes the core tabs even with no domains selected', () => {
    const result = resolveTabKeysForDomains([], TAB_LABEL_KEYS);
    for (const k of CORE_TAB_KEYS) expect(result).toContain(k);
  });

  it('adds exam tabs only when exam domain is selected', () => {
    const withExam = resolveTabKeysForDomains(['exam'], TAB_LABEL_KEYS);
    expect(withExam).toContain('syllabus');
    expect(withExam).toContain('mocktests');

    const withoutExam = resolveTabKeysForDomains(['fitness'], TAB_LABEL_KEYS);
    expect(withoutExam).not.toContain('syllabus');
    expect(withoutExam).not.toContain('mocktests');
  });

  it('deduplicates the training tab when both fitness and diet are selected', () => {
    const result = resolveTabKeysForDomains(['fitness', 'diet'], TAB_LABEL_KEYS);
    expect(result.filter((k) => k === 'training').length).toBe(1);
  });

  it('never reorders relative to the canonical tab order', () => {
    const result = resolveTabKeysForDomains(['exam', 'fitness', 'diet'], TAB_LABEL_KEYS);
    const indices = result.map((k) => TAB_LABEL_KEYS.indexOf(k));
    const sorted = [...indices].sort((a, b) => a - b);
    expect(indices).toEqual(sorted);
  });

  it('settings/account are untouched since they are pinned outside TABS, not part of this resolver\'s concern', () => {
    // resolveTabKeysForDomains is fed TAB_LABEL_KEYS here only to prove it's
    // a no-op filter; real Phase 8 usage will feed it the TABS-derived
    // subset, not the full TAB_LABEL_KEYS including settings/account.
    const result = resolveTabKeysForDomains([], TAB_LABEL_KEYS as TabLabelKey[]);
    expect(result).not.toContain('settings');
    expect(result).not.toContain('account');
  });
});

describe('deriveProfileFields', () => {
  it('only includes fields for selected domains', () => {
    const a: QuestionnaireAnswers = {
      ...withDomains('diet'),
      diet: { dietType: 'eggetarian', dietGoal: 'recomp', targetCalories: 2200, activityLevel: 'very-active', allergiesOrDislikes: '' },
    };
    const fields = deriveProfileFields(a);
    expect(fields.dietType).toBe('eggetarian');
    expect(fields.fitnessGoal).toBeUndefined();
    expect(fields.examName).toBeUndefined();
  });

  it('trims and omits a blank exam name even if exam domain is selected', () => {
    const a: QuestionnaireAnswers = {
      ...withDomains('exam'),
      exam: { examName: '   ', examDate: '', subjectsHint: '', currentLevel: 'just-starting' },
    };
    expect(deriveProfileFields(a).examName).toBeUndefined();
  });

  it('always carries the selected domains list through, even when empty', () => {
    expect(deriveProfileFields(withDomains()).domains).toEqual([]);
    expect(deriveProfileFields(withDomains('custom')).domains).toEqual(['custom']);
  });
});
