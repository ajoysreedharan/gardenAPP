import { useState } from 'preact/hooks';
import type { ScreenProps } from './useGarden';
import type { Durations, Settings } from '../domain/types';
import { backupFileName, exportBackup, importBackup, parseBackup } from '../domain/backup';
import { formatShort } from '../domain/dates';
import { getSettings, remove, saveSettings } from '../db/db';
import { SIZE_LABEL } from './labels';
import { Group } from './parts';

const DURATION_FIELDS: { label: string; get: (d: Durations) => number; set: (d: Durations, v: number) => Durations }[] = [
  { label: 'Fertilize a pot', get: (d) => d.fertilize.pot, set: (d, v) => ({ ...d, fertilize: { ...d.fertilize, pot: v } }) },
  { label: 'Fertilize a drum', get: (d) => d.fertilize.drum, set: (d, v) => ({ ...d, fertilize: { ...d.fertilize, drum: v } }) },
  { label: 'Fertilize a bed', get: (d) => d.fertilize.bed, set: (d, v) => ({ ...d, fertilize: { ...d.fertilize, bed: v } }) },
  { label: 'Change soil in a pot', get: (d) => d.soil.pot, set: (d, v) => ({ ...d, soil: { ...d.soil, pot: v } }) },
  { label: 'Change soil in a drum', get: (d) => d.soil.drum, set: (d, v) => ({ ...d, soil: { ...d.soil, drum: v } }) },
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
  const settings = s.settings;
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState<string | null>(null);

  // Re-read before writing so a backup date or restored settings are never overwritten by a stale copy.
  async function update(change: (cur: Settings) => Settings) {
    await saveSettings(change(await getSettings()));
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

  // Plants and seeds look up a crop's name and harvest time, so only unused crops can go.
  const inUse = (id: string) => s.plants.some((p) => p.cropId === id) || s.seeds.some((x) => x.cropId === id);

  async function removeCrop(id: string) {
    await remove('crops', id);
    await reload();
  }

  return (
    <div>
      <Group title="My crops">
        {s.crops.length === 0 && <div class="row"><span class="row-text muted">None yet. Search for a crop when adding a plant, then tap + Add.</span></div>}
        {s.crops.map((c) => (
          <div class="row" key={c.id}>
            <span class="row-text">{c.name} · {c.daysToHarvest} days · {SIZE_LABEL[c.minSize].toLowerCase()} pot or bigger</span>
            {inUse(c.id)
              ? <span class="tag">in use</span>
              : <button type="button" class="btn ghost small" aria-label={`Remove ${c.name}`} onClick={() => removeCrop(c.id)}>Remove</button>}
          </div>
        ))}
      </Group>

      <Group title="Saturday">
        <label class="field">Saturday time (minutes)
          <input class="input small" type="number" min="15" step="15" aria-label="Saturday time (minutes)" value={settings.budgetMin}
            onChange={(e) => { const v = e.currentTarget.value; update((cur) => ({ ...cur, budgetMin: num(v, cur.budgetMin) })); }} />
        </label>
      </Group>

      <Group title="How long things take (minutes)">
        {DURATION_FIELDS.map((f) => (
          <label class="field" key={f.label}>{f.label}
            <input class="input small" type="number" min="1" aria-label={f.label} value={f.get(settings.durations)}
              onChange={(e) => { const v = e.currentTarget.value; update((cur) => ({ ...cur, durations: f.set(cur.durations, num(v, f.get(cur.durations))) })); }} />
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
