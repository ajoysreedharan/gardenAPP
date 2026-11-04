import type { ISODate, Plant, PlanTask, Seed, Spot, SpotSize } from './types';
import { CROPS, cropById, type Crop } from '../data/crops';
import { seasonOf } from './seasons';
import { addDays, daysBetween, newId } from './dates';

// freeOn is never in the past; harvestDue keeps an estimate that has already passed.
export interface FreeingSpot { spotId: string; freeOn: ISODate; estimated: boolean; harvestDue?: ISODate }

const SIZE_RANK: Record<SpotSize, number> = { small: 0, medium: 1, large: 2 };
const LEAD_DAYS = { transplant: 42, direct: 7, sapling: 7 } as const;

export function spotsFreeingUp(spots: Spot[], plants: Plant[], today: ISODate, horizonDays = 56): FreeingSpot[] {
  const out: FreeingSpot[] = [];
  for (const s of spots) {
    const active = plants.filter((p) => p.spotId === s.id && !p.endedOn);
    if (active.length === 0) {
      out.push({ spotId: s.id, freeOn: today, estimated: false });
      continue;
    }
    // The spot frees up when its first plant finishes.
    let best: FreeingSpot | null = null;
    for (const p of active) {
      const freeOn = p.expectedEnd ?? addDays(p.plantedOn, cropById(p.cropId)?.daysToHarvest ?? 90);
      if (!best || freeOn < best.freeOn) best = { spotId: s.id, freeOn, estimated: !p.expectedEnd };
    }
    if (best && best.freeOn < today) best = { ...best, harvestDue: best.freeOn, freeOn: today };
    if (best && daysBetween(today, best.freeOn) <= horizonDays) out.push(best);
  }
  return out.sort((a, b) => a.freeOn.localeCompare(b.freeOn));
}

export function suggestCrops(spot: Spot, freeOn: ISODate): Crop[] {
  const season = seasonOf(freeOn);
  const fits = CROPS.filter((c) => c.seasons.includes(season) && SIZE_RANK[spot.size] >= SIZE_RANK[c.minSize]);
  if (spot.area === 'balconyA') return fits.filter((c) => c.kind === 'flowering');
  if (spot.area === 'balconyB') return [...fits.filter((c) => c.kind === 'leafy'), ...fits.filter((c) => c.kind !== 'leafy')];
  return fits;
}

export function prepTaskFor(crop: Crop, spot: Spot, freeOn: ISODate, seeds: Seed[], today: ISODate): PlanTask {
  let title: string;
  if (crop.method === 'transplant') title = `Start ${crop.name} seedlings (for ${spot.id})`;
  else if (crop.method === 'sapling') title = `Buy ${crop.name} sapling (for ${spot.id})`;
  else if (seeds.some((s) => s.cropId === crop.id)) title = `Sow ${crop.name} in ${spot.id}`;
  else title = `Get ${crop.name} seeds (for ${spot.id})`;

  const due = addDays(freeOn, -LEAD_DAYS[crop.method]);
  return {
    id: newId(), title, due: due < today ? today : due, spotIds: [spot.id], doneSpotIds: [],
    estMin: 15, createdAt: today, source: 'prep',
  };
}
