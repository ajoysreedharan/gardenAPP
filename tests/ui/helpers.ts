import { openGardenDb, useDb, put } from '../../src/db/db';
import type { Spot } from '../../src/domain/types';

export async function freshDb(): Promise<void> {
  useDb(await openGardenDb('test-' + Math.random()));
}

export const spot = (id: string, over: Partial<Spot> = {}): Spot =>
  ({ id, area: 'terrace', type: 'pot', size: 'medium', createdAt: '2026-10-01', ...over });

export async function addSpots(...ids: string[]): Promise<void> {
  for (const id of ids) await put('spots', spot(id));
}
