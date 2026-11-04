import { beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { SettingsScreen } from '../../src/ui/SettingsScreen';
import { App } from '../../src/ui/App';
import { loadState } from '../../src/ui/useGarden';
import { getAll, getSettings, put, saveSettings } from '../../src/db/db';
import { addDays, today } from '../../src/domain/dates';
import { freshDb, spot } from './helpers';

beforeEach(freshDb);

test('restoring a file that is not a backup shows an error and keeps data', async () => {
  await put('spots', spot('T-01'));
  render(<SettingsScreen state={await loadState('2026-11-04')} reload={async () => {}} />);
  const file = new File(['{"hello":1}'], 'x.json', { type: 'application/json' });
  fireEvent.change(screen.getByLabelText('Restore from backup'), { target: { files: [file] } });
  expect(await screen.findByText('Not a garden backup file')).toBeTruthy();
  expect(await getAll('spots')).toHaveLength(1);
});

test('changing the Saturday budget is saved', async () => {
  render(<SettingsScreen state={await loadState('2026-11-04')} reload={async () => {}} />);
  fireEvent.change(screen.getByLabelText('Saturday time (minutes)'), { target: { value: '90' } });
  await new Promise((r) => setTimeout(r, 20));
  expect((await getSettings()).budgetMin).toBe(90);
});

async function withLastBackup(daysAgo: number) {
  await put('spots', spot('T-01'));
  await saveSettings({ ...(await getSettings()), lastBackupOn: addDays(today(), -daysAgo) });
  render(<App />);
}

test('backup nudge shows after 31 days', async () => {
  await withLastBackup(31);
  expect(await screen.findByText(/since your last backup/)).toBeTruthy();
});

test('no backup nudge after 10 days', async () => {
  await withLastBackup(10);
  await screen.findByText(/Your quick daily check/);
  expect(screen.queryByText(/since your last backup/)).toBeNull();
});
