import { useState } from 'preact/hooks';
import { useGarden } from './useGarden';
import { QuickAdd, type QuickAddPrefill } from './QuickAdd';
import { TodayScreen } from './TodayScreen';
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

  const title = tab === 'today' && state ? `Today · ${formatShort(state.today)}` : 'Garden';

  return (
    <div class="app">
      <header class="top">
        <h1>{title}</h1>
        <button type="button" class="icon" aria-label="Settings" onClick={() => setTab('settings')}>⚙</button>
      </header>
      <main class="screen">
        {!state && <p class="muted center">Loading…</p>}
        {state && tab === 'today' && <TodayScreen state={state} reload={reload} />}
        {state && tab !== 'today' && <p class="muted center">Coming soon</p>}
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
