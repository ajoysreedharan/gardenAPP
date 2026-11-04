import type { ISODate, Settings } from './types';
import { getAll, getSettings, replaceAll, saveSettings, STORES, type StoreName } from '../db/db';
import { daysBetween } from './dates';

export interface BackupFile { app: 'garden-app'; version: 1; exportedOn: ISODate; settings: Settings; data: Record<StoreName, unknown[]> }

const NUDGE_DAYS = 30;

async function blobToDataUrl(b: Blob): Promise<string> {
  const bytes = new Uint8Array(await b.arrayBuffer());
  let bin = '';
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return `data:${b.type || 'application/octet-stream'};base64,${btoa(bin)}`;
}

function dataUrlToBlob(url: string): Blob {
  const [head, b64] = url.split(',');
  const type = head.slice(5, head.indexOf(';'));
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

export function backupFileName(today: ISODate): string {
  return `garden-backup-${today}.json`;
}

export async function exportBackup(today: ISODate): Promise<Blob> {
  const data = {} as Record<StoreName, unknown[]>;
  for (const s of STORES) data[s] = await getAll(s);
  // Problem photos are Blobs, which JSON can't hold.
  data.problems = await Promise.all(
    (data.problems as { photo?: Blob }[]).map(async (p) => (p.photo instanceof Blob ? { ...p, photo: await blobToDataUrl(p.photo) } : p)),
  );
  const settings = { ...(await getSettings()), lastBackupOn: today };
  await saveSettings(settings);
  const file: BackupFile = { app: 'garden-app', version: 1, exportedOn: today, settings, data };
  return new Blob([JSON.stringify(file)], { type: 'application/json' });
}

export function parseBackup(text: string): BackupFile {
  const bad = new Error('Not a garden backup file');
  let f: Partial<BackupFile>;
  try {
    f = JSON.parse(text);
  } catch {
    throw bad;
  }
  if (!f || f.app !== 'garden-app' || f.version !== 1 || typeof f.settings !== 'object' || typeof f.data !== 'object') throw bad;
  for (const s of STORES) if (!Array.isArray(f.data?.[s])) throw bad;
  return f as BackupFile;
}

export async function importBackup(text: string): Promise<void> {
  const f = parseBackup(text);
  const data = { ...f.data };
  data.problems = (data.problems as { photo?: unknown }[]).map((p) =>
    typeof p.photo === 'string' ? { ...p, photo: dataUrlToBlob(p.photo) } : p,
  );
  await replaceAll(data, f.settings);
}

export function needsBackupNudge(s: Settings, today: ISODate, hasData = true): boolean {
  if (!s.lastBackupOn) return hasData;
  return daysBetween(s.lastBackupOn, today) >= NUDGE_DAYS;
}
