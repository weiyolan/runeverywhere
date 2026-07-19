/**
 * App-wide TanStack Query key schema (P2 D1). Later phases EXTEND this file —
 * never invent ad-hoc keys.
 *
 * RESERVED (do not repurpose): ['conversations'], ['conversation', id,
 * 'messages'], ['notifications'] → P3; ['track', id], ['run', id, 'reviews']
 * → P4; ['leaderboard', isoWeek, city], ['badges', userId] → P5.
 */
import type { ExploreFilterParams } from '@/stores/exploreFilters';
import type { RunType } from '@/theme/theme';

/** ~110 m buckets so map drift doesn't churn the nearby cache. */
export const roundCoord = (v: number) => Math.round(v * 1000) / 1000;

export const qk = {
  runsNearby: (p: { lat: number; lng: number; radiusM: number; filters: ExploreFilterParams }) =>
    [
      'runs',
      'nearby',
      { ...p, lat: roundCoord(p.lat), lng: roundCoord(p.lng) },
    ] as const, // invalidate all: ['runs','nearby']
  runsNearbyAll: () => ['runs', 'nearby'] as const, // invalidation prefix
  runsSearch: (q: string) => ['runs', 'search', q] as const,
  runsSearchAll: () => ['runs', 'search'] as const, // invalidation prefix
  runsMine: () => ['runs', 'mine'] as const, // hosted + joined for (tabs)/runs
  invite: (code: string) => ['invite', code] as const, // invite/[code] resolver
  run: (id: string) => ['run', id] as const, // detail bundle: run + host + approvedCount + myMembership
  runMembers: (id: string) => ['run', id, 'members'] as const, // roster + inbox (host/member only)
  pointsPreview: (km: number, type: RunType) => ['points', 'preview', { km, type }] as const,
  profile: (id: string) => ['profile', id] as const, // reserved — P5 user/[id]
  // P3
  conversations: () => ['conversations'] as const,
  conversationMessages: (id: string) => ['conversation', id, 'messages'] as const,
  notifications: () => ['notifications'] as const,
  notificationsUnread: () => ['notifications', 'unread-count'] as const,
  // P4
  runCrew: (runId: string) => ['run', runId, 'crew'] as const,
  runAwards: (runId: string) => ['run', runId, 'awards'] as const,
  runMyTrack: (runId: string) => ['run', runId, 'my-track'] as const,
  runHost: (runId: string) => ['run', runId, 'host'] as const,
  track: (id: string) => ['track', id] as const,
  runsPast: () => ['runs', 'past'] as const,
  meetingPoint: (conversationId: string) =>
    ['conversation', conversationId, 'meeting-point'] as const,
  // P5
  profileStats: (id: string) => ['profile', id, 'stats'] as const,
  profileCanView: (id: string) => ['profile', id, 'can-view'] as const,
  blockedList: () => ['blocks', 'list'] as const,
  badges: (userId: string) => ['badges', userId] as const,
  reviews: (revieweeId: string) => ['reviews', revieweeId] as const,
  leaderboard: (isoWeek: string, city: string) => ['leaderboard', isoWeek, city] as const,
  blocks: () => ['blocks'] as const,
  safetyContacts: () => ['safety-contacts'] as const,
  levels: () => ['levels'] as const,
};
