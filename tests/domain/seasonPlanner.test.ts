import { test, expect } from 'vitest';
import { spotsFreeingUp, suggestCrops, prepTaskFor } from '../../src/domain/seasonPlanner';
import { cropById } from '../../src/data/crops';
import type { Plant, Spot } from '../../src/domain/types';

const T = '2026-11-04';
const spot = (id: string, over: Partial<Spot> = {}): Spot => ({ id, area: 'terrace', type: 'bed', size: 'large', createdAt: '2026-09-01', ...over });
const tomato = (over: Partial<Plant> = {}): Plant => ({ id: 'p1', spotId: 'T-03', cropId: 'tomato', kind: 'fruitveg', plantedOn: '2026-09-01', ...over });

test('free date is estimated from days to harvest, or taken from expected end', () => {
  expect(spotsFreeingUp([spot('T-03')], [tomato()], T)).toEqual([{ spotId: 'T-03', freeOn: '2026-11-15', estimated: true }]);
  expect(spotsFreeingUp([spot('T-03')], [tomato({ expectedEnd: '2026-12-01' })], T)).toEqual([{ spotId: 'T-03', freeOn: '2026-12-01', estimated: false }]);
});

test('a spot whose only plant has ended is free today', () => {
  expect(spotsFreeingUp([spot('T-03')], [tomato({ endedOn: '2026-11-01' })], T)).toEqual([{ spotId: 'T-03', freeOn: T, estimated: false }]);
});

test('spots freeing up beyond the horizon are left out', () => {
  expect(spotsFreeingUp([spot('T-03')], [tomato({ expectedEnd: '2027-03-01' })], T)).toEqual([]);
});

test('suggestions fit season and pot size', () => {
  const names = suggestCrops(spot('B-01', { area: 'balconyB', type: 'pot', size: 'small' }), '2026-11-20').map((c) => c.id);
  expect(names).toContain('methi');
  expect(names).toContain('palak');
  expect(names).not.toContain('tomato');
  expect(names).not.toContain('bhindi');
});

test('flower balcony only suggests flowering plants', () => {
  const kinds = suggestCrops(spot('A-01', { area: 'balconyA', type: 'pot', size: 'large' }), '2026-11-20').map((c) => c.kind);
  expect(kinds.length).toBeGreaterThan(0);
  expect(new Set(kinds)).toEqual(new Set(['flowering']));
});

test('prep task lead times and clamping', () => {
  const t3 = spot('T-03');
  expect(prepTaskFor(cropById('tomato')!, t3, '2026-12-20', [], T)).toMatchObject({
    title: 'Start Tomato seedlings (for T-03)', due: '2026-11-08', source: 'prep', spotIds: ['T-03'], estMin: 15,
  });
  expect(prepTaskFor(cropById('tomato')!, t3, '2026-11-20', [], T).due).toBe(T);
  expect(prepTaskFor(cropById('guava')!, t3, '2026-12-20', [], T)).toMatchObject({ title: 'Buy Guava sapling (for T-03)', due: '2026-12-13' });
});

test('direct-sown crop: buy seeds unless they are in hand', () => {
  const b1 = spot('B-01', { area: 'balconyB' });
  expect(prepTaskFor(cropById('methi')!, b1, '2026-11-20', [], T).title).toBe('Get Methi (fenugreek) seeds (for B-01)');
  expect(prepTaskFor(cropById('methi')!, b1, '2026-11-20', [{ id: 's', cropId: 'methi', form: 'seed' }], T).title).toBe('Sow Methi (fenugreek) in B-01');
});
