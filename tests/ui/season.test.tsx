import { beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import { SeasonScreen } from '../../src/ui/SeasonScreen';
import { loadState, type GardenState } from '../../src/ui/useGarden';
import { getAll, put } from '../../src/db/db';
import type { PlanTask } from '../../src/domain/types';
import { freshDb, spot } from './helpers';

const T = '2026-11-04';

beforeEach(freshDb);

test('choosing a crop for a free spot creates its prep task', async () => {
  await put('spots', spot('B-01', { area: 'balconyB', size: 'small' }));
  let state: GardenState = await loadState(T);
  const reload = async () => { state = await loadState(T); view.rerender(<SeasonScreen state={state} reload={reload} />); };
  const view = render(<SeasonScreen state={state} reload={reload} />);

  expect(screen.getByText(/Now: Winter/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Methi (fenugreek)' }));
  fireEvent.click(screen.getByRole('button', { name: 'Choose for B-01' }));

  await waitFor(async () => expect(await getAll<PlanTask>('plans')).toMatchObject([
    { title: 'Get Methi (fenugreek) seeds (for B-01)', source: 'prep', spotIds: ['B-01'] },
  ]));
  expect(await screen.findByText(/Planned: Get Methi/)).toBeTruthy();
});
