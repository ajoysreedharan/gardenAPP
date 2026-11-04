import { useState } from 'preact/hooks';
import { useGarden } from './useGarden';
import { QuickAdd, type QuickAddPrefill } from './QuickAdd';
import { TodayScreen } from './TodayScreen';
import { SaturdayScreen } from './SaturdayScreen';
import { SpotsScreen } from './SpotsScreen';
import { SeasonScreen } from './SeasonScreen';
import { SettingsScreen } from './SettingsScreen';
import { needsBackupNudge } from '../domain/backup';
import { formatShort } from '../domain/dates';
import './styles.css';

type Tab = 'today' | 'saturday' | 'spots' | 'season' | 'settings';
const TABS: { id: Tab; label: string }[] = [
  { id: 'today', label: 'Today' }, { id: 'saturday', label: 'Saturday' }, { id: 'spots', label: 'Spots' }, { id: 'season', label: 'Season' },
];

export function App() {
  const { state, reload } = useGarden();
  const [tab, setTab] = useState<Tab>('today');
  const [adding, setAdding] = useState<QuickAddPrefill | null>(null);
  const [nudgeHidden, setNudgeHidden] = useState(false);

  const hasData = !!state && (state.spots.length > 0 || state.logs.length > 0 || state.plans.length > 0);
  const nudge = state && !nudgeHidden && needsBackupNudge(state.settings, state.today, hasData) && (
    <div class="banner">
      <span class="row-text">It's been a while since your last backup.</span>
      <button type="button" class="btn small" onClick={() => setTab('settings')}>Back up now</button>
      <button type="button" class="icon" aria-label="Dismiss" onClick={() => setNudgeHidden(true)}>×</button>
    </div>
  );

  const title = !state ? 'Garden' : tab === 'today' ? `Today · ${formatShort(state.today)}` : tab === 'saturday' ? 'Saturday' : tab === 'spots' ? 'Spots' : tab === 'season' ? 'Season' : 'Settings';

  return (
    <div class="app">
      <header class="top">
        <h1>{title}</h1>
        <button type="button" class="icon" aria-label="Settings" onClick={() => setTab('settings')}>⚙</button>
      </header>
      <main class="screen">
        {!state && <p class="muted center">Loading…</p>}
        {state && tab === 'today' && <TodayScreen state={state} reload={reload} banner={nudge} />}
        {state && tab === 'saturday' && <SaturdayScreen state={state} reload={reload} />}
        {state && tab === 'spots' && <SpotsScreen state={state} reload={reload} onLog={(id) => setAdding({ kind: 'done', spotIds: [id] })} />}
        {state && tab === 'season' && <SeasonScreen state={state} reload={reload} />}
        {state && tab === 'settings' && <SettingsScreen state={state} reload={reload} />}
      </main>
      {state && adding && (
        <div class="overlay" role="dialog" aria-label="Add">
          <QuickAdd state={state} prefill={adding} onCancel={() => setAdding(null)} onDone={async () => { setAdding(null); await reload(); }} />
        </div>
      )}
      <button type="button" class="fab" aria-label="Add" onClick={() => setAdding({})}>+</button>
      <nav class="tabs">
        {TABS.map((t) => (
          <button type="button" key={t.id} class={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </nav>
    </div>
  );
}
