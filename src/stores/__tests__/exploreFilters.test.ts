import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useExploreFilters } from '@/stores/exploreFilters';

const store = useExploreFilters;

beforeEach(() => {
  store.getState().clearAll();
});

describe('toRpcParams', () => {
  it('maps the defaults to all-null filters', () => {
    const p = store.getState().toRpcParams();
    expect(p.p_types).toBeNull();
    expect(p.p_to).toBeNull();
    expect(p.p_closed_loop).toBeNull();
    expect(p.p_only_open_spots).toBe(false);
  });

  it('maps types, route and open spots 1:1', () => {
    store.getState().setTypes(['discover', 'social']);
    store.getState().setRoute('closed');
    store.getState().setOnlyOpenSpots(true);
    const p = store.getState().toRpcParams();
    expect(p.p_types).toEqual(['discover', 'social']);
    expect(p.p_closed_loop).toBe(true);
    expect(p.p_only_open_spots).toBe(true);

    store.getState().setRoute('open');
    expect(store.getState().toRpcParams().p_closed_loop).toBe(false);
  });

  it('computes device-local when-windows', () => {
    store.getState().setWhen('today');
    let p = store.getState().toRpcParams();
    expect(new Date(p.p_to!).getDate()).toBe(new Date().getDate());
    expect(new Date(p.p_to!).getHours()).toBe(23);

    store.getState().setWhen('week');
    p = store.getState().toRpcParams();
    // +7 days rounded up to end-of-day so the query key stays cache-stable
    const days = (new Date(p.p_to!).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThan(8.1);

    store.getState().setWhen('weekend');
    // Weekday: window is the coming Sat 00:00 → Mon 00:00 (both local, so a
    // DST shift inside the window is fine — no exact-duration assertion)
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2026, 6, 15, 12)); // Wednesday
      p = store.getState().toRpcParams();
      const from = new Date(p.p_from!);
      const to = new Date(p.p_to!);
      expect(from.getDay()).toBe(6); // Saturday 00:00
      expect(from.getHours()).toBe(0);
      expect(to.getDay()).toBe(1); // Sunday 24:00 == Monday 00:00 boundary
      expect(to.getHours()).toBe(0);
      expect(to.getTime()).toBeGreaterThan(from.getTime());

      // Mid-weekend: p_from null → server now() bounds the window
      vi.setSystemTime(new Date(2026, 6, 19, 12)); // Sunday
      p = store.getState().toRpcParams();
      expect(p.p_from).toBeNull();
      expect(new Date(p.p_to!).getDay()).toBe(1); // still this weekend's Monday
      expect(new Date(p.p_to!).getDate()).toBe(20);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('activeCount / clearAll', () => {
  it('counts active filters, excluding sort', () => {
    expect(store.getState().activeCount()).toBe(0);
    store.getState().setSort('soonest');
    expect(store.getState().activeCount()).toBe(0);
    store.getState().setTypes(['challenge']);
    store.getState().setWhen('weekend');
    store.getState().setOnlyOpenSpots(true);
    expect(store.getState().activeCount()).toBe(3);
    store.getState().clearAll();
    expect(store.getState().activeCount()).toBe(0);
    expect(store.getState().types).toEqual([]);
  });
});

describe('recent searches', () => {
  it('keeps the latest 8, deduped, newest first', () => {
    for (let i = 1; i <= 10; i++) store.getState().addRecentQuery(`q${i}`);
    store.getState().addRecentQuery('q10');
    const recents = store.getState().recentQueries;
    expect(recents).toHaveLength(8);
    expect(recents[0]).toBe('q10');
    expect(recents).not.toContain('q1');
  });
});
