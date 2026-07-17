import { describe, expect, it } from 'vitest';

import {
  formatAway,
  formatKm,
  formatPace,
  formatPinLabel,
  formatWhen,
  spotsLeft,
} from '@/lib/format';

describe('formatPace', () => {
  it('renders m:ss /km', () => {
    expect(formatPace(330)).toBe('5:30 /km');
    expect(formatPace(360)).toBe('6:00 /km');
    expect(formatPace(125)).toBe('2:05 /km');
  });
});

describe('formatKm / formatPinLabel', () => {
  it('formatKm keeps one decimal as stored', () => {
    expect(formatKm(7.5)).toBe('7.5 km');
    expect(formatKm(12)).toBe('12 km');
  });
  it('formatPinLabel trims .0 and appends K', () => {
    expect(formatPinLabel(7.5)).toBe('7.5K');
    expect(formatPinLabel(12.0)).toBe('12K');
    expect(formatPinLabel(5.2)).toBe('5.2K');
  });
});

describe('formatAway', () => {
  it('uses metres under 1 km, km with one decimal above', () => {
    expect(formatAway(400)).toBe('400 m away');
    expect(formatAway(999)).toBe('999 m away');
    expect(formatAway(2100)).toBe('2.1 km away');
  });
});

describe('formatWhen', () => {
  const at = (base: Date, h: number, m = 0) => {
    const d = new Date(base);
    d.setHours(h, m, 0, 0);
    return d;
  };

  it('labels today and tomorrow', () => {
    const today = at(new Date(), 18, 30);
    expect(formatWhen(today.toISOString())).toBe('Today · 18:30');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(formatWhen(at(tomorrow, 7, 0).toISOString())).toBe('Tomorrow · 07:00');
  });

  it('uses weekday short name inside a week, date beyond', () => {
    const inFour = new Date();
    inFour.setDate(inFour.getDate() + 4);
    const expectedDay = inFour.toLocaleDateString('en-US', { weekday: 'short' });
    expect(formatWhen(at(inFour, 8, 0).toISOString())).toBe(`${expectedDay} · 08:00`);

    const inTwenty = new Date();
    inTwenty.setDate(inTwenty.getDate() + 20);
    const label = formatWhen(at(inTwenty, 8, 0).toISOString());
    expect(label).toMatch(/^\d{1,2} [A-Z][a-z]{2} · 08:00$/);
  });
});

describe('spotsLeft', () => {
  it('is max_group − 1 − approved (host occupies a slot)', () => {
    expect(spotsLeft(8, 3)).toBe(4);
    expect(spotsLeft(2, 0)).toBe(1);
    expect(spotsLeft(2, 1)).toBe(0);
  });
});
