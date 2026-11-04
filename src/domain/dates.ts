import type { ISODate } from './types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// All day math goes through local Date objects; never toISOString(), which is UTC.
function parse(d: ISODate): Date {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day);
}

function format(dt: Date): ISODate {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

export function today(): ISODate {
  return format(new Date());
}

export function addDays(d: ISODate, n: number): ISODate {
  const dt = parse(d);
  dt.setDate(dt.getDate() + n);
  return format(dt);
}

export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / 86_400_000);
}

export function isSaturday(d: ISODate): boolean {
  return parse(d).getDay() === 6;
}

export function upcomingSaturday(d: ISODate): ISODate {
  return addDays(d, (6 - parse(d).getDay() + 7) % 7);
}

export function formatShort(d: ISODate): string {
  const dt = parse(d);
  return `${dt.getDate()} ${MONTHS[dt.getMonth()]}`;
}

export function newId(): string {
  return crypto.randomUUID();
}
