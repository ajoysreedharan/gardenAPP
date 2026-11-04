import type { ComponentChildren } from 'preact';

export function Chip(p: { on?: boolean; onClick: () => void; children: ComponentChildren; label?: string }) {
  return (
    <button type="button" class={p.on ? 'chip on' : 'chip'} aria-pressed={p.on} aria-label={p.label} onClick={p.onClick}>
      {p.children}
    </button>
  );
}

export function TickRow(p: { label: string; done?: boolean; onTick: () => void; children: ComponentChildren; tag?: ComponentChildren; tagClass?: string }) {
  return (
    <label class={p.done ? 'row done' : 'row'}>
      <input type="checkbox" checked={!!p.done} aria-label={p.label} onChange={p.onTick} />
      <span class="row-text">{p.children}</span>
      {p.tag != null && <span class={'tag ' + (p.tagClass ?? '')}>{p.tag}</span>}
    </label>
  );
}

export function Group(p: { title: string; children: ComponentChildren }) {
  return (
    <section class="group">
      <h3>{p.title}</h3>
      {p.children}
    </section>
  );
}

export function lateTag(days: number): { text: string; cls: string } {
  if (days <= 0) return { text: 'today', cls: 'amb' };
  return { text: days === 1 ? '1 day late' : `${days} days late`, cls: 'red' };
}
