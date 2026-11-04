import { test, expect } from 'vitest';
import { buildToday } from '../../src/domain/today';
import { buildSaturdayPlan } from '../../src/domain/saturday';
import { DEFAULT_SETTINGS } from '../../src/db/db';
import type { PlanTask, Problem } from '../../src/domain/types';

const plan = (over: Partial<PlanTask> = {}): PlanTask =>
  ({ id: 'w', title: 'Clean corner', due: '2026-11-04', spotIds: [], doneSpotIds: [], estMin: 15, createdAt: '2026-11-01', source: 'user', ...over });
const base = { courses: [], problems: [] as Problem[], careDue: [] };

test('a missed weekday plan shows on Today and in Saturday "planned", once each', () => {
  const t = buildToday({ ...base, plans: [plan()], today: '2026-11-06' });
  expect(t.plans.map((p) => p.id)).toEqual(['w']);
  const s = buildSaturdayPlan({ plans: [plan()], careDue: [], sprays: [], spots: [], durations: DEFAULT_SETTINGS.durations, budgetMin: 120, today: '2026-11-07' });
  expect(s.items.filter((i) => i.group === 'planned').map((i) => i.key)).toEqual(['plan:w']);
});

test('Today leaves out done plans, future plans and resolved problems', () => {
  const t = buildToday({
    ...base, today: '2026-11-04',
    plans: [plan({ id: 'done', doneOn: '2026-11-04' }), plan({ id: 'sat', due: '2026-11-07' })],
    problems: [
      { id: 'a', spotId: 'T-01', text: 'aphids', seenOn: '2026-11-01' },
      { id: 'b', spotId: 'T-02', text: 'mites', seenOn: '2026-10-01', resolvedOn: '2026-10-20' },
    ],
  });
  expect(t.plans).toEqual([]);
  expect(t.watching.map((p) => p.id)).toEqual(['a']);
});

test('Saturday hint counts care due by Saturday', () => {
  const t = buildToday({
    ...base, plans: [], today: '2026-11-04',
    careDue: [
      { spotId: 'T-01', type: 'fertilize', due: '2026-11-07', daysOverdue: -3 },
      { spotId: 'T-02', type: 'fertilize', due: '2026-11-20', daysOverdue: -16 },
    ],
  });
  expect(t.saturdayHint).toEqual({ careDueCount: 1, saturday: '2026-11-07' });
});
