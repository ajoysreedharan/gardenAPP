import { beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import { SpotsScreen } from '../../src/ui/SpotsScreen';
import { loadState, type GardenState } from '../../src/ui/useGarden';
import { getAll, put } from '../../src/db/db';
import { defaultCareRules } from '../../src/domain/care';
import type { CareRule, LogEntry, Plant, Spot } from '../../src/domain/types';
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

  await waitFor(async () => expect(await getAll<Spot>('spots')).toMatchObject([{ id: 'T-01', area: 'terrace', type: 'pot', size: 'medium' }]));
  expect(await getAll<Plant>('plants')).toMatchObject([{ spotId: 'T-01', cropId: 'tomato', kind: 'fruitveg', plantedOn: T }]);
  expect((await getAll<CareRule>('careRules')).map((r) => r.type).sort()).toEqual(['fertilize', 'soil']);
});

test('"Save & add another" keeps area, type and size for the next spot', async () => {
  await mount();
  fireEvent.click(screen.getByText('+ Add spot'));
  fireEvent.click(screen.getByRole('button', { name: 'Leafy balcony' }));
  fireEvent.click(screen.getByRole('button', { name: 'Bed' }));
  fireEvent.click(screen.getByRole('button', { name: 'Large' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save & add another' }));

  await waitFor(async () => expect((await getAll<Spot>('spots')).map((s) => s.id)).toEqual(['B-01']));
  expect(await screen.findByText('Adding B-02')).toBeTruthy();
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
