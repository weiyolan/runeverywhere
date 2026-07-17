/**
 * Explore filter store (P2 D6) — filters map 1:1 to `runs_within_radius`
 * params; sort is client-side only and never part of the query key.
 * Survives the explore/filters route round-trip.
 */
import { addDays, endOfDay, nextSaturday, startOfDay, subDays } from 'date-fns';
import { create } from 'zustand';

import type { RunType } from '@/theme/theme';

export type ExploreWhen = 'any' | 'today' | 'week' | 'weekend';
export type ExploreRoute = 'any' | 'open' | 'closed';
export type ExploreSort = 'nearest' | 'soonest' | 'distance';

export interface ExploreFilterParams {
  p_types: RunType[] | null;
  /** null → server default now(). Only the weekend window sets it. */
  p_from: string | null;
  p_to: string | null;
  p_closed_loop: boolean | null;
  p_only_open_spots: boolean;
}

interface ExploreFiltersState {
  types: RunType[];
  when: ExploreWhen;
  route: ExploreRoute;
  onlyOpenSpots: boolean;
  sort: ExploreSort;
  /** In-memory only, max 8, newest first (Decisions #22). */
  recentQueries: string[];
  setTypes: (types: RunType[]) => void;
  toggleType: (type: RunType) => void;
  setWhen: (when: ExploreWhen) => void;
  setRoute: (route: ExploreRoute) => void;
  setOnlyOpenSpots: (on: boolean) => void;
  setSort: (sort: ExploreSort) => void;
  addRecentQuery: (q: string) => void;
  clearAll: () => void;
  activeCount: () => number;
  toRpcParams: () => ExploreFilterParams;
}

const MAX_RECENTS = 8;

/**
 * Device-local when-window. Timestamps are day-granular (00:00 / end-of-day)
 * so the value is stable across renders — a raw now() here would churn the
 * TanStack query key on every call.
 */
function whenWindow(when: ExploreWhen): { from: string | null; to: string | null } {
  const now = new Date();
  switch (when) {
    case 'today':
      return { from: null, to: endOfDay(now).toISOString() };
    case 'week':
      return { from: null, to: endOfDay(addDays(now, 7)).toISOString() };
    case 'weekend': {
      // This weekend while it lasts (Sat/Sun count), else the coming one.
      // Mid-weekend, p_from stays null (server now()) so already-started
      // runs never surface and the key stays stable.
      const day = now.getDay();
      const sat = startOfDay(day === 6 ? now : day === 0 ? subDays(now, 1) : nextSaturday(now));
      return {
        from: day === 6 || day === 0 ? null : sat.toISOString(),
        to: addDays(sat, 2).toISOString(),
      };
    }
    default:
      return { from: null, to: null };
  }
}

export const useExploreFilters = create<ExploreFiltersState>((set, get) => ({
  types: [],
  when: 'any',
  route: 'any',
  onlyOpenSpots: false,
  sort: 'nearest',
  recentQueries: [],

  setTypes: (types) => set({ types }),
  toggleType: (type) =>
    set((s) => ({
      types: s.types.includes(type) ? s.types.filter((t) => t !== type) : [...s.types, type],
    })),
  setWhen: (when) => set({ when }),
  setRoute: (route) => set({ route }),
  setOnlyOpenSpots: (onlyOpenSpots) => set({ onlyOpenSpots }),
  setSort: (sort) => set({ sort }),

  addRecentQuery: (q) =>
    set((s) => ({
      recentQueries: [q, ...s.recentQueries.filter((r) => r !== q)].slice(0, MAX_RECENTS),
    })),

  clearAll: () =>
    set({ types: [], when: 'any', route: 'any', onlyOpenSpots: false, sort: 'nearest' }),

  activeCount: () => {
    const s = get();
    return (
      (s.types.length > 0 ? 1 : 0) +
      (s.when !== 'any' ? 1 : 0) +
      (s.route !== 'any' ? 1 : 0) +
      (s.onlyOpenSpots ? 1 : 0)
    );
  },

  toRpcParams: () => {
    const s = get();
    const { from, to } = whenWindow(s.when);
    return {
      p_types: s.types.length ? s.types : null,
      p_from: from,
      p_to: to,
      p_closed_loop: s.route === 'any' ? null : s.route === 'closed',
      p_only_open_spots: s.onlyOpenSpots,
    };
  },
}));
