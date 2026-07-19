/**
 * Completion + history service (P4 G1). complete_run is the points engine —
 * the client only assembles the payload and renders the jsonb result.
 */
import { gzip } from 'pako';

import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database.types';

export type TrackRow = Database['public']['Tables']['run_tracks']['Row'];
export type PastRun = Database['public']['Functions']['list_past_runs']['Returns'][number];
export type PointsReason = Database['public']['Enums']['points_reason'];

export interface Award {
  reason: PointsReason;
  points: number;
}

export interface CompleteRunResult {
  track_id: string;
  distance_m: number;
  duration_s: number;
  elevation_gain_m: number;
  avg_pace_s_per_km: number;
  awards: Award[];
  total_awarded: number;
  already_completed: boolean;
}

export async function completeRun(args: {
  runId: string;
  polyline: string;
  distanceM: number;
  durationS: number;
  elevationGainM: number;
  startedAt: string;
  endedAt: string;
  rawPath?: string;
}): Promise<CompleteRunResult> {
  const { data, error } = await supabase.rpc('complete_run', {
    p_run_id: args.runId,
    p_polyline: args.polyline,
    p_distance_m: args.distanceM,
    p_duration_s: args.durationS,
    p_elevation_gain_m: args.elevationGainM,
    p_started_at: args.startedAt,
    p_ended_at: args.endedAt,
    p_raw_path: args.rawPath ?? null,
  });
  if (error) throw error;
  return data as unknown as CompleteRunResult;
}

/** Best-effort raw-sample archive (retried once by the caller). */
export async function uploadRawSamples(path: string, samples: unknown[]): Promise<void> {
  const gz = gzip(JSON.stringify(samples));
  const { error } = await supabase.storage
    .from('tracks')
    .upload(path, gz.buffer as ArrayBuffer, { contentType: 'application/gzip', upsert: true });
  if (error) throw error;
}

export async function fetchTrack(trackId: string): Promise<TrackRow | null> {
  const { data, error } = await supabase
    .from('run_tracks')
    .select('*')
    .eq('id', trackId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchRunAwards(runId: string): Promise<Award[]> {
  const { data, error } = await supabase
    .from('points_ledger')
    .select('reason, points')
    .eq('run_id', runId);
  if (error) throw error;
  return data;
}

export async function listPastRuns(): Promise<PastRun[]> {
  const { data, error } = await supabase.rpc('list_past_runs');
  if (error) throw error;
  return data;
}
