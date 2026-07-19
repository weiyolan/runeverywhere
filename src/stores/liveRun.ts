/**
 * Live-run UI mirror (P4 E4). The recording task writes here via setState so
 * the screen reflects background progress whether or not it is mounted.
 */
import { create } from 'zustand';

import type { LatLng } from '@/lib/recording/geo';

export type LiveRunStatus = 'idle' | 'acquiring' | 'recording' | 'paused' | 'finishing';

const MAX_COORDS = 1000;

interface LiveRunState {
  status: LiveRunStatus;
  runId: string | null;
  startedAt: number | null;
  distanceM: number;
  elevationM: number;
  movingMs: number;
  currentPace: number | null;
  /** Decimated polyline for the map (max ~1000 points). */
  coords: LatLng[];
  backgroundGranted: boolean;
  set: (patch: Partial<LiveRunState>) => void;
  appendCoords: (points: LatLng[]) => void;
  reset: () => void;
}

const initial = {
  status: 'idle' as LiveRunStatus,
  runId: null,
  startedAt: null,
  distanceM: 0,
  elevationM: 0,
  movingMs: 0,
  currentPace: null,
  coords: [] as LatLng[],
  backgroundGranted: true,
};

export const useLiveRun = create<LiveRunState>((set) => ({
  ...initial,
  set: (patch) => set(patch),
  appendCoords: (points) =>
    set((s) => {
      const next = [...s.coords, ...points];
      // ponytail: drop-every-other decimation; simplification pass if maps chug.
      return { coords: next.length > MAX_COORDS ? next.filter((_, i) => i % 2 === 0) : next };
    }),
  reset: () => set(initial),
}));
