import type { ISODate } from './types';

export type Season = 'monsoon' | 'winter' | 'summer';

export const SEASON_LABEL: Record<Season, string> = {
  monsoon: 'Monsoon (Jun–Sep)',
  winter: 'Winter (Oct–Feb)',
  summer: 'Summer (Mar–May)',
};

// Pune: monsoon Jun–Sep, winter Oct–Feb, summer Mar–May.
export function seasonOf(d: ISODate): Season {
  const m = Number(d.slice(5, 7));
  if (m >= 6 && m <= 9) return 'monsoon';
  if (m >= 3 && m <= 5) return 'summer';
  return 'winter';
}

export function nextSeasonStart(d: ISODate): { season: Season; start: ISODate } {
  const y = Number(d.slice(0, 4));
  const m = Number(d.slice(5, 7));
  if (m >= 3 && m <= 5) return { season: 'monsoon', start: `${y}-06-01` };
  if (m >= 6 && m <= 9) return { season: 'winter', start: `${y}-10-01` };
  return { season: 'summer', start: `${m >= 10 ? y + 1 : y}-03-01` };
}
