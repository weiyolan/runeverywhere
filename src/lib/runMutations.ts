/**
 * Mutation hooks implementing the P2 D4 invalidation table. Screens use these
 * — never raw useMutation over the runs service.
 */
import { useMutation } from '@tanstack/react-query';

import { queryClient } from '@/lib/queryClient';
import { qk } from '@/lib/queryKeys';
import {
  cancelJoin,
  cancelRun,
  createRun,
  joinRun,
  removeMember,
  respondToRequest,
  updateRun,
  type MemberRow,
  type RunDetail,
  type RunMemberWithProfile,
  type RunPatch,
  type RunRow,
} from '@/lib/runs';
import { parsePoint } from '@/lib/geo';
import { useSession } from '@/stores/session';
import type { PublishDraft } from '@/lib/validation/run';

const invalidate = (...keys: readonly (readonly unknown[])[]) => {
  for (const queryKey of keys) void queryClient.invalidateQueries({ queryKey });
};

/** Snapshot + patch qk.run(id) for optimistic membership transitions. */
async function patchMyMembership(runId: string, status: MemberRow['status']) {
  await queryClient.cancelQueries({ queryKey: qk.run(runId) });
  const snapshot = queryClient.getQueryData<RunDetail>(qk.run(runId));
  if (snapshot) {
    const prev = snapshot.myMembership;
    queryClient.setQueryData<RunDetail>(qk.run(runId), {
      ...snapshot,
      myMembership: {
        run_id: runId,
        user_id: prev?.user_id ?? '',
        status,
        intro_message: prev?.intro_message ?? '',
        requested_at: prev?.requested_at ?? new Date().toISOString(),
        decided_at: null,
        decided_by: null,
      },
    });
  }
  return snapshot;
}

const rollbackRun = (runId: string, snapshot: RunDetail | undefined) => {
  if (snapshot) queryClient.setQueryData(qk.run(runId), snapshot);
};

export function useJoinRun(runId: string) {
  return useMutation({
    mutationFn: (intro: string) => joinRun(runId, intro),
    onMutate: async () => {
      const detail = queryClient.getQueryData<RunDetail>(qk.run(runId));
      const optimistic =
        detail?.run.visibility === 'approval' ? 'pending' : ('approved' as const);
      return { snapshot: await patchMyMembership(runId, optimistic) };
    },
    onError: (_e, _v, ctx) => rollbackRun(runId, ctx?.snapshot),
    onSettled: () =>
      invalidate(qk.run(runId), qk.runMembers(runId), qk.runsMine(), ['runs', 'nearby'], ['runs', 'search']),
  });
}

export function useCancelJoin(runId: string) {
  return useMutation({
    mutationFn: () => cancelJoin(runId),
    onMutate: async () => ({ snapshot: await patchMyMembership(runId, 'cancelled') }),
    onError: (_e, _v, ctx) => rollbackRun(runId, ctx?.snapshot),
    onSettled: () =>
      invalidate(qk.run(runId), qk.runMembers(runId), qk.runsMine(), ['runs', 'nearby'], ['runs', 'search']),
  });
}

async function patchMemberRow(runId: string, userId: string, status: MemberRow['status']) {
  await queryClient.cancelQueries({ queryKey: qk.runMembers(runId) });
  const snapshot = queryClient.getQueryData<RunMemberWithProfile[]>(qk.runMembers(runId));
  if (snapshot) {
    queryClient.setQueryData<RunMemberWithProfile[]>(
      qk.runMembers(runId),
      snapshot.map((m) =>
        m.user_id === userId ? { ...m, status, decided_at: new Date().toISOString() } : m,
      ),
    );
  }
  return snapshot;
}

const rollbackMembers = (runId: string, snapshot: RunMemberWithProfile[] | undefined) => {
  if (snapshot) queryClient.setQueryData(qk.runMembers(runId), snapshot);
};

export function useRespondToRequest(runId: string) {
  return useMutation({
    mutationFn: (v: { userId: string; approve: boolean }) =>
      respondToRequest(runId, v.userId, v.approve),
    onMutate: async ({ userId, approve }) => ({
      snapshot: await patchMemberRow(runId, userId, approve ? 'approved' : 'declined'),
    }),
    onError: (_e, _v, ctx) => rollbackMembers(runId, ctx?.snapshot),
    onSettled: () => invalidate(qk.run(runId), qk.runMembers(runId), qk.runsMine()),
  });
}

export function useRemoveMember(runId: string) {
  return useMutation({
    mutationFn: (userId: string) => removeMember(runId, userId),
    onMutate: async (userId) => ({ snapshot: await patchMemberRow(runId, userId, 'removed') }),
    onError: (_e, _v, ctx) => rollbackMembers(runId, ctx?.snapshot),
    onSettled: () => invalidate(qk.run(runId), qk.runMembers(runId)),
  });
}

export function useCreateRun() {
  const profile = useSession((s) => s.profile);
  return useMutation({
    // Pessimistic — the row (id, invite_code, points_reward) is server-made
    mutationFn: (draft: PublishDraft) => createRun(draft),
    onSuccess: (run: RunRow) => {
      const point = parsePoint(run.start_point);
      if (point && profile) {
        queryClient.setQueryData<RunDetail>(qk.run(run.id), {
          run: { ...run, point },
          host: {
            id: profile.id,
            display_name: profile.display_name,
            avatar_url: profile.avatar_url,
            rating_avg: profile.rating_avg,
            rating_count: profile.rating_count,
            home_city: profile.home_city,
          },
          approvedCount: 0,
          myMembership: null,
        });
      }
      invalidate(['runs', 'nearby'], qk.runsMine());
    },
  });
}

async function patchRun(runId: string, patch: Partial<RunRow>) {
  await queryClient.cancelQueries({ queryKey: qk.run(runId) });
  const snapshot = queryClient.getQueryData<RunDetail>(qk.run(runId));
  if (snapshot) {
    queryClient.setQueryData<RunDetail>(qk.run(runId), {
      ...snapshot,
      run: { ...snapshot.run, ...patch },
    });
  }
  return snapshot;
}

const RUN_WRITE_KEYS = () =>
  [['runs', 'nearby'], ['runs', 'search']] as const;

export function useUpdateRun(runId: string) {
  return useMutation({
    mutationFn: (patch: RunPatch) => updateRun(runId, patch),
    onMutate: async (patch) => ({
      snapshot: await patchRun(runId, { ...patch, starts_at: patch.starts_at ?? undefined }),
    }),
    onError: (_e, _v, ctx) => rollbackRun(runId, ctx?.snapshot),
    onSettled: () => invalidate(qk.run(runId), ...RUN_WRITE_KEYS(), qk.runsMine()),
  });
}

export function useCancelRun(runId: string) {
  return useMutation({
    mutationFn: () => cancelRun(runId),
    onMutate: async () => ({ snapshot: await patchRun(runId, { status: 'cancelled' }) }),
    onError: (_e, _v, ctx) => rollbackRun(runId, ctx?.snapshot),
    onSettled: () => invalidate(qk.run(runId), ...RUN_WRITE_KEYS(), qk.runsMine()),
  });
}
