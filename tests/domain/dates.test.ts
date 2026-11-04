import { describe, test, expect } from 'vitest';
import { addDays, daysBetween, upcomingSaturday, formatShort, isSaturday } from '../../src/domain/dates';

describe('addDays', () => {
  test('crosses month, leap year and year boundaries', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('daysBetween', () => {
  test('is b minus a, signed', () => {
    expect(daysBetween('2026-11-01', '2026-11-04')).toBe(3);
    expect(daysBetween('2026-11-04', '2026-11-01')).toBe(-3);
  });
});

describe('upcomingSaturday', () => {
  test('returns the next Saturday, or today when today is Saturday', () => {
    expect(upcomingSaturday('2026-11-04')).toBe('2026-11-07');
    expect(upcomingSaturday('2026-11-07')).toBe('2026-11-07');
    expect(upcomingSaturday('2026-11-08')).toBe('2026-11-14');
    expect(isSaturday('2026-11-07')).toBe(true);
  });
});

test('formatShort gives day and month', () => {
  expect(formatShort('2026-11-07')).toBe('7 Nov');
});
