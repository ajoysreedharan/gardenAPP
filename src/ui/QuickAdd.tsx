import { useState } from 'preact/hooks';
import type { LogKind, PlanTask, Problem } from '../domain/types';
import type { GardenState } from './useGarden';
import { put } from '../db/db';
import { newId, upcomingSaturday } from '../domain/dates';
import { startCourse } from '../domain/spray';
import { Chip } from './parts';

type Kind = 'plan' | 'problem' | 'done';
type When = 'saturday' | 'today' | 'date';

export interface QuickAddPrefill { kind?: Kind; spotIds?: string[] }

const DONE_KINDS: { kind: LogKind; label: string }[] = [
  { kind: 'fertilize', label: 'Fertilized' }, { kind: 'soil', label: 'Soil changed' }, { kind: 'spray', label: 'Sprayed' },
  { kind: 'till', label: 'Tilled' }, { kind: 'prune', label: 'Pruned' }, { kind: 'harvest', label: 'Harvested' }, { kind: 'note', label: 'Note' },
];

function recentSpotIds(s: GardenState): string[] {
  const seen: string[] = [];
  const events = [
    ...s.logs.map((l) => ({ at: l.date, ids: l.spotId ? [l.spotId] : [] })),
    ...s.plans.map((p) => ({ at: p.createdAt, ids: p.spotIds })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  for (const e of events) for (const id of e.ids) if (!seen.includes(id)) seen.push(id);
  return seen;
}

export function QuickAdd(p: { state: GardenState; onDone: () => void; onCancel?: () => void; prefill?: QuickAddPrefill }) {
  const s = p.state;
  const [text, setText] = useState('');
  const [kind, setKind] = useState<Kind>(p.prefill?.kind ?? 'plan');
  const [spotIds, setSpotIds] = useState<string[]>(p.prefill?.spotIds ?? []);
  const [find, setFind] = useState('');
  const [place, setPlace] = useState('');
  const [when, setWhen] = useState<When>('saturday');
  const [date, setDate] = useState(s.today);
  const [doneKind, setDoneKind] = useState<LogKind>('fertilize');
  const [startSpray, setStartSpray] = useState(true);
  const [photo, setPhoto] = useState<Blob | undefined>();
  const [error, setError] = useState('');

  const recent = recentSpotIds(s);
  const ordered = [...s.spots].sort((a, b) => {
    const ra = recent.indexOf(a.id), rb = recent.indexOf(b.id);
    return (ra < 0 ? 1e9 : ra) - (rb < 0 ? 1e9 : rb) || a.id.localeCompare(b.id);
  });
  const q = find.trim().toUpperCase();
  const shown = ordered.filter((sp) => !q || sp.id.includes(q));

  function toggleSpot(id: string) {
    if (kind === 'problem') setSpotIds(spotIds[0] === id ? [] : [id]);
    else setSpotIds(spotIds.includes(id) ? spotIds.filter((x) => x !== id) : [...spotIds, id]);
  }

  function pickKind(k: Kind) {
    setKind(k);
    if (k === 'problem' && spotIds.length > 1) setSpotIds(spotIds.slice(0, 1));
    setError('');
  }

  async function save() {
    const title = text.trim();
    const due = when === 'saturday' ? upcomingSaturday(s.today) : when === 'today' ? s.today : date;
    if (kind === 'plan') {
      if (!title) return setError('Write what you plan to do');
      const plan: PlanTask = {
        id: newId(), title, due, spotIds, doneSpotIds: [], place: place.trim() || undefined,
        estMin: s.settings.durations.plan, createdAt: s.today, source: 'user',
      };
      await put('plans', plan);
    } else if (kind === 'problem') {
      if (spotIds.length !== 1) return setError('Pick the spot with the problem');
      const problem: Problem = { id: newId(), spotId: spotIds[0], text: title || 'Pests', seenOn: s.today, photo };
      await put('problems', problem);
      if (startSpray) await put('courses', startCourse(problem, s.today));
    } else {
      const targets = spotIds.length ? spotIds : [undefined];
      for (const spotId of targets) {
        await put('logs', { id: newId(), date: s.today, kind: doneKind, spotId, place: place.trim() || undefined, text: title || undefined });
      }
    }
    p.onDone();
  }

  return (
    <div class="sheet">
      <h2>Add</h2>
      <input class="input" placeholder="e.g. pluck guavas…" value={text} onInput={(e) => setText(e.currentTarget.value)} />

      <h3>What kind</h3>
      <div class="chips">
        <Chip on={kind === 'plan'} onClick={() => pickKind('plan')}>Plan</Chip>
        <Chip on={kind === 'problem'} onClick={() => pickKind('problem')}>Problem seen</Chip>
        <Chip on={kind === 'done'} onClick={() => pickKind('done')}>Done just now</Chip>
      </div>

      {kind === 'done' && (
        <div class="chips">
          {DONE_KINDS.map((d) => <Chip key={d.kind} on={doneKind === d.kind} onClick={() => setDoneKind(d.kind)}>{d.label}</Chip>)}
        </div>
      )}

      <h3>{kind === 'problem' ? 'Which spot' : 'Where (optional)'}</h3>
      {s.spots.length > 8 && (
        <input class="input small" placeholder="Find spot, e.g. T-1" value={find} onInput={(e) => setFind(e.currentTarget.value)} />
      )}
      <div class="chips scroll">
        {shown.map((sp) => <Chip key={sp.id} on={spotIds.includes(sp.id)} onClick={() => toggleSpot(sp.id)}>{sp.id}</Chip>)}
        {s.spots.length === 0 && <span class="muted">No spots yet. Add them under Spots.</span>}
      </div>
      {kind !== 'problem' && (
        <input class="input small" placeholder="or a place, e.g. corner by the tap" value={place} onInput={(e) => setPlace(e.currentTarget.value)} />
      )}

      {kind === 'problem' && (
        <>
          <label class="row">
            <input type="checkbox" checked={startSpray} onChange={() => setStartSpray(!startSpray)} />
            <span class="row-text">Start spray course (wood vinegar, 4 sprays, every 3 days)</span>
          </label>
          <label class="row">
            <span class="row-text">Photo (optional)</span>
            <input type="file" accept="image/*" capture="environment" onChange={(e) => setPhoto(e.currentTarget.files?.[0])} />
          </label>
        </>
      )}

      {kind === 'plan' && (
        <>
          <h3>When</h3>
          <div class="chips">
            <Chip on={when === 'saturday'} onClick={() => setWhen('saturday')}>This Saturday</Chip>
            <Chip on={when === 'today'} onClick={() => setWhen('today')}>Today</Chip>
            <Chip on={when === 'date'} onClick={() => setWhen('date')}>Pick date</Chip>
          </div>
          {when === 'date' && <input class="input small" type="date" value={date} min={s.today} onInput={(e) => setDate(e.currentTarget.value)} />}
        </>
      )}

      {error && <p class="error">{error}</p>}
      <div class="actions">
        {p.onCancel && <button type="button" class="btn ghost" onClick={p.onCancel}>Cancel</button>}
        <button type="button" class="btn" onClick={save}>Save</button>
      </div>
    </div>
  );
}
