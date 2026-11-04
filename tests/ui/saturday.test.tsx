import { beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import { SaturdayScreen } from '../../src/ui/SaturdayScreen';
import { loadState, type GardenState } from '../../src/ui/useGarden';
import { getAll, put } from '../../src/db/db';
import type { CareRule, LogEntry, PlanTask } from '../../src/domain/types';
import { freshDb, addSpots } from './helpers';

const T = '2026-11-04';

beforeEach(freshDb);

async function mount() {
  let state: GardenState = await loadState(T);
  const reload = async () => { state = await loadState(T); view.rerender(<SaturdayScreen state={state} reload={reload} />); };
  const view = render(<SaturdayScreen state={state} reload={reload} />);
  return view;
}

test('a multi-pot plan is ticked pot by pot', async () => {
  const ids = ['T-01', 'T-02', 'T-03', 'T-04', 'T-05', 'T-06', 'T-07', 'T-08'];
  await addSpots(...ids);
  await put<PlanTask>('plans', { id: 'till', title: 'Till pots', due: '2026-11-07', spotIds: ids, doneSpotIds: [], estMin: 25, createdAt: T, source: 'user' });
  await mount();

  expect(screen.getByText(/You planned/)).toBeTruthy();
  fireEvent.click(screen.getByText(/0 of 8 done/));
  for (const [n, id] of ['T-01', 'T-02', 'T-03'].entries()) {
    fireEvent.click(screen.getByRole('checkbox', { name: `Till pots ${id}` }));
    await screen.findByText(new RegExp(`${n + 1} of 8 done`));
  }
  const [plan] = await getAll<PlanTask>('plans');
  expect(plan.doneSpotIds.sort()).toEqual(['T-01', 'T-02', 'T-03']);
  expect(plan.doneOn).toBeUndefined();
});

test('ticking fertilizer writes a log and keeps the row struck through', async () => {
  await addSpots('T-04');
  await put<CareRule>('careRules', { id: 'r', spotId: 'T-04', type: 'fertilize', intervalDays: 30, initialDue: '2026-11-01' });
  await mount();

  expect(screen.getByText(/Overdue/)).toBeTruthy();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Fertilizer: T-04' }));
  await waitFor(async () => expect(await getAll<LogEntry>('logs')).toMatchObject([{ kind: 'fertilize', spotId: 'T-04', date: T }]));
  expect(screen.getByText('Fertilizer: T-04')).toBeTruthy();
});

test('the header shows the time budget', async () => {
  await mount();
  expect(screen.getByText('Plan ≈ 0m of 2h')).toBeTruthy();
});
