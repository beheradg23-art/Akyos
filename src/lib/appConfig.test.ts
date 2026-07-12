// Unit tests for the pure calculation functions in appConfig.ts.
//
// These were previously untestable in practice — they lived 1,000+ lines
// into a single 6,700-line App.tsx alongside React components, hooks, and
// JSX. Now that they're plain exported functions in their own module, they
// can be tested directly with no rendering/browser required.
//
// Run with: npx vitest run src/lib/appConfig.test.ts
import { describe, it, expect } from 'vitest';
import {
  getHunterRank,
  computeCurrentStreak,
  getDaysSinceDate,
  getRevisionStatus,
  calculateAge,
  estimateBirthdateFromLegacyAge,
  getPreciseCountdown,
  getLocalDateString,
  HUNTER_RANKS,
  REVISION_FRESH_DAYS,
  REVISION_DUE_DAYS,
  DEFAULT_TRACKER_ITEMS,
} from './appConfig';

describe('getHunterRank', () => {
  it('returns E-rank for 0 cleared days', () => {
    expect(getHunterRank(0).rank).toBe('E');
  });

  it('returns the exact rank at a threshold boundary', () => {
    expect(getHunterRank(5).rank).toBe('D');
    expect(getHunterRank(15).rank).toBe('C');
    expect(getHunterRank(30).rank).toBe('B');
    expect(getHunterRank(60).rank).toBe('A');
    expect(getHunterRank(100).rank).toBe('S');
  });

  it('stays on the previous rank just below a threshold', () => {
    expect(getHunterRank(4).rank).toBe('E');
    expect(getHunterRank(14).rank).toBe('D');
    expect(getHunterRank(99).rank).toBe('A');
  });

  it('caps at S-rank for very large values', () => {
    expect(getHunterRank(10000).rank).toBe('S');
  });

  it('every threshold in HUNTER_RANKS is strictly increasing', () => {
    for (let i = 1; i < HUNTER_RANKS.length; i++) {
      expect(HUNTER_RANKS[i].threshold).toBeGreaterThan(HUNTER_RANKS[i - 1].threshold);
    }
  });
});

describe('computeCurrentStreak', () => {
  const items = DEFAULT_TRACKER_ITEMS;
  const fullDay = () => Object.fromEntries(items.map((i) => [i.id, true]));

  it('is 0 when there is no history at all', () => {
    expect(computeCurrentStreak({}, '2026-07-11', items)).toBe(0);
  });

  it('counts back-to-back complete days ending today', () => {
    const history = {
      '2026-07-11': fullDay(),
      '2026-07-10': fullDay(),
      '2026-07-09': fullDay(),
    };
    expect(computeCurrentStreak(history, '2026-07-11', items)).toBe(3);
  });

  it('still counts yesterday-back if today is incomplete but yesterday was full', () => {
    const history = {
      '2026-07-10': fullDay(),
      '2026-07-09': fullDay(),
      // today (07-11) not in history yet — shouldn't reset the streak to 0
    };
    expect(computeCurrentStreak(history, '2026-07-11', items)).toBe(2);
  });

  it('stops counting at the first gap', () => {
    const history = {
      '2026-07-11': fullDay(),
      '2026-07-10': fullDay(),
      // 07-09 missing — gap
      '2026-07-08': fullDay(),
    };
    expect(computeCurrentStreak(history, '2026-07-11', items)).toBe(2);
  });

  it('does not count a day where only some items were checked', () => {
    const partialDay = { ...fullDay() };
    delete (partialDay as any)[items[0].id];
    const history = { '2026-07-11': partialDay };
    expect(computeCurrentStreak(history, '2026-07-11', items)).toBe(0);
  });
});

describe('syllabus revision date math', () => {
  it('getDaysSinceDate returns 0 for today', () => {
    const today = getLocalDateString();
    expect(getDaysSinceDate(today)).toBe(0);
  });

  it('getRevisionStatus is "never" when nothing was revised yet', () => {
    expect(getRevisionStatus(null).status).toBe('never');
    expect(getRevisionStatus('').status).toBe('never');
  });

  it('getRevisionStatus is "fresh" inside the fresh window', () => {
    const d = new Date();
    d.setDate(d.getDate() - (REVISION_FRESH_DAYS - 1));
    const dateStr = d.toISOString().split('T')[0];
    expect(getRevisionStatus(dateStr).status).toBe('fresh');
  });

  it('getRevisionStatus is "due" between fresh and overdue', () => {
    const d = new Date();
    d.setDate(d.getDate() - (REVISION_FRESH_DAYS + 1));
    const dateStr = d.toISOString().split('T')[0];
    expect(getRevisionStatus(dateStr).status).toBe('due');
  });

  it('getRevisionStatus is "overdue" past the due window', () => {
    const d = new Date();
    d.setDate(d.getDate() - (REVISION_DUE_DAYS + 1));
    const dateStr = d.toISOString().split('T')[0];
    expect(getRevisionStatus(dateStr).status).toBe('overdue');
  });
});

describe('calculateAge', () => {
  it('returns null for missing/invalid input', () => {
    expect(calculateAge(null)).toBeNull();
    expect(calculateAge(undefined)).toBeNull();
    expect(calculateAge('not-a-date')).toBeNull();
    expect(calculateAge('2020/01/01')).toBeNull();
  });

  it('computes age correctly for a birthday already passed this year', () => {
    const today = new Date();
    const birthYear = today.getFullYear() - 20;
    // 10 days ago, so the birthday has already happened this year
    const past = new Date(today);
    past.setDate(past.getDate() - 10);
    const birthdate = `${birthYear}-${String(past.getMonth() + 1).padStart(2, '0')}-${String(past.getDate()).padStart(2, '0')}`;
    expect(calculateAge(birthdate)).toBe(20);
  });

  it('has not incremented age yet if the birthday has not happened this year', () => {
    const today = new Date();
    const birthYear = today.getFullYear() - 20;
    const future = new Date(today);
    future.setDate(future.getDate() + 10);
    const birthdate = `${birthYear}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
    expect(calculateAge(birthdate)).toBe(19);
  });

  it('round-trips with estimateBirthdateFromLegacyAge', () => {
    const birthdate = estimateBirthdateFromLegacyAge(18);
    expect(calculateAge(birthdate)).toBe(18);
  });
});

describe('getPreciseCountdown', () => {
  it('returns null for an empty target date', () => {
    expect(getPreciseCountdown('', '00:00', Date.now())).toBeNull();
  });

  it('marks a past target as expired', () => {
    const result = getPreciseCountdown('2020-01-01', '00:00', Date.now());
    expect(result?.expired).toBe(true);
    expect(result?.text).toBe('00:00:00');
  });

  it('uses hms mode inside the final 24 hours', () => {
    const now = new Date('2026-07-11T00:00:00').getTime();
    const target = '2026-07-11';
    const result = getPreciseCountdown(target, '12:00', now);
    expect(result?.expired).toBe(false);
    expect(result?.mode).toBe('hms');
    expect(result?.hours).toBe(12);
  });

  it('uses dhm mode when more than 24 hours remain', () => {
    const now = new Date('2026-07-11T00:00:00').getTime();
    const result = getPreciseCountdown('2026-07-15', '00:00', now);
    expect(result?.expired).toBe(false);
    expect(result?.mode).toBe('dhm');
    expect(result?.days).toBe(4);
  });
});
