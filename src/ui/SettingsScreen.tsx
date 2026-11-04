import { useState } from 'preact/hooks';
import type { ScreenProps } from './useGarden';
import type { Durations, Settings } from '../domain/types';
import { backupFileName, exportBackup, importBackup, parseBackup } from '../domain/backup';
import { formatShort } from '../domain/dates';
import { saveSettings } from '../db/db';
import { Group } from './parts';

const DURATION_FIELDS: { label: string; get: (d: Durations) => number; set: (d: Durations, v: number) => Durations }[] = [
  { label: 'Fertilize a pot', get: (d) => d.fertilize.pot, set: (d, v) => ({ ...d, fertilize: { ...d.fertilize, pot: v } }) },
  { label: 'Fertilize a bed', get: (d) => d.fertilize.bed, set: (d, v) => ({ ...d, fertilize: { ...d.fertilize, bed: v } }) },
  { label: 'Change soil in a pot', get: (d) => d.soil.pot, set: (d, v) => ({ ...d, soil: { ...d.soil, pot: v } }) },
  { label: 'Change soil in a bed', get: (d) => d.soil.bed, set: (d, v) => ({ ...d, soil: { ...d.soil, bed: v } }) },
  { label: 'Spray one spot', get: (d) => d.spray, set: (d, v) => ({ ...d, spray: v }) },
  { label: 'Till one pot', get: (d) => d.till, set: (d, v) => ({ ...d, till: v }) },
  { label: 'A planned task', get: (d) => d.plan, set: (d, v) => ({ ...d, plan: v }) },
];

function readFile(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(r.error);
    r.readAsText(f);
  });
}

export function SettingsScreen({ state: s, reload }: ScreenProps) {
  const [settings, setSettings] = useState<Settings>(s.settings);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState<string | null>(null);

  async function update(next: Settings) {
    setSettings(next);
    await saveSettings(next);
    await reload();
  }

  const num = (v: string, fallback: number) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };

  async function backup() {
    const blob = await exportBackup(s.today);
    if (typeof URL.createObjectURL === 'function') {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = backupFileName(s.today);
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
    setMessage(`Saved ${backupFileName(s.today)} to your Downloads.`);
    await reload();
  }

  async function pickFile(f: File | undefined) {
    setError('');
    setMessage('');
    if (!f) return;
    const text = await readFile(f);
    try {
      parseBackup(text);
      setPending(text);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function restore() {
    if (!pending) return;
    try {
      await importBackup(pending);
      setMessage('Backup restored.');
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
    setPending(null);
  }

  return (
    <div>
      <Group title="Saturday">
        <label class="field">Saturday time (minutes)
          <input class="input small" type="number" min="15" step="15" aria-label="Saturday time (minutes)" value={settings.budgetMin}
            onChange={(e) => update({ ...settings, budgetMin: num(e.currentTarget.value, settings.budgetMin) })} />
        </label>
      </Group>

      <Group title="How long things take (minutes)">
        {DURATION_FIELDS.map((f) => (
          <label class="field" key={f.label}>{f.label}
            <input class="input small" type="number" min="1" aria-label={f.label} value={f.get(settings.durations)}
              onChange={(e) => update({ ...settings, durations: f.set(settings.durations, num(e.currentTarget.value, f.get(settings.durations))) })} />
          </label>
        ))}
      </Group>

      <Group title="Backup">
        <p class="sub">Your garden data lives only on this phone. Back up about once a month and keep the file somewhere safe, such as Google Drive.</p>
        <p class="sub">Last backup: {s.settings.lastBackupOn ? formatShort(s.settings.lastBackupOn) : 'never'}</p>
        <div class="actions">
          <button type="button" class="btn" onClick={backup}>Back up now</button>
        </div>
        <label class="field">Restore from backup
          <input type="file" accept="application/json,.json" aria-label="Restore from backup" onChange={(e) => pickFile(e.currentTarget.files?.[0])} />
        </label>
        {pending && (
          <div class="banner">
            <span class="row-text">Replace everything on this phone with this backup?</span>
            <button type="button" class="btn ghost small" onClick={() => setPending(null)}>Cancel</button>
            <button type="button" class="btn danger small" onClick={restore}>Replace</button>
          </div>
        )}
        {message && <p class="sub">{message}</p>}
        {error && <p class="error">{error}</p>}
      </Group>
    </div>
  );
}
