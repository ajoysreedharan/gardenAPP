import { test, expect } from 'vitest';
import { careDueFor } from '../../src/domain/care';
import { spotsFreeingUp, suggestCrops } from '../../src/domain/seasonPlanner';
import { buildSaturdayPlan } from '../../src/domain/saturday';
import { openGardenDb, useDb, put, nextSpotId, DEFAULT_SETTINGS } from '../../src/db/db';
import type { CareRule, LogEntry, Plant, PlanTask, Spot } from '../../src/domain/types';

const T = '2026-11-04';
const bed: Spot = { id: 'T-40', area: 'terrace', type: 'bed', size: 'large', createdAt: '2026-08-01' };

test('soil "after crop" is not due while another plant in the spot is still growing', () => {
  const rule: CareRule = { id: 'r', spotId: 'T-40', type: 'soil', intervalDays: 'afterCrop', initialDue: T };
  const logs: LogEntry[] = [{ id: 'l', date: '2026-11-01', kind: 'crop_end', spotId: 'T-40' }];
  const plants: Plant[] = [
    { id: 'a', spotId: 'T-40', cropId: 'tomato', kind: 'fruitveg', plantedOn: '2026-09-01' },
    { id: 'b', spotId: 'T-40', cropId: 'karela', kind: 'fruitveg', plantedOn: '2026-08-01', endedOn: '2026-11-01' },
  ];
  expect(careDueFor(rule, logs, plants, T)).toBeNull();
  expect(careDueFor(rule, logs, plants.map((p) => ({ ...p, endedOn: p.endedOn ?? T })), T)?.due).toBe('2026-11-01');
});

test('a past harvest estimate frees the spot today and suggests crops for this season', () => {
  const plants: Plant[] = [{ id: 'a', spotId: 'T-40', cropId: 'bhindi', kind: 'fruitveg', plantedOn: '2026-08-05' }];
  const [f] = spotsFreeingUp([bed], plants, T);
  expect(f).toMatchObject({ freeOn: T, harvestDue: '2026-09-24', estimated: true });
  const ids = suggestCrops(bed, f.freeOn).map((c) => c.id);
  expect(ids).toContain('peas');
  expect(ids).not.toContain('bhindi');
});

test('season prep fits in the budget after overdue care', () => {
  const prep = (id: string): PlanTask => ({ id, title: id, due: T, spotIds: [], doneSpotIds: [], estMin: 15, createdAt: T, source: 'prep' });
  const p = buildSaturdayPlan({
    plans: ['a', 'b', 'c', 'd', 'e', 'f'].map(prep),
    careDue: [{ spotId: 'T-40', type: 'fertilize', due: '2026-10-01', daysOverdue: 34 }],
    sprays: [], spots: [bed], durations: DEFAULT_SETTINGS.durations, budgetMin: 90, today: T,
  });
  expect(p.items.some((i) => i.title === 'Fertilizer: T-40')).toBe(true);
  expect(p.items.filter((i) => i.group === 'season')).toHaveLength(5);
  expect(p.heldCount).toBe(1);
  expect(p.items.map((i) => i.group)).toEqual(['overdue', 'season', 'season', 'season', 'season', 'season']);
});

test('nextSpotId reuses a freed number so re-adding matches the physical tag', async () => {
  useDb(await openGardenDb('test-' + Math.random()));
  for (const id of ['TB-01', 'TB-02', 'TB-03']) await put('spots', { ...bed, id });
  const { remove } = await import('../../src/db/db');
  await remove('spots', 'TB-02');
  expect(await nextSpotId('terrace', 'bed')).toBe('TB-02');
});
