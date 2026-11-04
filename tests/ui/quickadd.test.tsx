import { beforeEach, test, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import { QuickAdd } from '../../src/ui/QuickAdd';
import { loadState } from '../../src/ui/useGarden';
import { getAll } from '../../src/db/db';
import type { PlanTask, Problem, SprayCourse } from '../../src/domain/types';
import { freshDb, addSpots } from './helpers';

const T = '2026-11-04';

beforeEach(freshDb);

test('a plan defaults to this Saturday', async () => {
  const onDone = vi.fn();
  render(<QuickAdd state={await loadState(T)} onDone={onDone} />);
  fireEvent.input(screen.getByPlaceholderText(/pluck guavas/i), { target: { value: 'Pluck guavas' } });
  fireEvent.click(screen.getByText('Save'));
  await waitFor(() => expect(onDone).toHaveBeenCalled());
  const plans = await getAll<PlanTask>('plans');
  expect(plans).toHaveLength(1);
  expect(plans[0]).toMatchObject({ title: 'Pluck guavas', due: '2026-11-07', source: 'user', estMin: 15 });
});

test('a problem on a spot starts a 4-spray course', async () => {
  await addSpots('T-12');
  const onDone = vi.fn();
  render(<QuickAdd state={await loadState(T)} onDone={onDone} />);
  fireEvent.input(screen.getByPlaceholderText(/pluck guavas/i), { target: { value: 'Aphids' } });
  fireEvent.click(screen.getByText('Problem seen'));
  fireEvent.click(screen.getByRole('button', { name: 'T-12' }));
  fireEvent.click(screen.getByText('Save'));
  await waitFor(() => expect(onDone).toHaveBeenCalled());
  expect(await getAll<Problem>('problems')).toMatchObject([{ spotId: 'T-12', text: 'Aphids', seenOn: T }]);
  expect(await getAll<SprayCourse>('courses')).toMatchObject([{ spotId: 'T-12', total: 4, intervalDays: 3, startDue: T }]);
});

test('a problem needs a spot', async () => {
  const onDone = vi.fn();
  render(<QuickAdd state={await loadState(T)} onDone={onDone} />);
  fireEvent.input(screen.getByPlaceholderText(/pluck guavas/i), { target: { value: 'Aphids' } });
  fireEvent.click(screen.getByText('Problem seen'));
  fireEvent.click(screen.getByText('Save'));
  expect(await screen.findByText('Pick the spot with the problem')).toBeTruthy();
  expect(onDone).not.toHaveBeenCalled();
});
