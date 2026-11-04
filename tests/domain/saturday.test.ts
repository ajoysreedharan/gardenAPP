import { test, expect } from 'vitest';
import { buildSaturdayPlan, headerText, type SaturdayPlan } from '../../src/domain/saturday';
import { DEFAULT_SETTINGS } from '../../src/db/db';
import type { CareDue } from '../../src/domain/care';
import type { PlanTask, Spot } from '../../src/domain/types';
import { addDays } from '../../src/domain/dates';

const durations = DEFAULT_SETTINGS.durations;
const spot = (id: string): Spot => ({ id, area: 'terrace', type: 'pot', size: 'medium', createdAt: '2026-10-01' });
const plan = (id: string, estMin: number, due = '2026-11-07'): PlanTask =>
  ({ id, title: id, due, spotIds: [], doneSpotIds: [], estMin, createdAt: '2026-11-01', source: 'user' });
const care = (spotId: string, due: string, type: CareDue['type'] = 'fertilize'): CareDue => ({ spotId, type, due, daysOverdue: 0 });
const base = { plans: [], careDue: [], sprays: [], spots: [] as Spot[], durations, budgetMin: 120 };

test('on Saturday itself, care due today is in the plan', () => {
  const p = buildSaturdayPlan({ ...base, spots: [spot('T-01')], careDue: [care('T-01', '2026-11-07')], today: '2026-11-07' });
  expect(p.saturday).toBe('2026-11-07');
  expect(p.items.map((i) => i.title)).toEqual(['Fertilizer: T-01']);
});

test('planned tasks are always included; care is held when the budget is used up', () => {
  const p = buildSaturdayPlan({
    ...base, plans: [plan('a', 70), plan('b', 60)],
    spots: [spot('T-01'), spot('T-02')], careDue: [care('T-01', '2026-11-01'), care('T-02', '2026-11-01')], today: '2026-11-04',
  });
  expect(p.items.filter((i) => i.group === 'planned')).toHaveLength(2);
  expect(p.items.filter((i) => i.group === 'overdue')).toHaveLength(0);
  expect(p.heldCount).toBe(2);
});

test('50 due pots fill 120 minutes with the most overdue first', () => {
  const spots = Array.from({ length: 50 }, (_, i) => spot(`T-${String(i + 1).padStart(2, '0')}`));
  // T-01 is the least overdue (due 4 Nov), T-50 the most (due 49 days earlier).
  const careDue = spots.map((s, i) => care(s.id, addDays('2026-11-04', -i)));
  const p = buildSaturdayPlan({ ...base, spots, careDue, today: '2026-11-04' });
  expect(p.items[0].spotIds).toHaveLength(40);
  expect(p.heldCount).toBe(10);
  expect(p.totalMin).toBe(120);
  expect(p.items[0].spotIds).toContain('T-50');
  expect(p.items[0].spotIds).not.toContain('T-10');
  expect(p.items[0].spotIds).toContain('T-11');
});

test('care of the same type is grouped into one item', () => {
  const p = buildSaturdayPlan({
    ...base, spots: [spot('T-04'), spot('T-07')], careDue: [care('T-04', '2026-11-01'), care('T-07', '2026-11-02')], today: '2026-11-04',
  });
  expect(p.items).toHaveLength(1);
  expect(p.items[0]).toMatchObject({ title: 'Fertilizer: T-04, T-07', spotIds: ['T-04', 'T-07'], group: 'overdue', daysOverdue: 3 });
});

test('prep tasks go in the season group, after overdue', () => {
  const prep = { ...plan('prep', 15), source: 'prep' as const };
  const p = buildSaturdayPlan({ ...base, plans: [prep, plan('a', 10)], spots: [spot('T-01')], careDue: [care('T-01', '2026-11-01')], today: '2026-11-04' });
  expect(p.items.map((i) => i.group)).toEqual(['planned', 'overdue', 'season']);
});

test('done plans and plans due after Saturday are left out', () => {
  const p = buildSaturdayPlan({ ...base, plans: [{ ...plan('done', 10), doneOn: '2026-11-03' }, plan('later', 10, '2026-11-12')], today: '2026-11-04' });
  expect(p.items).toEqual([]);
});

test('headerText', () => {
  const p = (totalMin: number, heldCount: number): SaturdayPlan => ({ saturday: '2026-11-07', items: [], totalMin, heldCount, budgetMin: 120 });
  expect(headerText(p(115, 4))).toBe('Plan ≈ 1h 55m of 2h · 4 items held for next week');
  expect(headerText(p(45, 0))).toBe('Plan ≈ 45m of 2h');
});

test('lateness counts from today, not from Saturday', () => {
  const p = buildSaturdayPlan({
    ...base, spots: [spot('T-01')], today: '2026-11-04',
    sprays: [{ courseId: 'c', spotId: 'T-01', number: 2, total: 4, due: '2026-11-04', daysLate: 0 }],
  });
  expect(p.items[0]).toMatchObject({ title: 'Spray: T-01', daysOverdue: 0 });
});
