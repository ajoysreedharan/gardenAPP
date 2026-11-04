import { useState } from 'preact/hooks';
import type { ScreenProps } from './useGarden';
import type { Seed } from '../domain/types';
import { SEASON_LABEL, nextSeasonStart, seasonOf } from '../domain/seasons';
import { prepTaskFor, spotsFreeingUp, suggestCrops } from '../domain/seasonPlanner';
import { daysBetween, formatShort, newId } from '../domain/dates';
import { cropById } from '../data/crops';
import { put, remove } from '../db/db';
import { Chip, Group } from './parts';
import { CropPicker } from './CropPicker';
import { cropName } from './labels';

export function SeasonScreen({ state: s, reload }: ScreenProps) {
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [seedCrop, setSeedCrop] = useState<string[]>([]);
  const [seedForm, setSeedForm] = useState<Seed['form']>('seed');

  const now = seasonOf(s.today);
  const next = nextSeasonStart(s.today);
  const weeks = Math.round(daysBetween(s.today, next.start) / 7);
  const freeing = spotsFreeingUp(s.spots, s.plants, s.today);

  async function choose(spotId: string, freeOn: string) {
    const crop = cropById(picked[spotId]);
    const spot = s.spots.find((x) => x.id === spotId);
    if (!crop || !spot) return;
    await put('plans', prepTaskFor(crop, spot, freeOn, s.seeds, s.today));
    await reload();
  }

  async function addSeed() {
    if (seedCrop.length === 0) return;
    await put('seeds', { id: newId(), cropId: seedCrop[0], form: seedForm });
    setSeedCrop([]);
    await reload();
  }

  return (
    <div>
      <p class="sub">Now: {SEASON_LABEL[now]} · {SEASON_LABEL[next.season].split(' ')[0]} starts {formatShort(next.start)} ({weeks} weeks)</p>

      <Group title="Freeing up soon">
        {freeing.length === 0 && <div class="row"><span class="row-text muted">No spots freeing up in the next 8 weeks</span></div>}
        {freeing.map((f) => {
          const spot = s.spots.find((x) => x.id === f.spotId)!;
          const prep = s.plans.find((p) => p.source === 'prep' && !p.doneOn && p.spotIds.includes(f.spotId));
          return (
            <div class="free-row" key={f.spotId}>
              <div><strong>{f.spotId}</strong> · {f.harvestDue ? `harvest due ~${formatShort(f.harvestDue)} · free when pulled` : f.freeOn === s.today ? 'free now' : `free ${f.estimated ? '~' : ''}${formatShort(f.freeOn)}`}</div>
              {prep ? (
                <div class="muted">Planned: {prep.title} · {formatShort(prep.due)}</div>
              ) : (
                <>
                  <div class="chips">
                    {suggestCrops(spot, f.freeOn).slice(0, 8).map((c) => (
                      <Chip key={c.id} on={picked[f.spotId] === c.id} onClick={() => setPicked({ ...picked, [f.spotId]: c.id })}>{c.name}</Chip>
                    ))}
                  </div>
                  <button type="button" class="btn small" aria-label={`Choose for ${f.spotId}`} disabled={!picked[f.spotId]} onClick={() => choose(f.spotId, f.freeOn)}>Choose</button>
                </>
              )}
            </div>
          );
        })}
      </Group>

      <Group title="Seeds & saplings I have">
        {s.seeds.length === 0 && <div class="row"><span class="row-text muted">None listed</span></div>}
        {s.seeds.map((sd) => (
          <div class="row" key={sd.id}>
            <span class="row-text">{cropName(sd.cropId)} ({sd.form})</span>
            <button type="button" class="btn ghost small" onClick={async () => { await remove('seeds', sd.id); await reload(); }}>Remove</button>
          </div>
        ))}
        <CropPicker selected={seedCrop} onChange={setSeedCrop} max={1} />
        <div class="chips">
          <Chip on={seedForm === 'seed'} onClick={() => setSeedForm('seed')}>Seeds</Chip>
          <Chip on={seedForm === 'sapling'} onClick={() => setSeedForm('sapling')}>Sapling</Chip>
          <button type="button" class="btn small" disabled={seedCrop.length === 0} onClick={addSeed}>Add</button>
        </div>
      </Group>
    </div>
  );
}
