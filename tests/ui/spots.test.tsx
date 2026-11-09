import { beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import { SpotsScreen } from '../../src/ui/SpotsScreen';
import { loadState, type GardenState } from '../../src/ui/useGarden';
import { getAll, put } from '../../src/db/db';
import { defaultCareRules } from '../../src/domain/care';
import type { CareRule, LogEntry, Plant, PlanTask, Spot } from '../../src/domain/types';
import { freshDb, spot } from './helpers';

const T = '2026-11-04';

beforeEach(freshDb);

async function mount() {
  let state: GardenState = await loadState(T);
  const reload = async () => { state = await loadState(T); view.rerender(<SpotsScreen state={state} reload={reload} />); };
  const view = render(<SpotsScreen state={state} reload={reload} />);
}

const pressed = (name: string) => screen.getByRole('button', { name }).getAttribute('aria-pressed');

test('adding a terrace pot with tomato creates the spot, plant and care rules', async () => {
  await mount();
  fireEvent.click(screen.getByText('+ Add spot'));
  fireEvent.click(screen.getByRole('button', { name: 'Terrace' }));
  fireEvent.click(screen.getByRole('button', { name: 'Pot' }));
  fireEvent.click(screen.getByRole('button', { name: 'Medium' }));
  fireEvent.input(screen.getByPlaceholderText(/search crops/i), { target: { value: 'tom' } });
  fireEvent.click(screen.getByRole('button', { name: 'Tomato' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));

  await waitFor(async () => expect(await getAll<Spot>('spots')).toMatchObject([{ id: 'TP-01', area: 'terrace', type: 'pot', size: 'medium' }]));
  expect(await getAll<Plant>('plants')).toMatchObject([{ spotId: 'TP-01', cropId: 'tomato', kind: 'fruitveg', plantedOn: T }]);
  expect((await getAll<CareRule>('careRules')).map((r) => r.type).sort()).toEqual(['fertilize', 'soil']);
});

test('"Save & add another" keeps area, type and size for the next spot', async () => {
  await mount();
  fireEvent.click(screen.getByText('+ Add spot'));
  fireEvent.click(screen.getByRole('button', { name: 'Leafy balcony' }));
  fireEvent.click(screen.getByRole('button', { name: 'Bed' }));
  fireEvent.click(screen.getByRole('button', { name: 'Large' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save & add another' }));

  await waitFor(async () => expect((await getAll<Spot>('spots')).map((s) => s.id)).toEqual(['BB-01']));
  expect(await screen.findByText('Adding BB-02')).toBeTruthy();
  expect(pressed('Leafy balcony')).toBe('true');
  expect(pressed('Bed')).toBe('true');
  expect(pressed('Large')).toBe('true');
});

test('finishing a leafy crop logs it and makes soil change due today', async () => {
  const b1 = spot('B-01', { area: 'balconyB', size: 'small' });
  await put('spots', b1);
  await put<Plant>('plants', { id: 'p1', spotId: 'B-01', cropId: 'palak', kind: 'leafy', plantedOn: '2026-09-20' });
  for (const r of defaultCareRules(b1, 'leafy', { fertilize: 'thisWeek', soil: 'unknown' }, T, 0)) await put('careRules', r);
  await mount();

  fireEvent.click(screen.getByText(/B-01/));
  fireEvent.click(await screen.findByRole('button', { name: 'Crop finished: Palak (spinach)' }));

  await waitFor(async () => expect((await getAll<Plant>('plants'))[0].endedOn).toBe(T));
  expect((await getAll<LogEntry>('logs')).map((l) => l.kind)).toEqual(['crop_end']);
  expect(await screen.findByText('due today')).toBeTruthy();
});

test('choosing drum changes the ID offered for a new spot', async () => {
  await mount();
  fireEvent.click(screen.getByText('+ Add spot'));
  fireEvent.click(screen.getByRole('button', { name: 'Terrace' }));
  fireEvent.click(screen.getByRole('button', { name: 'Drum' }));
  expect(await screen.findByText('Adding TD-01')).toBeTruthy();
});

test('renaming a spot moves its plants, care, logs, problems and plans to the new ID', async () => {
  await put('spots', spot('T-03'));
  await put<Plant>('plants', { id: 'p1', spotId: 'T-03', cropId: 'tomato', kind: 'fruitveg', plantedOn: '2026-10-01' });
  for (const r of defaultCareRules(spot('T-03'), 'fruitveg', { fertilize: 'thisWeek', soil: 'unknown' }, T, 0)) await put('careRules', r);
  await put<LogEntry>('logs', { id: 'l1', date: T, kind: 'fertilize', spotId: 'T-03' });
  await put('problems', { id: 'pr', spotId: 'T-03', text: 'Aphids', seenOn: T });
  await put<PlanTask>('plans', { id: 'pl', title: 'Start Tomato seedlings (for T-03)', due: T, spotIds: ['T-03', 'T-04'], doneSpotIds: ['T-03'], estMin: 15, createdAt: T, source: 'prep' });
  await mount();

  fireEvent.click(screen.getByText(/T-03/));
  fireEvent.click(await screen.findByRole('button', { name: 'Edit spot' }));
  fireEvent.input(screen.getByLabelText('Spot ID'), { target: { value: 'td-01' } });
  fireEvent.click(screen.getByRole('button', { name: 'Drum' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

  await waitFor(async () => expect(await getAll<Spot>('spots')).toMatchObject([{ id: 'TD-01', type: 'drum' }]));
  expect(await screen.findByText(/TD-01 · Drum/)).toBeTruthy();
  expect((await getAll<Plant>('plants'))[0].spotId).toBe('TD-01');
  expect((await getAll<CareRule>('careRules')).map((r) => r.spotId)).toEqual(['TD-01', 'TD-01']);
  expect((await getAll<LogEntry>('logs'))[0].spotId).toBe('TD-01');
  expect((await getAll<{ spotId: string }>('problems'))[0].spotId).toBe('TD-01');
  expect((await getAll<PlanTask>('plans'))[0]).toMatchObject({ title: 'Start Tomato seedlings (for TD-01)', spotIds: ['TD-01', 'T-04'], doneSpotIds: ['TD-01'] });
});

test('a spot cannot be renamed to an ID already in use', async () => {
  await put('spots', spot('T-01'));
  await put('spots', spot('T-02'));
  await mount();
  fireEvent.click(screen.getByText(/T-02/));
  fireEvent.click(await screen.findByRole('button', { name: 'Edit spot' }));
  fireEvent.input(screen.getByLabelText('Spot ID'), { target: { value: 'T-01' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(await screen.findByText('T-01 is already used')).toBeTruthy();
  expect((await getAll<Spot>('spots')).map((s) => s.id)).toEqual(['T-01', 'T-02']);
});
