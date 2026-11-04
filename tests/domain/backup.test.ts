import { beforeEach, test, expect } from 'vitest';
import { openGardenDb, useDb, put, getAll, getSettings, replaceAll, DEFAULT_SETTINGS, STORES } from '../../src/db/db';
import { exportBackup, importBackup, needsBackupNudge, backupFileName } from '../../src/domain/backup';
import type { LogEntry, Spot } from '../../src/domain/types';

const spot = (id: string): Spot => ({ id, area: 'terrace', type: 'pot', size: 'medium', createdAt: '2026-11-04' });
const log: LogEntry = { id: 'l1', date: '2026-11-01', kind: 'fertilize', spotId: 'T-01' };

// jsdom's Blob lacks .text(); FileReader works in both jsdom and browsers.
const readBlob = (b: Blob) => new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsText(b); });

beforeEach(async () => {
  useDb(await openGardenDb('test-' + Math.random()));
});

test('export then import restores the same data', async () => {
  await put('spots', spot('T-01'));
  await put('spots', spot('T-02'));
  await put('logs', log);
  const text = await readBlob(await exportBackup('2026-11-04'));
  expect((await getSettings()).lastBackupOn).toBe('2026-11-04');

  await replaceAll(Object.fromEntries(STORES.map((s) => [s, []])) as never, DEFAULT_SETTINGS);
  expect(await getAll('spots')).toEqual([]);

  await importBackup(text);
  expect(await getAll('spots')).toEqual([spot('T-01'), spot('T-02')]);
  expect(await getAll('logs')).toEqual([log]);
});

test('a file that is not a garden backup is rejected and nothing changes', async () => {
  await put('spots', spot('T-01'));
  await expect(importBackup('{"hello":1}')).rejects.toThrow('Not a garden backup file');
  await expect(importBackup('not json')).rejects.toThrow('Not a garden backup file');
  expect(await getAll('spots')).toEqual([spot('T-01')]);
});

test('backup nudge after 30 days', () => {
  expect(needsBackupNudge({ ...DEFAULT_SETTINGS, lastBackupOn: '2026-10-05' }, '2026-11-04')).toBe(true);
  expect(needsBackupNudge({ ...DEFAULT_SETTINGS, lastBackupOn: '2026-10-06' }, '2026-11-04')).toBe(false);
});

test('backup file name carries the date', () => {
  expect(backupFileName('2026-11-04')).toBe('garden-backup-2026-11-04.json');
});
