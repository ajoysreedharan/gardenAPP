import type { CareType, Durations, ISODate, PlanTask, Spot } from './types';
import type { CareDue } from './care';
import type { SprayDue } from './spray';
import { daysBetween, upcomingSaturday } from './dates';

export type PlanGroup = 'planned' | 'overdue' | 'season';
export type PlanRef = { kind: 'plan'; id: string } | { kind: 'care'; type: CareType } | { kind: 'spray'; courseIds: string[] };
export interface PlanItem { key: string; group: PlanGroup; title: string; spotIds: string[]; estMin: number; daysOverdue: number; ref: PlanRef }
export interface SaturdayPlan { saturday: ISODate; items: PlanItem[]; totalMin: number; heldCount: number; budgetMin: number }

const CARE_LABEL: Record<CareType, string> = { fertilize: 'Fertilizer', soil: 'Soil change' };
const GROUP_ORDER: PlanGroup[] = ['planned', 'overdue', 'season'];

interface Candidate { spotId: string; estMin: number; overdue: number; kind: 'spray' | CareType; courseId?: string }

export function buildSaturdayPlan(i: {
  plans: PlanTask[]; careDue: CareDue[]; sprays: SprayDue[]; spots: Spot[];
  durations: Durations; budgetMin: number; today: ISODate;
}): SaturdayPlan {
  const saturday = upcomingSaturday(i.today);
  const items: PlanItem[] = [];
  let totalMin = 0;

  // Things the owner planned always go in, even past the budget.
  for (const p of i.plans) {
    if (p.doneOn || p.due > saturday) continue;
    items.push({
      key: `plan:${p.id}`, group: p.source === 'prep' ? 'season' : 'planned', title: p.title,
      spotIds: p.spotIds, estMin: p.estMin, daysOverdue: Math.max(0, daysBetween(p.due, i.today)), ref: { kind: 'plan', id: p.id },
    });
    totalMin += p.estMin;
  }

  const spotType = new Map(i.spots.map((s) => [s.id, s.type]));
  const candidates: Candidate[] = [
    ...i.sprays.filter((s) => s.due <= saturday).map((s): Candidate => ({
      spotId: s.spotId, estMin: i.durations.spray, overdue: daysBetween(s.due, i.today), kind: 'spray', courseId: s.courseId,
    })),
    ...i.careDue.filter((c) => c.due <= saturday).map((c): Candidate => ({
      spotId: c.spotId, estMin: i.durations[c.type][spotType.get(c.spotId) ?? 'pot'], overdue: daysBetween(c.due, i.today), kind: c.type,
    })),
  ].sort((a, b) => b.overdue - a.overdue);

  const chosen: Candidate[] = [];
  let heldCount = 0;
  for (const c of candidates) {
    if (totalMin + c.estMin <= i.budgetMin) {
      chosen.push(c);
      totalMin += c.estMin;
    } else {
      heldCount++;
    }
  }

  for (const kind of ['spray', 'fertilize', 'soil'] as const) {
    const members = chosen.filter((c) => c.kind === kind);
    if (members.length === 0) continue;
    const spotIds = [...new Set(members.map((m) => m.spotId))].sort();
    items.push({
      key: `${kind}:${spotIds.join(',')}`, group: 'overdue',
      title: `${kind === 'spray' ? 'Spray' : CARE_LABEL[kind]}: ${spotIds.join(', ')}`,
      spotIds, estMin: members.reduce((n, m) => n + m.estMin, 0), daysOverdue: Math.max(...members.map((m) => m.overdue)),
      ref: kind === 'spray' ? { kind: 'spray', courseIds: members.map((m) => m.courseId!) } : { kind: 'care', type: kind },
    });
  }

  items.sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group));
  return { saturday, items, totalMin, heldCount, budgetMin: i.budgetMin };
}

export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function headerText(p: SaturdayPlan): string {
  const held = p.heldCount > 0 ? ` · ${p.heldCount} items held for next week` : '';
  return `Plan ≈ ${formatMinutes(p.totalMin)} of ${formatMinutes(p.budgetMin)}${held}`;
}
