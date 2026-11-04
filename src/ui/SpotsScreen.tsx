import { useEffect, useState } from 'preact/hooks';
import type { AreaId, LogEntry, Plant, PlantKind, Spot, SpotSize, SpotType } from '../domain/types';
import type { ScreenProps } from './useGarden';
import { cropById } from '../data/crops';
import { careDueFor, defaultCareRules, type LastDoneAnswer } from '../domain/care';
import { addDays, formatShort, newId } from '../domain/dates';
import { nextSpotId, put, putMany, remove, type StoreName } from '../db/db';
import { Chip, Group } from './parts';
import { CropPicker } from './CropPicker';
import { AREA_LABEL, LOG_LABEL, SIZE_LABEL, TYPE_LABEL, cropName, dueTag } from './labels';

const AREAS: AreaId[] = ['terrace', 'balconyA', 'balconyB'];
const ANSWERS: { a: LastDoneAnswer; label: string }[] = [
  { a: 'thisWeek', label: 'This week' }, { a: 'twoWeeks', label: '~2 weeks' }, { a: 'monthPlus', label: 'A month or more' }, { a: 'unknown', label: "Don't know" },
];
const LAST_AREA_KEY = 'garden.lastArea';

function readLastArea(): AreaId {
  try {
    const v = localStorage.getItem(LAST_AREA_KEY);
    if (v === 'terrace' || v === 'balconyA' || v === 'balconyB') return v;
  } catch { /* storage unavailable */ }
  return 'terrace';
}

function kindFor(area: AreaId, cropIds: string[]): PlantKind {
  const first = cropIds.map(cropById).find(Boolean);
  if (first) return first.kind;
  return area === 'balconyA' ? 'flowering' : area === 'balconyB' ? 'leafy' : 'fruitveg';
}

function AddSpot({ state: s, reload, onClose }: ScreenProps & { onClose: () => void }) {
  const [area, setArea] = useState<AreaId>(readLastArea);
  const [type, setType] = useState<SpotType>('pot');
  const [size, setSize] = useState<SpotSize>('medium');
  const [crops, setCrops] = useState<string[]>([]);
  const [plantedOn, setPlantedOn] = useState(s.today);
  const [fert, setFert] = useState<LastDoneAnswer>('unknown');
  const [soil, setSoil] = useState<LastDoneAnswer>('unknown');
  const [nextId, setNextId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { nextSpotId(area).then(setNextId); }, [area]);

  async function save(another: boolean) {
    if (saving) return;
    setSaving(true);
    const id = await nextSpotId(area);
    const spot: Spot = { id, area, type, size, createdAt: s.today };
    const writes: [StoreName, { id: string }][] = [['spots', spot]];
    for (const cropId of crops) {
      const plant: Plant = { id: newId(), spotId: id, cropId, kind: cropById(cropId)!.kind, plantedOn };
      const log: LogEntry = { id: newId(), date: plantedOn, kind: 'plant', spotId: id, text: cropName(cropId) };
      writes.push(['plants', plant], ['logs', log]);
    }
    for (const r of defaultCareRules(spot, kindFor(area, crops), { fertilize: fert, soil }, s.today, s.spots.length)) writes.push(['careRules', r]);
    await putMany(writes);
    try { localStorage.setItem(LAST_AREA_KEY, area); } catch { /* storage unavailable */ }
    await reload();
    setSaving(false);
    if (another) {
      setCrops([]);
      setFert('unknown');
      setSoil('unknown');
      setNextId(await nextSpotId(area));
    } else {
      onClose();
    }
  }

  return (
    <div>
      <p class="sub">Adding {nextId || '…'}</p>
      <Group title="Where">
        <div class="chips">{AREAS.map((a) => <Chip key={a} on={area === a} onClick={() => setArea(a)}>{AREA_LABEL[a]}</Chip>)}</div>
      </Group>
      <Group title="Pot or bed, and size">
        <div class="chips">{(['pot', 'bed'] as const).map((t) => <Chip key={t} on={type === t} onClick={() => setType(t)}>{TYPE_LABEL[t]}</Chip>)}</div>
        <div class="chips">{(['small', 'medium', 'large'] as const).map((z) => <Chip key={z} on={size === z} onClick={() => setSize(z)}>{SIZE_LABEL[z]}</Chip>)}</div>
      </Group>
      <Group title="What's growing (up to 2, or leave empty)">
        <CropPicker selected={crops} onChange={setCrops} />
        {crops.length > 0 && (
          <label class="field">Planted on <input class="input small" type="date" value={plantedOn} max={s.today} onInput={(e) => setPlantedOn(e.currentTarget.value)} /></label>
        )}
      </Group>
      <Group title="Last fertilized (optional)">
        <div class="chips">{ANSWERS.map((x) => <Chip key={x.a} on={fert === x.a} onClick={() => setFert(x.a)} label={`Fertilized ${x.label}`}>{x.label}</Chip>)}</div>
      </Group>
      <Group title="Last soil change (optional)">
        <div class="chips">{ANSWERS.map((x) => <Chip key={x.a} on={soil === x.a} onClick={() => setSoil(x.a)} label={`Soil ${x.label}`}>{x.label}</Chip>)}</div>
      </Group>
      <div class="actions">
        <button type="button" class="btn ghost" onClick={onClose}>Cancel</button>
        <button type="button" class="btn ghost" onClick={() => save(true)}>Save & add another</button>
        <button type="button" class="btn" onClick={() => save(false)}>Save</button>
      </div>
    </div>
  );
}

function SpotDetail({ state: s, reload, id, onClose, onLog }: ScreenProps & { id: string; onClose: () => void; onLog?: (spotId: string) => void }) {
  const [addingPlant, setAddingPlant] = useState<string[] | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const spot = s.spots.find((x) => x.id === id);
  if (!spot) return <p class="muted center">Spot not found. <button type="button" class="btn ghost small" onClick={onClose}>Back</button></p>;

  const plants = s.plants.filter((p) => p.spotId === id);
  const active = plants.filter((p) => !p.endedOn);
  const rules = s.careRules.filter((r) => r.spotId === id);
  const history = s.logs.filter((l) => l.spotId === id).sort((a, b) => b.date.localeCompare(a.date));

  async function finish(p: Plant) {
    await put('plants', { ...p, endedOn: s.today });
    await put('logs', { id: newId(), date: s.today, kind: 'crop_end', spotId: id, text: cropName(p.cropId) });
    await reload();
  }

  async function savePlant(cropIds: string[]) {
    for (const cropId of cropIds) {
      await put('plants', { id: newId(), spotId: id, cropId, kind: cropById(cropId)!.kind, plantedOn: s.today });
      await put('logs', { id: newId(), date: s.today, kind: 'plant', spotId: id, text: cropName(cropId) });
    }
    setAddingPlant(null);
    await reload();
  }

  async function del() {
    await remove('spots', id);
    for (const p of plants) await remove('plants', p.id);
    for (const r of rules) await remove('careRules', r.id);
    await reload();
    onClose();
  }

  return (
    <div>
      <button type="button" class="btn ghost small" onClick={onClose}>‹ All spots</button>
      <h2>{spot.id} · {TYPE_LABEL[spot.type]} ({SIZE_LABEL[spot.size].toLowerCase()})</h2>
      <p class="sub">{AREA_LABEL[spot.area]}{active.length > 0 && ` · ${active.map((p) => cropName(p.cropId)).join(' + ')}`}</p>

      <Group title="Next due">
        {rules.map((r) => {
          const due = careDueFor(r, s.logs, s.plants, s.today);
          const label = r.type === 'fertilize' ? 'Fertilizer' : 'Soil change';
          if (!due) return <div class="row" key={r.id}><span class="row-text">{label}</span><span class="tag amb">after this crop</span></div>;
          const t = dueTag(due.daysOverdue);
          return <div class="row" key={r.id}><span class="row-text">{label} · {formatShort(due.due)}</span><span class={'tag ' + t.cls}>{t.text}</span></div>;
        })}
        {active.map((p) => {
          const days = cropById(p.cropId)?.daysToHarvest;
          return days ? (
            <div class="row" key={p.id}><span class="row-text">{cropName(p.cropId)}: harvest from</span><span class="tag">~{formatShort(addDays(p.plantedOn, days))}</span></div>
          ) : null;
        })}
      </Group>

      <div class="actions">
        {onLog && <button type="button" class="btn" onClick={() => onLog(id)}>Log something</button>}
        <button type="button" class="btn ghost" onClick={() => setAddingPlant([])}>Add plant</button>
      </div>
      {addingPlant && (
        <Group title="Add plant">
          <CropPicker selected={addingPlant} onChange={setAddingPlant} />
          <div class="actions">
            <button type="button" class="btn ghost" onClick={() => setAddingPlant(null)}>Cancel</button>
            <button type="button" class="btn" disabled={addingPlant.length === 0} onClick={() => savePlant(addingPlant)}>Save plant</button>
          </div>
        </Group>
      )}
      {active.length > 0 && (
        <Group title="Crop over?">
          {active.map((p) => (
            <div class="row" key={p.id}>
              <button type="button" class="btn ghost small" onClick={() => finish(p)}>Crop finished: {cropName(p.cropId)}</button>
            </div>
          ))}
        </Group>
      )}

      <Group title="History">
        {history.length === 0 && <div class="row"><span class="row-text muted">Nothing logged yet</span></div>}
        {history.map((l) => (
          <div class="row" key={l.id}><span class="row-text">{formatShort(l.date)} · {LOG_LABEL[l.kind]}{l.text && ` ${l.text}`}</span></div>
        ))}
      </Group>

      <div class="actions">
        {!confirmDelete && <button type="button" class="btn ghost small" onClick={() => setConfirmDelete(true)}>Delete spot</button>}
        {confirmDelete && (
          <>
            <span class="muted">Delete {spot.id} and its plants? History stays.</span>
            <button type="button" class="btn ghost small" onClick={() => setConfirmDelete(false)}>Keep</button>
            <button type="button" class="btn danger small" onClick={del}>Delete</button>
          </>
        )}
      </div>
    </div>
  );
}

export function SpotsScreen(props: ScreenProps & { onLog?: (spotId: string) => void }) {
  const { state: s } = props;
  const [view, setView] = useState<'list' | 'add' | string>('list');

  if (view === 'add') return <AddSpot {...props} onClose={() => setView('list')} />;
  if (view !== 'list') return <SpotDetail {...props} id={view} onClose={() => setView('list')} />;

  function soonest(id: string) {
    const dues = s.careRules.filter((r) => r.spotId === id).map((r) => careDueFor(r, s.logs, s.plants, s.today)).filter((d) => d !== null);
    dues.sort((a, b) => a.due.localeCompare(b.due));
    return dues[0];
  }

  return (
    <div>
      <div class="actions"><button type="button" class="btn" onClick={() => setView('add')}>+ Add spot</button></div>
      {s.spots.length === 0 && <p class="muted center">No spots yet. Tag each pot (T-01, T-02…) and add it here.</p>}
      {AREAS.map((a) => {
        const list = s.spots.filter((x) => x.area === a);
        if (list.length === 0) return null;
        return (
          <Group key={a} title={`${AREA_LABEL[a]} (${list.length})`}>
            {list.map((sp) => {
              const names = s.plants.filter((p) => p.spotId === sp.id && !p.endedOn).map((p) => cropName(p.cropId)).join(' + ') || 'empty';
              const d = soonest(sp.id);
              const t = d && dueTag(d.daysOverdue);
              return (
                <div class="row link" key={sp.id} onClick={() => setView(sp.id)}>
                  <span class="row-text"><strong>{sp.id}</strong> · {names}</span>
                  {d && t && <span class={'tag ' + t.cls}>{d.type === 'fertilize' ? 'Fert' : 'Soil'} {t.text}</span>}
                </div>
              );
            })}
          </Group>
        );
      })}
    </div>
  );
}
