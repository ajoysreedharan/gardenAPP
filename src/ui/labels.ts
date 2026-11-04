import type { AreaId, LogKind, SpotSize, SpotType } from '../domain/types';
import { cropById } from '../data/crops';

export const AREA_LABEL: Record<AreaId, string> = { terrace: 'Terrace', balconyA: 'Flower balcony', balconyB: 'Leafy balcony' };
export const TYPE_LABEL: Record<SpotType, string> = { pot: 'Pot', bed: 'Bed' };
export const SIZE_LABEL: Record<SpotSize, string> = { small: 'Small', medium: 'Medium', large: 'Large' };
export const LOG_LABEL: Record<LogKind, string> = {
  fertilize: 'Fertilizer', soil: 'Soil changed', spray: 'Sprayed', till: 'Tilled', prune: 'Pruned',
  harvest: 'Harvested', plant: 'Planted', crop_end: 'Crop finished', note: 'Note',
};

export const cropName = (id: string) => cropById(id)?.name ?? id;

export function dueTag(daysOverdue: number): { text: string; cls: string } {
  if (daysOverdue > 0) return { text: daysOverdue === 1 ? '1 day late' : `${daysOverdue} days late`, cls: 'red' };
  if (daysOverdue === 0) return { text: 'due today', cls: 'amb' };
  const n = -daysOverdue;
  return { text: n === 1 ? 'tomorrow' : `in ${n} days`, cls: 'grn' };
}
