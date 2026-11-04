import { beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import { TodayScreen } from '../../src/ui/TodayScreen';
import { loadState, type GardenState } from '../../src/ui/useGarden';
import { getAll, put } from '../../src/db/db';
import { startCourse } from '../../src/domain/spray';
import type { SprayCourse } from '../../src/domain/types';
import { freshDb, addSpots } from './helpers';

const T = '2026-11-04';

beforeEach(freshDb);

test('ticking a due spray records it and removes it from today', async () => {
  await addSpots('T-12');
  const course = startCourse({ id: 'p', spotId: 'T-12', text: 'aphids', seenOn: T }, T);
  await put('courses', course);

  let state: GardenState = await loadState(T);
  const reload = async () => { state = await loadState(T); view.rerender(<TodayScreen state={state} reload={reload} />); };
  const view = render(<TodayScreen state={state} reload={reload} />);

  expect(screen.getByText(/T-12/)).toBeTruthy();
  expect(screen.getByText(/1 of 4/)).toBeTruthy();
  fireEvent.click(screen.getByRole('checkbox', { name: /T-12/ }));

  await waitFor(() => expect(screen.queryByText(/1 of 4/)).toBeNull());
  const [saved] = await getAll<SprayCourse>('courses');
  expect(saved.doneDates).toEqual([T]);
  expect((await getAll<{ kind: string }>('logs')).map((l) => l.kind)).toEqual(['spray']);
});
