import type { ISODate, PlanTask, Problem, SprayCourse } from './types';
import type { CareDue } from './care';
import { spraysDue, type SprayDue } from './spray';
import { upcomingSaturday } from './dates';

export interface TodayView {
  sprays: SprayDue[];
  plans: PlanTask[];
  watching: Problem[];
  saturdayHint: { careDueCount: number; saturday: ISODate };
}

export function buildToday(i: { courses: SprayCourse[]; plans: PlanTask[]; problems: Problem[]; careDue: CareDue[]; today: ISODate }): TodayView {
  const saturday = upcomingSaturday(i.today);
  return {
    sprays: spraysDue(i.courses, i.today),
    plans: i.plans.filter((p) => !p.doneOn && p.due <= i.today),
    watching: i.problems.filter((p) => !p.resolvedOn),
    saturdayHint: { careDueCount: i.careDue.filter((c) => c.due <= saturday).length, saturday },
  };
}
