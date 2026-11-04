import type { ISODate, Problem, SprayCourse } from './types';
import { addDays, daysBetween, newId } from './dates';

export interface SprayDue { courseId: string; spotId: string; number: number; total: number; due: ISODate; daysLate: number }

export function startCourse(
  problem: Problem, today: ISODate,
  opts: { total?: number; intervalDays?: number; product?: string } = {},
): SprayCourse {
  return {
    id: newId(), problemId: problem.id, spotId: problem.spotId,
    product: opts.product ?? 'Wood vinegar', total: opts.total ?? 4, intervalDays: opts.intervalDays ?? 3,
    startDue: today, doneDates: [],
  };
}

// The next spray counts from the actual last spray, so a late spray shifts the rest.
export function nextSprayDue(c: SprayCourse): ISODate | null {
  if (c.doneDates.length >= c.total) return null;
  if (c.doneDates.length === 0) return c.startDue;
  return addDays(c.doneDates[c.doneDates.length - 1], c.intervalDays);
}

export function markSprayDone(c: SprayCourse, on: ISODate): SprayCourse {
  return { ...c, doneDates: [...c.doneDates, on] };
}

export function spraysDue(courses: SprayCourse[], today: ISODate): SprayDue[] {
  const out: SprayDue[] = [];
  for (const c of courses) {
    const due = nextSprayDue(c);
    if (due && due <= today) {
      out.push({ courseId: c.id, spotId: c.spotId, number: c.doneDates.length + 1, total: c.total, due, daysLate: daysBetween(due, today) });
    }
  }
  return out;
}
