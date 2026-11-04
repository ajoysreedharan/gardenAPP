import { useCallback, useEffect, useState } from 'preact/hooks';
import type { CareRule, ISODate, LogEntry, Plant, PlanTask, Problem, Seed, Settings, Spot, SprayCourse } from '../domain/types';
import { getAll, getSettings } from '../db/db';
import { allCareDue, type CareDue } from '../domain/care';
import { today as todayDate } from '../domain/dates';

export interface GardenState {
  spots: Spot[]; plants: Plant[]; careRules: CareRule[]; logs: LogEntry[]; plans: PlanTask[];
  problems: Problem[]; courses: SprayCourse[]; seeds: Seed[]; settings: Settings; today: ISODate;
}

export interface ScreenProps { state: GardenState; reload: () => Promise<void> }

export async function loadState(today: ISODate = todayDate()): Promise<GardenState> {
  const [spots, plants, careRules, logs, plans, problems, courses, seeds, settings] = await Promise.all([
    getAll<Spot>('spots'), getAll<Plant>('plants'), getAll<CareRule>('careRules'), getAll<LogEntry>('logs'),
    getAll<PlanTask>('plans'), getAll<Problem>('problems'), getAll<SprayCourse>('courses'), getAll<Seed>('seeds'), getSettings(),
  ]);
  spots.sort((a, b) => a.id.localeCompare(b.id));
  return { spots, plants, careRules, logs, plans, problems, courses, seeds, settings, today };
}

export function careDueNow(s: GardenState): CareDue[] {
  return allCareDue(s.careRules, s.logs, s.plants, s.today);
}

export function useGarden(): { state: GardenState | null; reload: () => Promise<void> } {
  const [state, setState] = useState<GardenState | null>(null);
  const reload = useCallback(async () => setState(await loadState()), []);
  useEffect(() => { reload(); }, [reload]);
  return { state, reload };
}
