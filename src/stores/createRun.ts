/**
 * Create-run wizard draft (P2 G1). reset() on publish success and on
 * wizard close.
 */
import { create } from 'zustand';

import type { LatLng } from '@/lib/geo';
import type { Database } from '@/types/database.types';
import type { RunType } from '@/theme/theme';

type Visibility = Database['public']['Enums']['run_visibility'];

export interface CreateRunDraft {
  type: RunType | null;
  point: LatLng | null;
  area_name: string;
  city: string;
  country_code: string;
  title: string;
  goal: string;
  distance_km: number;
  max_group: number;
  target_pace_s_per_km: number | null;
  starts_at: Date | null;
  closed_loop: boolean;
  visibility: Visibility;
}

const INITIAL: CreateRunDraft = {
  type: null,
  point: null,
  area_name: '',
  city: '',
  country_code: '',
  title: '',
  goal: '',
  distance_km: 5,
  max_group: 8,
  target_pace_s_per_km: 360,
  starts_at: null,
  closed_loop: false,
  visibility: 'approval',
};

interface CreateRunState extends CreateRunDraft {
  set: (patch: Partial<CreateRunDraft>) => void;
  reset: () => void;
  isDirty: () => boolean;
}

export const useCreateRunDraft = create<CreateRunState>((set, get) => ({
  ...INITIAL,
  set: (patch) => set(patch),
  reset: () => set(INITIAL),
  isDirty: () => {
    const s = get();
    return (Object.keys(INITIAL) as (keyof CreateRunDraft)[]).some(
      (k) => s[k] !== INITIAL[k],
    );
  },
}));
