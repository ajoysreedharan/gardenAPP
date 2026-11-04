import { useState } from 'preact/hooks';
import type { ScreenProps } from './useGarden';
import { careDueNow } from './useGarden';
import { buildSaturdayPlan, formatMinutes, headerText, type PlanGroup, type PlanItem } from '../domain/saturday';
import { markSprayDone, spraysDue } from '../domain/spray';
import { formatShort, newId, upcomingSaturday } from '../domain/dates';
import { get, put } from '../db/db';
import type { PlanTask, SprayCourse } from '../domain/types';
import { Group, TickRow } from './parts';

const GROUP_TITLE: Record<PlanGroup, string> = { planned: 'You planned', overdue: 'Overdue', season: 'Get ready for the season' };

// Items keep a stable key in the UI even as their spot list shrinks after ticks.
const uiKey = (i: PlanItem) => (i.ref.kind === 'plan' ? `plan:${i.ref.id}` : i.ref.kind === 'care' ? `care:${i.ref.type}` : 'spray');

export function SaturdayScreen({ state: s, reload }: ScreenProps) {
  const plan = buildSaturdayPlan({
    plans: s.plans, careDue: careDueNow(s), sprays: spraysDue(s.courses, upcomingSaturday(s.today)),
    spots: s.spots, durations: s.settings.durations, budgetMin: s.settings.budgetMin, today: s.today,
  });

  // Snapshot what was on the list when the screen opened, so ticked rows stay visible (struck through).
  const [snapshot] = useState(() => plan.items);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Set<string>>(new Set());

  const known = new Set(snapshot.map(uiKey));
  const items = [...snapshot, ...plan.items.filter((i) => !known.has(uiKey(i)))];

  function isDone(item: PlanItem, spotId?: string): boolean {
    if (item.ref.kind === 'plan') {
      const id = item.ref.id;
      const p = s.plans.find((x) => x.id === id);
      if (!p) return true;
      return spotId ? p.doneSpotIds.includes(spotId) : !!p.doneOn;
    }
    return ticked.has(`${uiKey(item)}|${spotId ?? ''}`);
  }

  async function tick(item: PlanItem, spotId?: string) {
    if (isDone(item, spotId)) return;
    if (item.ref.kind === 'plan') {
      const id = item.ref.id;
      // Read the stored copy: quick taps can outrun the reload of props.
      const p = (await get<PlanTask>('plans', id))!;
      if (spotId && p.doneSpotIds.includes(spotId)) return;
      const doneSpotIds = spotId ? [...p.doneSpotIds, spotId] : p.spotIds;
      const allDone = !spotId || p.spotIds.every((x) => doneSpotIds.includes(x));
      await put('plans', { ...p, doneSpotIds, doneOn: allDone ? s.today : undefined });
    } else if (item.ref.kind === 'care') {
      for (const sp of spotId ? [spotId] : item.spotIds) {
        await put('logs', { id: newId(), date: s.today, kind: item.ref.type, spotId: sp });
      }
    } else {
      const courseIds = item.ref.courseIds;
      const courses = s.courses.filter((c) => courseIds.includes(c.id) && (!spotId || c.spotId === spotId));
      for (const old of courses) {
        const c = (await get<SprayCourse>('courses', old.id))!;
        if (c.doneDates.includes(s.today)) continue;
        await put('courses', markSprayDone(c, s.today));
        await put('logs', { id: newId(), date: s.today, kind: 'spray', spotId: c.spotId, courseId: c.id, text: c.product });
      }
    }
    if (item.ref.kind !== 'plan') {
      const next = new Set(ticked);
      for (const sp of spotId ? [spotId] : ['', ...item.spotIds]) next.add(`${uiKey(item)}|${sp}`);
      if (spotId && item.spotIds.every((x) => next.has(`${uiKey(item)}|${x}`))) next.add(`${uiKey(item)}|`);
      setTicked(next);
    }
    await reload();
  }

  function lateness(item: PlanItem) {
    if (item.daysOverdue <= 0) return { text: formatMinutes(item.estMin), cls: '' };
    return { text: `+${item.daysOverdue} days · ${formatMinutes(item.estMin)}`, cls: item.group === 'overdue' ? 'red' : 'amb' };
  }

  function renderItem(item: PlanItem) {
    const k = uiKey(item);
    const tag = lateness(item);
    const multi = item.spotIds.length > 1;
    if (!multi) {
      const label = item.ref.kind === 'plan' && item.spotIds.length === 1 ? `${item.title} (${item.spotIds[0]})` : item.title;
      return (
        <TickRow key={k} label={item.title} done={isDone(item)} onTick={() => tick(item)} tag={tag.text} tagClass={tag.cls}>
          {label}
        </TickRow>
      );
    }
    const doneCount = item.spotIds.filter((sp) => isDone(item, sp)).length;
    const expanded = open.has(k);
    const toggle = () => { const n = new Set(open); expanded ? n.delete(k) : n.add(k); setOpen(n); };
    const name = item.ref.kind === 'plan' ? item.title : item.title.split(':')[0];
    return (
      <div key={k}>
        <div class={doneCount === item.spotIds.length ? 'row link done' : 'row link'} onClick={toggle}>
          <span class="row-text">{item.title} · {doneCount} of {item.spotIds.length} done {expanded ? '▾' : '▸'}</span>
          <span class={'tag ' + tag.cls}>{tag.text}</span>
        </div>
        {expanded && (
          <div class="expand">
            {item.spotIds.map((sp) => (
              <TickRow key={sp} label={`${name} ${sp}`} done={isDone(item, sp)} onTick={() => tick(item, sp)}>{sp}</TickRow>
            ))}
          </div>
        )}
      </div>
    );
  }

  const groups = (['planned', 'overdue', 'season'] as const).map((g) => ({ g, list: items.filter((i) => i.group === g) }));

  return (
    <div>
      <p class="sub">Sat {formatShort(plan.saturday)}</p>
      <p class="sub"><strong>{headerText(plan)}</strong></p>
      {items.length === 0 && <p class="muted center">Nothing planned or due this Saturday.</p>}
      {groups.filter((x) => x.list.length > 0).map(({ g, list }) => (
        <Group key={g} title={GROUP_TITLE[g]}>{list.map(renderItem)}</Group>
      ))}
    </div>
  );
}
