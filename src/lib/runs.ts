/**
 * All Supabase reads/writes for the core loop (P2 D4) — screens never call
 * `supabase` directly. Mutation cache policy lives in runMutations.ts.
 */
import { supabase } from '@/lib/supabase';
import { parsePoint, type LatLng } from '@/lib/geo';
import { spotsLeft } from '@/lib/format';
import type { PublishDraft } from '@/lib/validation/run';
import type { ExploreFilterParams } from '@/stores/exploreFilters';
import type { Database } from '@/types/database.types';

export type RunRow = Database['public']['Tables']['runs']['Row'];
export type MemberRow = Database['public']['Tables']['run_members']['Row'];

export interface HostProfile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  rating_avg: number | null;
  rating_count: number;
  home_city: string | null;
}

export interface MemberProfile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  rating_avg: number | null;
  rating_count: number;
  languages: string[];
}

export interface NearbyRun {
  run: RunRow & { point: LatLng };
  distanceM: number;
  approvedCount: number;
  spotsLeft: number;
}

export interface RunDetail {
  run: RunRow & { point: LatLng };
  /** null when the host profile is hidden (UI shows "Host"). */
  host: HostProfile | null;
  approvedCount: number;
  myMembership: MemberRow | null;
}

export type RunMemberWithProfile = MemberRow & { profile: MemberProfile | null };

export class RunNotFoundError extends Error {
  constructor() {
    super('This run is no longer available.');
    this.name = 'RunNotFoundError';
  }
}

function unwrap<T>(result: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (result.error) throw new Error(result.error.message);
  if (result.data == null) throw new Error('empty response');
  return result.data;
}

/** For maybeSingle() paths where a missing row is a legitimate result. */
function unwrapNullable<T>(result: { data: T; error: { message: string } | null }): T | null {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

async function requireUid(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user.id;
  if (!uid) throw new Error('not authenticated');
  return uid;
}

type RadiusRow = { run: RunRow; distance_m: number; approved_count: number };

function toNearbyRun(row: RadiusRow): NearbyRun | null {
  const point = parsePoint(row.run.start_point);
  if (!point) return null;
  return {
    run: { ...row.run, point },
    distanceM: row.distance_m,
    approvedCount: row.approved_count,
    spotsLeft: spotsLeft(row.run.max_group, row.approved_count),
  };
}

export async function fetchNearbyRuns(params: {
  lat: number;
  lng: number;
  radiusM: number;
  filters: ExploreFilterParams;
}): Promise<NearbyRun[]> {
  const { filters } = params;
  const rows = unwrap(
    await supabase.rpc('runs_within_radius', {
      p_lat: params.lat,
      p_lng: params.lng,
      p_radius_m: params.radiusM,
      p_types: filters.p_types ?? undefined,
      p_from: filters.p_from ?? undefined,
      p_to: filters.p_to ?? undefined,
      p_closed_loop: filters.p_closed_loop ?? undefined,
      p_only_open_spots: filters.p_only_open_spots,
    }),
  );
  return rows.map(toNearbyRun).filter((r): r is NearbyRun => r !== null);
}

export async function searchRuns(q: string, lat: number, lng: number): Promise<NearbyRun[]> {
  // Escape ILIKE wildcards so a literal % or _ in the query stays literal
  const escaped = q.replace(/[\\%_]/g, (c) => `\\${c}`);
  const rows = unwrap(await supabase.rpc('search_runs', { p_query: escaped, p_lat: lat, p_lng: lng }));
  return rows.map(toNearbyRun).filter((r): r is NearbyRun => r !== null);
}

export interface MyRuns {
  hosted: (RunRow & { pendingCount: number })[];
  joined: { run: RunRow; myStatus: MemberRow['status'] }[];
}

export async function fetchMyRuns(): Promise<MyRuns> {
  const uid = await requireUid();
  const [hostedRows, joinedRows] = await Promise.all([
    supabase.from('runs').select('*').eq('host_id', uid).order('starts_at').then(unwrap),
    supabase
      .from('run_members')
      .select('status, run:runs(*)')
      .eq('user_id', uid)
      .in('status', ['pending', 'approved'])
      .then(unwrap),
  ]);

  const hostedIds = hostedRows.map((r) => r.id);
  const pendingByRun = new Map<string, number>();
  if (hostedIds.length) {
    const pendingRows = unwrap(
      await supabase
        .from('run_members')
        .select('run_id')
        .eq('status', 'pending')
        .in('run_id', hostedIds),
    );
    for (const { run_id } of pendingRows) {
      pendingByRun.set(run_id, (pendingByRun.get(run_id) ?? 0) + 1);
    }
  }

  return {
    hosted: hostedRows.map((r) => ({ ...r, pendingCount: pendingByRun.get(r.id) ?? 0 })),
    joined: joinedRows
      .filter((m) => m.run !== null)
      .map((m) => ({ run: m.run as RunRow, myStatus: m.status })),
  };
}

const HOST_COLUMNS = 'id, display_name, avatar_url, rating_avg, rating_count, home_city';

export async function fetchRunDetail(id: string, inviteCode?: string): Promise<RunDetail> {
  let run: RunRow | null = null;
  let host: HostProfile | null = null;

  const direct = unwrapNullable(
    await supabase
      .from('runs')
      .select(`*, host:profiles!runs_host_id_fkey(${HOST_COLUMNS})`)
      .eq('id', id)
      .maybeSingle(),
  );

  if (direct) {
    const { host: hostRow, ...runRow } = direct;
    run = runRow as RunRow;
    host = hostRow as HostProfile | null;
  } else if (inviteCode) {
    // Invite-only runs are RLS-hidden from direct SELECT; resolve by code.
    const byInvite = unwrap(await supabase.rpc('get_run_by_invite', { p_code: inviteCode }));
    run = byInvite.find((r) => r.id === id) ?? byInvite[0] ?? null;
    if (run) {
      host = unwrapNullable(
        await supabase.from('profiles').select(HOST_COLUMNS).eq('id', run.host_id).maybeSingle(),
      );
    }
  }

  if (!run) throw new RunNotFoundError();
  const point = parsePoint(run.start_point);
  if (!point) throw new RunNotFoundError();

  const uid = (await supabase.auth.getSession()).data.session?.user.id;
  const [approvedCount, myMembership] = await Promise.all([
    supabase.rpc('run_approved_count', { p_run_id: run.id }).then(unwrap),
    uid
      ? supabase
          .from('run_members')
          .select('*')
          .eq('run_id', run.id)
          .eq('user_id', uid)
          .maybeSingle()
          .then(unwrapNullable)
      : Promise.resolve(null),
  ]);

  return { run: { ...run, point }, host, approvedCount, myMembership };
}

export async function fetchRunMembers(id: string): Promise<RunMemberWithProfile[]> {
  const rows = unwrap(
    await supabase
      .from('run_members')
      .select(
        '*, profile:profiles!run_members_user_id_fkey(id, display_name, avatar_url, rating_avg, rating_count, languages)',
      )
      .eq('run_id', id)
      .order('requested_at'),
  );
  return rows as RunMemberWithProfile[];
}

// --- Mutations (thin wrappers; cache policy lives in runMutations.ts) -------

export async function joinRun(id: string, intro: string): Promise<MemberRow> {
  return unwrap(await supabase.rpc('join_run', { p_run_id: id, p_intro_message: intro }));
}

export async function cancelJoin(id: string): Promise<MemberRow> {
  return unwrap(await supabase.rpc('cancel_join', { p_run_id: id }));
}

export async function respondToRequest(
  id: string,
  userId: string,
  approve: boolean,
): Promise<MemberRow> {
  return unwrap(
    await supabase.rpc('respond_to_join_request', {
      p_run_id: id,
      p_user_id: userId,
      p_approve: approve,
    }),
  );
}

export async function removeMember(id: string, userId: string): Promise<MemberRow> {
  return unwrap(await supabase.rpc('remove_member', { p_run_id: id, p_user_id: userId }));
}

export async function createRun(draft: PublishDraft): Promise<RunRow> {
  const uid = await requireUid();
  return unwrap(
    await supabase
      .from('runs')
      .insert({
        host_id: uid,
        type: draft.type,
        visibility: draft.visibility,
        title: draft.title,
        goal: draft.goal,
        start_point: `POINT(${draft.point.lng} ${draft.point.lat})`,
        area_name: draft.area_name,
        city: draft.city,
        country_code: draft.country_code,
        distance_km: draft.distance_km,
        max_group: draft.max_group,
        target_pace_s_per_km: draft.target_pace_s_per_km,
        starts_at: draft.starts_at.toISOString(),
        closed_loop: draft.closed_loop,
        // status / invite_code / points_reward are server-defaulted
      })
      .select()
      .single(),
  );
}

export type RunPatch = Partial<
  Pick<
    Database['public']['Tables']['runs']['Update'],
    | 'title'
    | 'goal'
    | 'distance_km'
    | 'max_group'
    | 'target_pace_s_per_km'
    | 'starts_at'
    | 'closed_loop'
    | 'visibility'
  >
>;

export async function updateRun(id: string, patch: RunPatch): Promise<RunRow> {
  return unwrap(await supabase.from('runs').update(patch).eq('id', id).select().single());
}

export async function cancelRun(id: string): Promise<RunRow> {
  return unwrap(
    await supabase.from('runs').update({ status: 'cancelled' }).eq('id', id).select().single(),
  );
}

/** Resolve an invite code to its run (invite/[code] deep link, P2 I4). */
export async function fetchRunByInvite(code: string): Promise<RunRow | null> {
  const rows = unwrap(await supabase.rpc('get_run_by_invite', { p_code: code }));
  return rows[0] ?? null;
}

/** Server-authoritative points preview (Decisions #12 — never client-computed). */
export async function fetchPointsPreview(distanceKm: number, type: RunRow['type']): Promise<number> {
  return unwrap(
    await supabase.rpc('compute_points_reward', { p_distance_km: distanceKm, p_type: type }),
  );
}
