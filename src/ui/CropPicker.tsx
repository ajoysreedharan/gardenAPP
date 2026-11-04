import { useState } from 'preact/hooks';
import { CROPS } from '../data/crops';
import { Chip } from './parts';

export function CropPicker(p: { selected: string[]; onChange: (ids: string[]) => void; max?: number }) {
  const [q, setQ] = useState('');
  const max = p.max ?? 2;
  const term = q.trim().toLowerCase();
  const list = CROPS.filter((c) => p.selected.includes(c.id) || (term && c.name.toLowerCase().includes(term)));
  const shown = term ? list : CROPS.filter((c) => p.selected.includes(c.id));
  return (
    <>
      <input class="input small" placeholder="Search crops, e.g. tomato" value={q} onInput={(e) => setQ(e.currentTarget.value)} />
      <div class="chips">
        {(shown.length ? shown : term ? [] : CROPS.slice(0, 8)).map((c) => (
          <Chip key={c.id} on={p.selected.includes(c.id)} onClick={() => {
            if (p.selected.includes(c.id)) p.onChange(p.selected.filter((x) => x !== c.id));
            else if (p.selected.length < max) p.onChange([...p.selected, c.id]);
          }}>{c.name}</Chip>
        ))}
        {term && list.length === 0 && <span class="muted">No match</span>}
      </div>
    </>
  );
}
