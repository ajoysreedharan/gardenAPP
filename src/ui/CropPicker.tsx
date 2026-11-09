import { useState } from 'preact/hooks';
import type { PlantKind, SpotSize } from '../domain/types';
import { addCustomCrop, allCrops, cropByName, type Crop, type SowMethod } from '../data/crops';
import { SEASON_LABEL, seasonOf, type Season } from '../domain/seasons';
import { newId, today } from '../domain/dates';
import { put } from '../db/db';
import { Chip } from './parts';
import { SIZE_LABEL } from './labels';

const KINDS: { k: PlantKind; label: string }[] = [{ k: 'fruitveg', label: 'Fruit / veg' }, { k: 'leafy', label: 'Leafy' }, { k: 'flowering', label: 'Flowering' }];
const METHODS: { m: SowMethod; label: string }[] = [{ m: 'transplant', label: 'Raise seedlings first' }, { m: 'direct', label: 'Sow directly' }, { m: 'sapling', label: 'Buy a sapling' }];
const SEASONS: Season[] = ['monsoon', 'winter', 'summer'];

function AddCrop(p: { name: string; onSaved: (c: Crop) => void; onCancel: () => void }) {
  const [name, setName] = useState(p.name.charAt(0).toUpperCase() + p.name.slice(1));
  const [kind, setKind] = useState<PlantKind>('fruitveg');
  const [seasons, setSeasons] = useState<Season[]>([seasonOf(today())]);
  const [method, setMethod] = useState<SowMethod>('direct');
  const [days, setDays] = useState('60');
  const [minSize, setMinSize] = useState<SpotSize>('medium');
  const [error, setError] = useState('');

  async function save() {
    const n = name.trim();
    const d = Math.round(Number(days));
    if (!n) return setError('Give the crop a name');
    if (cropByName(n)) return setError(`${n} is already in the list`);
    if (seasons.length === 0) return setError('Pick at least one season');
    if (!Number.isFinite(d) || d < 1) return setError('Days to harvest should be a number');
    const crop: Crop = { id: 'custom-' + newId(), name: n, kind, seasons, method, daysToHarvest: d, minSize };
    await put('crops', crop);
    addCustomCrop(crop);
    p.onSaved(crop);
  }

  return (
    <div class="group">
      <h3>New crop</h3>
      <input class="input small" aria-label="Crop name" value={name} onInput={(e) => setName(e.currentTarget.value)} />
      <h3>Type</h3>
      <div class="chips">{KINDS.map((x) => <Chip key={x.k} on={kind === x.k} onClick={() => setKind(x.k)}>{x.label}</Chip>)}</div>
      <h3>Seasons it grows in</h3>
      <div class="chips">
        {SEASONS.map((x) => (
          <Chip key={x} on={seasons.includes(x)} onClick={() => setSeasons(seasons.includes(x) ? seasons.filter((y) => y !== x) : [...seasons, x])}>{SEASON_LABEL[x]}</Chip>
        ))}
      </div>
      <h3>How you start it</h3>
      <div class="chips">{METHODS.map((x) => <Chip key={x.m} on={method === x.m} onClick={() => setMethod(x.m)}>{x.label}</Chip>)}</div>
      <h3>Smallest pot it fits</h3>
      <div class="chips">{(['small', 'medium', 'large'] as const).map((z) => <Chip key={z} on={minSize === z} onClick={() => setMinSize(z)}>{SIZE_LABEL[z]}</Chip>)}</div>
      <label class="field">Days to first harvest (rough)
        <input class="input small" type="number" min="1" aria-label="Days to first harvest" value={days} onInput={(e) => setDays(e.currentTarget.value)} />
      </label>
      {error && <p class="error">{error}</p>}
      <div class="actions">
        <button type="button" class="btn ghost small" onClick={p.onCancel}>Cancel</button>
        <button type="button" class="btn small" onClick={save}>Add crop</button>
      </div>
    </div>
  );
}

export function CropPicker(p: { selected: string[]; onChange: (ids: string[]) => void; max?: number }) {
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const max = p.max ?? 2;
  const term = q.trim().toLowerCase();
  const crops = allCrops();
  const list = crops.filter((c) => p.selected.includes(c.id) || (term && c.name.toLowerCase().includes(term)));
  const shown = term ? list : crops.filter((c) => p.selected.includes(c.id));

  function saved(c: Crop) {
    setAdding(false);
    setQ('');
    if (p.selected.length < max) p.onChange([...p.selected, c.id]);
  }

  return (
    <>
      <input class="input small" placeholder="Search crops, e.g. tomato" value={q} onInput={(e) => { setQ(e.currentTarget.value); setAdding(false); }} />
      <div class="chips">
        {(shown.length ? shown : term ? [] : crops.slice(0, 8)).map((c) => (
          <Chip key={c.id} on={p.selected.includes(c.id)} onClick={() => {
            if (p.selected.includes(c.id)) p.onChange(p.selected.filter((x) => x !== c.id));
            else if (p.selected.length < max) p.onChange([...p.selected, c.id]);
          }}>{c.name}</Chip>
        ))}
        {term && list.length === 0 && <span class="muted">No match</span>}
        {term && !adding && !cropByName(q) && <Chip onClick={() => setAdding(true)}>+ Add "{q.trim()}"</Chip>}
      </div>
      {adding && <AddCrop name={q.trim()} onSaved={saved} onCancel={() => setAdding(false)} />}
    </>
  );
}
