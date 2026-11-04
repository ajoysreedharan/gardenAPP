import type { CareRule, CareType, ISODate, LogEntry, Plant, PlantKind, Spot } from './types';
import { addDays, daysBetween, newId, upcomingSaturday } from './dates';

export type LastDoneAnswer = 'thisWeek' | 'twoWeeks' | 'monthPlus' | 'unknown';

export interface CareDue { spotId: string; type: CareType; due: ISODate; daysOverdue: number }

const FERTILIZE_DAYS = 30;
const SOIL_DAYS = 365;

function initialDue(answer: LastDoneAnswer, interval: number, today: ISODate, unknownIndex: number): ISODate {
  switch (answer) {
    case 'thisWeek': return addDays(today, interval - 3);
    case 'twoWeeks': return addDays(today, interval - 14);
    case 'monthPlus': return today;
    // Spread unknowns over the next 3 Saturdays so setup doesn't make everything due at once.
    case 'unknown': return addDays(upcomingSaturday(today), 7 * (unknownIndex % 3));
  }
}

export function defaultCareRules(
  spot: Spot, kind: PlantKind,
  answers: { fertilize: LastDoneAnswer; soil: LastDoneAnswer },
  today: ISODate, unknownIndex: number,
): CareRule[] {
  const soilInterval = spot.type === 'bed' || kind === 'leafy' ? 'afterCrop' : SOIL_DAYS;
  return [
    { id: newId(), spotId: spot.id, type: 'fertilize', intervalDays: FERTILIZE_DAYS,
      initialDue: initialDue(answers.fertilize, FERTILIZE_DAYS, today, unknownIndex) },
    { id: newId(), spotId: spot.id, type: 'soil', intervalDays: soilInterval,
      initialDue: soilInterval === 'afterCrop' ? today : initialDue(answers.soil, soilInterval, today, unknownIndex) },
  ];
}

function latest(logs: LogEntry[], spotId: string, kind: LogEntry['kind']): ISODate | undefined {
  let best: ISODate | undefined;
  for (const l of logs) if (l.spotId === spotId && l.kind === kind && (!best || l.date > best)) best = l.date;
  return best;
}

export function careDueFor(rule: CareRule, logs: LogEntry[], plants: Plant[], today: ISODate): CareDue | null {
  let due: ISODate;
  if (rule.intervalDays === 'afterCrop') {
    // Soil can't be changed while something is still growing in the spot.
    if (plants.some((p) => p.spotId === rule.spotId && !p.endedOn)) return null;
    const ended = latest(logs, rule.spotId, 'crop_end');
    const soil = latest(logs, rule.spotId, 'soil');
    if (!ended || (soil && soil >= ended)) return null;
    due = ended;
  } else {
    const last = latest(logs, rule.spotId, rule.type);
    due = last ? addDays(last, rule.intervalDays) : rule.initialDue;
  }
  return { spotId: rule.spotId, type: rule.type, due, daysOverdue: daysBetween(due, today) };
}

export function allCareDue(rules: CareRule[], logs: LogEntry[], plants: Plant[], today: ISODate): CareDue[] {
  return rules.map((r) => careDueFor(r, logs, plants, today)).filter((d): d is CareDue => d !== null);
}
