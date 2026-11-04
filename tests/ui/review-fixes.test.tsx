import { beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import { App } from '../../src/ui/App';
import { TodayScreen } from '../../src/ui/TodayScreen';
import { SettingsScreen } from '../../src/ui/SettingsScreen';
import { SpotsScreen } from '../../src/ui/SpotsScreen';
import { loadState, type GardenState } from '../../src/ui/useGarden';
import { getAll, getSettings, put } from '../../src/db/db';
import { today } from '../../src/domain/dates';
import type { LogEntry, PlanTask, Problem, Spot } from '../../src/domain/types';
import { freshDb, spot, addSpots } from './helpers';

const T = '2026-11-04';
beforeEach(freshDb);

function mounted<P>(Screen: (p: P & { state: GardenState; reload: () => Promise<void> }) => any, extra: P = {} as P) {
  return async () => {
    let state = await loadState(T);
    const reload = async () => { state = await loadState(T); view.rerender(<Screen {...extra} state={state} reload={reload} />); };
    const view = render(<Screen {...extra} state={state} reload={reload} />);
    return view;
  };
}

test('the app reloads when it comes back to the foreground', async () => {
  render(<App />);
  await screen.findByText(/Your quick daily check/);
  await put<Problem>('problems', { id: 'p', spotId: 'T-01', text: 'Mites', seenOn: today() });
  document.dispatchEvent(new Event('visibilitychange'));
  expect(await screen.findByText(/T-01 Mites/)).toBeTruthy();
});

test('a multi-pot plan on Today is ticked pot by pot', async () => {
  await addSpots('T-01', 'T-02', 'T-03');
  await put<PlanTask>('plans', { id: 'till', title: 'Till pots', due: T, spotIds: ['T-01', 'T-02', 'T-03'], doneSpotIds: [], estMin: 15, createdAt: T, source: 'user' });
  await mounted(TodayScreen)();
  expect(screen.getByText(/0 of 3 done/)).toBeTruthy();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Till pots T-02' }));
  await screen.findByText(/1 of 3 done/);
  const [p] = await getAll<PlanTask>('plans');
  expect(p.doneSpotIds).toEqual(['T-02']);
  expect(p.doneOn).toBeUndefined();
});

test('settings edits after a backup keep the backup date', async () => {
  await mounted(SettingsScreen)();
  fireEvent.click(screen.getByText('Back up now'));
  await screen.findByText(/Saved garden-backup/);
  fireEvent.change(screen.getByLabelText('Saturday time (minutes)'), { target: { value: '90' } });
  await waitFor(async () => expect((await getSettings()).budgetMin).toBe(90));
  expect((await getSettings()).lastBackupOn).toBe(T);
});

test('a problem photo can be seen on Today and in the spot', async () => {
  (URL as any).createObjectURL ??= () => 'blob:test';
  (URL as any).revokeObjectURL ??= () => {};
  await addSpots('T-01');
  await put<Problem>('problems', { id: 'p', spotId: 'T-01', text: 'Aphids', seenOn: T, photo: new Blob(['x'], { type: 'image/jpeg' }) });
  const view = await mounted(TodayScreen)();
  expect(screen.getByAltText('Photo: T-01 Aphids')).toBeTruthy();
  view.unmount();
  await mounted(SpotsScreen)();
  fireEvent.click(screen.getByText('T-01'));
  expect(await screen.findByAltText('Photo: T-01 Aphids')).toBeTruthy();
});

test('a spot can be edited, and deleting it removes its history', async () => {
  await put('spots', spot('T-01'));
  await put<LogEntry>('logs', { id: 'l', date: T, kind: 'fertilize', spotId: 'T-01' });
  await mounted(SpotsScreen)();
  fireEvent.click(screen.getByText('T-01'));
  fireEvent.click(await screen.findByRole('button', { name: 'Edit spot' }));
  fireEvent.click(screen.getByRole('button', { name: 'Large' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(async () => expect((await getAll<Spot>('spots'))[0].size).toBe('large'));

  fireEvent.click(await screen.findByRole('button', { name: 'Delete spot' }));
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  await waitFor(async () => expect(await getAll('spots')).toEqual([]));
  expect(await getAll('logs')).toEqual([]);
});
