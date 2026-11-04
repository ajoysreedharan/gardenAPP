import { test, expect } from 'vitest';
import { startCourse, nextSprayDue, markSprayDone, spraysDue } from '../../src/domain/spray';
import type { Problem } from '../../src/domain/types';

const problem: Problem = { id: 'p1', spotId: 'T-12', text: 'aphids', seenOn: '2026-11-01' };

test('a new course is due on its start day as spray 1 of 4', () => {
  const c = startCourse(problem, '2026-11-01');
  expect(c).toMatchObject({ total: 4, intervalDays: 3, product: 'Wood vinegar' });
  expect(nextSprayDue(c)).toBe('2026-11-01');
  expect(spraysDue([c], '2026-11-01')[0]).toMatchObject({ number: 1, total: 4, daysLate: 0, spotId: 'T-12' });
});

test('a late spray shifts the rest of the course', () => {
  let c = markSprayDone(startCourse(problem, '2026-11-01'), '2026-11-01');
  expect(nextSprayDue(c)).toBe('2026-11-04');
  c = markSprayDone(c, '2026-11-06');
  expect(nextSprayDue(c)).toBe('2026-11-09');
});

test('a finished course has nothing due', () => {
  let c = startCourse(problem, '2026-11-01');
  for (const d of ['2026-11-01', '2026-11-04', '2026-11-07', '2026-11-10']) c = markSprayDone(c, d);
  expect(nextSprayDue(c)).toBeNull();
  expect(spraysDue([c], '2026-12-01')).toEqual([]);
});

test('after a long gap the missed spray shows once with its lateness', () => {
  const c = markSprayDone(startCourse(problem, '2026-10-01'), '2026-10-01');
  const due = spraysDue([c], '2026-10-20');
  expect(due).toHaveLength(1);
  expect(due[0]).toMatchObject({ number: 2, daysLate: 16 });
});

test('a future spray is not due yet', () => {
  const c = markSprayDone(startCourse(problem, '2026-11-01'), '2026-11-01');
  expect(spraysDue([c], '2026-11-03')).toEqual([]);
});
