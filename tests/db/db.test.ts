import { beforeEach, test, expect } from 'vitest';
import { openGardenDb, useDb, getAll, put, getSettings, saveSettings, nextSpotId, replaceAll, DEFAULT_SETTINGS, type StoreName } from '../../src/db/db';
import type { Spot } from '../../src/domain/types';

const spot = (id: string): Spot => ({ id, area: 'terrace', type: 'pot', size: 'medium', createdAt: '2026-11-04' });

const empty = (): Record<StoreName, unknown[]> => ({
  spots: [], plants: [], careRules: [], logs: [], plans: [], problems: [], courses: [], seeds: [], crops: [],
});

beforeEach(async () => {
  useDb(await openGardenDb('test-' + Math.random()));
});

test('put then getAll returns the item', async () => {
  await put('spots', spot('T-01'));
  expect(await getAll('spots')).toEqual([spot('T-01')]);
});

test('settings default when none stored', async () => {
  const s = await getSettings();
  expect(s).toEqual(DEFAULT_SETTINGS);
  expect(s.budgetMin).toBe(120);
});

test('nextSpotId counts up per area prefix', async () => {
  expect(await nextSpotId('terrace')).toBe('T-01');
  await put('spots', spot('T-01'));
  expect(await nextSpotId('terrace')).toBe('T-02');
  expect(await nextSpotId('balconyB')).toBe('B-01');
});

test('replaceAll is atomic: a bad item leaves old data intact', async () => {
  await put('spots', spot('T-01'));
  const bad = { ...empty(), spots: [spot('T-09')], plans: [42] };
  await expect(replaceAll(bad, DEFAULT_SETTINGS)).rejects.toThrow();
  expect(await getAll('spots')).toEqual([spot('T-01')]);
});

test('settings saved before drums existed get default drum timings', async () => {
  const { drum: _f, ...fertilize } = DEFAULT_SETTINGS.durations.fertilize;
  const { drum: _s, ...soil } = DEFAULT_SETTINGS.durations.soil;
  await saveSettings({ ...DEFAULT_SETTINGS, budgetMin: 90, durations: { ...DEFAULT_SETTINGS.durations, fertilize, soil } as never });
  const s = await getSettings();
  expect(s.budgetMin).toBe(90);
  expect(s.durations.fertilize.drum).toBe(5);
  expect(s.durations.soil.drum).toBe(25);
});
