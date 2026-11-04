import type { ScreenProps } from './useGarden';
import { careDueNow } from './useGarden';
import { buildToday } from '../domain/today';
import { markSprayDone } from '../domain/spray';
import { formatShort, newId } from '../domain/dates';
import { get, put } from '../db/db';
import type { PlanTask } from '../domain/types';
import { ProblemPhoto } from './ProblemPhoto';
import { Group, TickRow, lateTag } from './parts';
import type { ComponentChildren } from 'preact';

export function TodayScreen({ state: s, reload, banner }: ScreenProps & { banner?: ComponentChildren }) {
  const view = buildToday({ courses: s.courses, plans: s.plans, problems: s.problems, careDue: careDueNow(s), today: s.today });

  async function tickSpray(courseId: string) {
    const c = s.courses.find((x) => x.id === courseId)!;
    await put('courses', markSprayDone(c, s.today));
    await put('logs', { id: newId(), date: s.today, kind: 'spray', spotId: c.spotId, courseId: c.id, text: c.product });
    await reload();
  }

  async function tickPlan(id: string, spotId?: string) {
    const plan = (await get<PlanTask>('plans', id))!;
    if (spotId && plan.doneSpotIds.includes(spotId)) return;
    const doneSpotIds = spotId ? [...plan.doneSpotIds, spotId] : plan.spotIds;
    const allDone = plan.spotIds.every((x) => doneSpotIds.includes(x));
    await put('plans', { ...plan, doneSpotIds, doneOn: allDone ? s.today : undefined });
    await reload();
  }

  async function resolve(id: string) {
    const pr = s.problems.find((x) => x.id === id)!;
    await put('problems', { ...pr, resolvedOn: s.today });
    await reload();
  }

  const empty = view.sprays.length === 0 && view.plans.length === 0 && view.watching.length === 0;
  const productOf = (courseId: string) => s.courses.find((c) => c.id === courseId)?.product ?? 'Spray';

  return (
    <div>
      {banner}
      <p class="sub">Your quick daily check</p>
      {view.sprays.length > 0 && (
        <Group title="Sprays due">
          {view.sprays.map((d) => {
            const t = lateTag(d.daysLate);
            return (
              <TickRow key={d.courseId} label={`Spray ${d.spotId}`} onTick={() => tickSpray(d.courseId)} tag={t.text} tagClass={t.cls}>
                {d.spotId}: {productOf(d.courseId).toLowerCase()} ({d.number} of {d.total})
              </TickRow>
            );
          })}
        </Group>
      )}
      {view.plans.length > 0 && (
        <Group title="Planned for today">
          {view.plans.map((p) => {
            const late = lateTag(Math.max(0, (Date.parse(s.today) - Date.parse(p.due)) / 86_400_000));
            if (p.spotIds.length > 1) {
              return (
                <div key={p.id}>
                  <div class="row">
                    <span class="row-text">{p.title} · {p.doneSpotIds.length} of {p.spotIds.length} done{p.place && ` · ${p.place}`}</span>
                    <span class={'tag ' + late.cls}>{late.text}</span>
                  </div>
                  <div class="expand">
                    {p.spotIds.map((sp) => (
                      <TickRow key={sp} label={`${p.title} ${sp}`} done={p.doneSpotIds.includes(sp)} onTick={() => tickPlan(p.id, sp)}>{sp}</TickRow>
                    ))}
                  </div>
                </div>
              );
            }
            return (
              <TickRow key={p.id} label={p.title} onTick={() => tickPlan(p.id)} tag={late.text} tagClass={late.cls}>
                {p.title}{p.spotIds.length > 0 && ` (${p.spotIds.join(', ')})`}{p.place && ` · ${p.place}`}
              </TickRow>
            );
          })}
        </Group>
      )}
      {view.watching.length > 0 && (
        <Group title="Watching">
          {view.watching.map((pr) => (
            <div class="row" key={pr.id}>
              <ProblemPhoto problem={pr} />
              <span class="row-text">🐛 {pr.spotId} {pr.text}, since {formatShort(pr.seenOn)}</span>
              <button type="button" class="btn small ghost" onClick={() => resolve(pr.id)}>Resolved</button>
            </div>
          ))}
        </Group>
      )}
      {empty && <p class="muted center">Nothing needs doing today. 🌱</p>}
      <Group title="Coming up">
        <div class="row">
          <span class="row-text">Fertilizer/soil due on {view.saturdayHint.careDueCount} spots by Sat {formatShort(view.saturdayHint.saturday)}</span>
        </div>
      </Group>
    </div>
  );
}
