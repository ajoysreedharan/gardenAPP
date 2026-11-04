import { openDB, type IDBPDatabase } from 'idb';
import type { AreaId, Settings } from '../domain/types';

export type StoreName = 'spots' | 'plants' | 'careRules' | 'logs' | 'plans' | 'problems' | 'courses' | 'seeds';
export const STORES: StoreName[] = ['spots', 'plants', 'careRules', 'logs', 'plans', 'problems', 'courses', 'seeds'];

export const DEFAULT_SETTINGS: Settings = {
  budgetMin: 120,
  durations: { fertilize: { pot: 3, bed: 8 }, soil: { pot: 15, bed: 20 }, spray: 2, till: 5, plan: 15 },
};

const PREFIX: Record<AreaId, string> = { terrace: 'T', balconyA: 'A', balconyB: 'B' };

export function openGardenDb(name = 'garden'): Promise<IDBPDatabase> {
  return openDB(name, 1, {
    upgrade(db) {
      for (const s of STORES) db.createObjectStore(s, { keyPath: 'id' });
      db.createObjectStore('meta');
    },
  });
}

let dbPromise: Promise<IDBPDatabase> | null = null;

export function useDb(db: IDBPDatabase): void {
  dbPromise = Promise.resolve(db);
}

function db(): Promise<IDBPDatabase> {
  return (dbPromise ??= openGardenDb());
}

export async function getAll<T>(store: StoreName): Promise<T[]> {
  return (await db()).getAll(store);
}

export async function put<T extends { id: string }>(store: StoreName, item: T): Promise<void> {
  await (await db()).put(store, item);
}

export async function remove(store: StoreName, id: string): Promise<void> {
  await (await db()).delete(store, id);
}

export async function getSettings(): Promise<Settings> {
  return (await (await db()).get('meta', 'settings')) ?? structuredClone(DEFAULT_SETTINGS);
}

export async function saveSettings(s: Settings): Promise<void> {
  await (await db()).put('meta', s, 'settings');
}

export async function replaceAll(data: Record<StoreName, unknown[]>, settings: Settings): Promise<void> {
  const tx = (await db()).transaction([...STORES, 'meta'], 'readwrite');
  try {
    for (const s of STORES) {
      const store = tx.objectStore(s);
      await store.clear();
      for (const item of data[s]) await store.put(item);
    }
    await tx.objectStore('meta').put(settings, 'settings');
    await tx.done;
  } catch (e) {
    tx.done.catch(() => {}); // the abort rejects tx.done; e is the error that matters
    try { tx.abort(); } catch { /* already aborted */ }
    throw e;
  }
}

export async function nextSpotId(area: AreaId): Promise<string> {
  const prefix = PREFIX[area];
  const spots = await getAll<{ id: string }>('spots');
  const max = spots
    .filter((s) => s.id.startsWith(prefix + '-'))
    .reduce((m, s) => Math.max(m, Number(s.id.slice(2)) || 0), 0);
  return `${prefix}-${String(max + 1).padStart(2, '0')}`;
}

export async function requestPersistence(): Promise<boolean> {
  return (await navigator.storage?.persist?.()) ?? false;
}
