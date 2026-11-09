import { beforeEach, test, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import { openDB } from 'idb';
import { CropPicker } from '../../src/ui/CropPicker';
import { SettingsScreen } from '../../src/ui/SettingsScreen';
import { loadState } from '../../src/ui/useGarden';
import { getAll, put, openGardenDb, useDb } from '../../src/db/db';
import { cropById, setCustomCrops, type Crop } from '../../src/data/crops';
import { suggestCrops } from '../../src/domain/seasonPlanner';
import { parseBackup } from '../../src/domain/backup';
import { cropName } from '../../src/ui/labels';
import { freshDb, spot } from './helpers';

const T = '2026-11-04';
const mint: Crop = { id: 'custom-mint', name: 'Mint', kind: 'leafy', seasons: ['winter'], method: 'sapling', daysToHarvest: 40, minSize: 'small' };

beforeEach(freshDb);

test('searching for an unknown crop offers to add it, and the new crop is saved and selected', async () => {
  const onChange = vi.fn();
  render(<CropPicker selected={[]} onChange={onChange} />);
  fireEvent.input(screen.getByPlaceholderText(/search crops/i), { target: { value: 'mint' } });
  fireEvent.click(screen.getByText('+ Add "mint"'));
  expect((screen.getByLabelText('Crop name') as HTMLInputElement).value).toBe('Mint');
  fireEvent.click(screen.getByText('Leafy'));
  fireEvent.click(screen.getByText('Buy a sapling'));
  fireEvent.input(screen.getByLabelText('Days to first harvest'), { target: { value: '40' } });
  fireEvent.click(screen.getByText('Add crop'));
  await waitFor(() => expect(onChange).toHaveBeenCalled());
  const [saved] = await getAll<Crop>('crops');
  expect(saved).toMatchObject({ name: 'Mint', kind: 'leafy', method: 'sapling', daysToHarvest: 40, seasons: ['winter'] });
  expect(saved.id.startsWith('custom-')).toBe(true);
  expect(onChange).toHaveBeenCalledWith([saved.id]);
  expect(cropName(saved.id)).toBe('Mint');
});

test('no add option when the name already exists', () => {
  render(<CropPicker selected={[]} onChange={() => {}} />);
  fireEvent.input(screen.getByPlaceholderText(/search crops/i), { target: { value: 'Tomato' } });
  expect(screen.queryByText(/\+ Add/)).toBeNull();
});

test('custom crops load with state and the season planner suggests them', async () => {
  await put('crops', mint);
  setCustomCrops([]);
  const s = await loadState(T);
  expect(s.crops).toEqual([mint]);
  expect(cropById('custom-mint')?.name).toBe('Mint');
  expect(suggestCrops(spot('B-01', { area: 'balconyB', size: 'small' }), T).map((c) => c.id)).toContain('custom-mint');
});

test('an unused custom crop can be removed in settings; one in use cannot', async () => {
  await put('crops', mint);
  await put('crops', { ...mint, id: 'custom-basil', name: 'Basil' });
  await put('plants', { id: 'p1', spotId: 'T-01', cropId: 'custom-basil', kind: 'leafy', plantedOn: T });
  const reload = vi.fn();
  render(<SettingsScreen state={await loadState(T)} reload={reload} />);
  expect(screen.queryByLabelText('Remove Basil')).toBeNull();
  fireEvent.click(screen.getByLabelText('Remove Mint'));
  await waitFor(() => expect(reload).toHaveBeenCalled());
  expect((await getAll<Crop>('crops')).map((c) => c.id)).toEqual(['custom-basil']);
});

test('backups made before custom crops still import', () => {
  const old = { app: 'garden-app', version: 1, exportedOn: T, settings: {}, data: { spots: [], plants: [], careRules: [], logs: [], plans: [], problems: [], courses: [], seeds: [] } };
  expect(parseBackup(JSON.stringify(old)).data.crops).toEqual([]);
});

test('an existing v1 database gains the crops store and keeps its data', async () => {
  const name = 'old-' + Math.random();
  const v1 = await openDB(name, 1, { upgrade(db) { db.createObjectStore('spots', { keyPath: 'id' }); db.createObjectStore('meta'); } });
  await v1.put('spots', spot('T-01'));
  v1.close();
  useDb(await openGardenDb(name));
  expect(await getAll('spots')).toEqual([spot('T-01')]);
  await put('crops', mint);
  expect(await getAll('crops')).toEqual([mint]);
});
