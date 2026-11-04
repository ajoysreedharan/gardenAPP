import { test, expect } from 'vitest';
import { seasonOf, nextSeasonStart } from '../../src/domain/seasons';
import { CROPS, cropById } from '../../src/data/crops';

test('seasonOf follows the Pune calendar', () => {
  expect(seasonOf('2026-06-01')).toBe('monsoon');
  expect(seasonOf('2026-09-30')).toBe('monsoon');
  expect(seasonOf('2026-10-01')).toBe('winter');
  expect(seasonOf('2027-02-28')).toBe('winter');
  expect(seasonOf('2027-03-01')).toBe('summer');
});

test('nextSeasonStart finds the next boundary', () => {
  expect(nextSeasonStart('2026-11-04')).toEqual({ season: 'summer', start: '2027-03-01' });
  expect(nextSeasonStart('2026-05-20')).toEqual({ season: 'monsoon', start: '2026-06-01' });
});

test('crop ids are unique and methi is leafy', () => {
  expect(new Set(CROPS.map((c) => c.id)).size).toBe(CROPS.length);
  expect(cropById('methi')?.kind).toBe('leafy');
});
