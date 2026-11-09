import { openDB, type IDBPDatabase } from 'idb';
import type { AreaId, PlanTask, Settings, Spot, SpotType } from '../domain/types';

export type StoreName = 'spots' | 'plants' | 'careRules' | 'logs' | 'plans' | 'problems' | 'courses' | 'seeds' | 'crops';
export const STORES: StoreName[] = ['spots', 'plants', 'careRules', 'logs', 'plans', 'problems', 'courses', 'seeds', 'crops'];

export const DEFAULT_SETTINGS: Settings = {
  budgetMin: 120,
  durations: { fertilize: { pot: 3, drum: 5, bed: 8 }, soil: { pot: 15, drum: 25, bed: 20 }, spray: 2, till: 5, plan: 15 },
};

const PREFIX: Record<AreaId, string> = { terrace: 'T', balconyA: 'A', balconyB: 'B' };
const TYPE_LETTER: Record<SpotType, string> = { pot: 'P', drum: 'D', bed: 'B' };

export function openGardenDb(name = 'garden'): Promise<IDBPDatabase> {
  // v2 added 'crops'; create whatever an older db is missing.
  return openDB(name, 2, {
    upgrade(db) {
      for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
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

export async function get<T>(store: StoreName, id: string): Promise<T | undefined> {
  return (await db()).get(store, id);
}

export async function put<T extends { id: string }>(store: StoreName, item: T): Promise<void> {
  await (await db()).put(store, item);
}

// Writes several records in one transaction: all land, or none do.
export async function putMany(entries: [StoreName, { id: string }][]): Promise<void> {
  const tx = (await db()).transaction([...new Set(entries.map(([s]) => s))], 'readwrite');
  await Promise.all([...entries.map(([s, item]) => tx.objectStore(s).put(item)), tx.done]);
}

export async function remove(store: StoreName, id: string): Promise<void> {
  await (await db()).delete(store, id);
}

// Fills in anything added since the settings were saved (such as drum timings).
function withDefaults(s: Settings): Settings {
  const d = DEFAULT_SETTINGS.durations;
  return {
    ...s,
    durations: { ...d, ...s.durations, fertilize: { ...d.fertilize, ...s.durations?.fertilize }, soil: { ...d.soil, ...s.durations?.soil } },
  };
}

export async function getSettings(): Promise<Settings> {
  const saved: Settings | undefined = await (await db()).get('meta', 'settings');
  return saved ? withDefaults(saved) : structuredClone(DEFAULT_SETTINGS);
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

// Area letter + type letter, e.g. TP-01 for a terrace pot, TD-01 for a terrace drum.
export async function nextSpotId(area: AreaId, type: SpotType): Promise<string> {
  const prefix = PREFIX[area] + TYPE_LETTER[type];
  const spots = await getAll<{ id: string }>('spots');
  // Lowest free number, so a deleted and re-added spot gets its physical tag back.
  const used = new Set(spots.filter((s) => s.id.startsWith(prefix + '-')).map((s) => Number(s.id.slice(prefix.length + 1))));
  let n = 1;
  while (used.has(n)) n++;
  return `${prefix}-${String(n).padStart(2, '0')}`;
}

// Gives a spot a new ID and moves everything tied to it, all in one transaction.
export async function renameSpot(oldId: string, spot: Spot): Promise<void> {
  const tx = (await db()).transaction(STORES, 'readwrite');
  const linked = ['plants', 'careRules', 'logs', 'problems', 'courses'] as const;
  const mention = new RegExp(`\\b${oldId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
  const swap = (ids: string[]) => ids.map((x) => (x === oldId ? spot.id : x));
  await tx.objectStore('spots').delete(oldId);
  await tx.objectStore('spots').put(spot);
  for (const s of linked) {
    for (const item of await tx.objectStore(s).getAll()) {
      if (item.spotId === oldId) await tx.objectStore(s).put({ ...item, spotId: spot.id });
    }
  }
  for (const p of (await tx.objectStore('plans').getAll()) as PlanTask[]) {
    if (!p.spotIds.includes(oldId)) continue;
    // Prep task titles name the spot, e.g. "Start Tomato seedlings (for T-03)".
    const title = p.source === 'prep' ? p.title.replace(mention, spot.id) : p.title;
    await tx.objectStore('plans').put({ ...p, title, spotIds: swap(p.spotIds), doneSpotIds: swap(p.doneSpotIds) });
  }
  await tx.done;
}

export async function requestPersistence(): Promise<boolean> {
  return (await navigator.storage?.persist?.()) ?? false;
}
