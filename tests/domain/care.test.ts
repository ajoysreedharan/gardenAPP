import { describe, test, expect } from 'vitest';
import { defaultCareRules, careDueFor, allCareDue } from '../../src/domain/care';
import type { CareRule, LogEntry, Plant, Spot } from '../../src/domain/types';

const T = '2026-11-04';
const pot = (id = 'T-01', type: Spot['type'] = 'pot'): Spot => ({ id, area: 'terrace', type, size: 'medium', createdAt: T });
const log = (kind: LogEntry['kind'], date: string, spotId = 'T-01'): LogEntry => ({ id: kind + date, kind, date, spotId });
const unknown = { fertilize: 'unknown', soil: 'unknown' } as const;
const rule = (rules: CareRule[], type: CareRule['type']) => rules.find((r) => r.type === type)!;

describe('fertilize', () => {
  test('due 30 days after the latest fertilize log', () => {
    const r = rule(defaultCareRules(pot(), 'fruitveg', unknown, T, 0), 'fertilize');
    const due = careDueFor(r, [log('fertilize', '2026-10-28')], [], T)!;
    expect(due.due).toBe('2026-11-27');
    expect(due.daysOverdue).toBe(-23);
  });

  test('unknown starting dates spread over the next 3 Saturdays', () => {
    const dues = [0, 1, 2, 3].map((i) => rule(defaultCareRules(pot(), 'fruitveg', unknown, T, i), 'fertilize').initialDue);
    expect(dues).toEqual(['2026-11-07', '2026-11-14', '2026-11-21', '2026-11-07']);
  });

  test('"a month or more" is due today', () => {
    const r = rule(defaultCareRules(pot(), 'fruitveg', { fertilize: 'monthPlus', soil: 'unknown' }, T, 0), 'fertilize');
    expect(careDueFor(r, [], [], T)).toMatchObject({ due: T, daysOverdue: 0 });
  });

  test('"this week" and "~2 weeks" count back from today', () => {
    const a = rule(defaultCareRules(pot(), 'fruitveg', { fertilize: 'thisWeek', soil: 'unknown' }, T, 0), 'fertilize');
    const b = rule(defaultCareRules(pot(), 'fruitveg', { fertilize: 'twoWeeks', soil: 'unknown' }, T, 0), 'fertilize');
    expect(a.initialDue).toBe('2026-12-01');
    expect(b.initialDue).toBe('2026-11-20');
  });
});

describe('soil', () => {
  test('leafy pot changes soil after each crop', () => {
    const r = rule(defaultCareRules(pot(), 'leafy', unknown, T, 0), 'soil');
    expect(r.intervalDays).toBe('afterCrop');
    expect(careDueFor(r, [log('soil', '2026-09-01'), log('crop_end', '2026-11-01')], [], T)?.due).toBe('2026-11-01');
    expect(careDueFor(r, [log('crop_end', '2026-08-01'), log('soil', '2026-09-01')], [], T)).toBeNull();
  });

  test('fruitveg pot is yearly, fruitveg bed is after each crop', () => {
    expect(rule(defaultCareRules(pot(), 'fruitveg', unknown, T, 0), 'soil').intervalDays).toBe(365);
    expect(rule(defaultCareRules(pot('T-02', 'bed'), 'fruitveg', unknown, T, 0), 'soil').intervalDays).toBe('afterCrop');
  });
});

test('two plants in one spot still give one rule per care type', () => {
  const rules = defaultCareRules(pot(), 'fruitveg', unknown, T, 0);
  expect(rules.map((r) => r.type).sort()).toEqual(['fertilize', 'soil']);
  const plants: Plant[] = [
    { id: 'p1', spotId: 'T-01', cropId: 'tomato', kind: 'fruitveg', plantedOn: '2026-09-01' },
    { id: 'p2', spotId: 'T-01', cropId: 'karela', kind: 'fruitveg', plantedOn: '2026-09-01' },
  ];
  const due = allCareDue(rules, [], plants, '2026-11-07').filter((d) => d.type === 'fertilize');
  expect(due).toHaveLength(1);
});
