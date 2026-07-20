/**
 * Your Runs — ALL / MANAGED BY YOU / JOINED (P2 J1) + PAST history backed by
 * list_past_runs() (P4 H5).
 */
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Bell } from 'lucide-react-native';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { RunCard } from '@/components/ui/RunCard';
import { Tabs } from '@/components/ui/Tabs';
import { useStartRun } from '@/components/run/StartRunGate';
import { useUnreadBadges } from '@/hooks/useUnreadBadges';
import { formatKm, formatPace, formatWhen } from '@/lib/format';
import { listPastRuns, type PastRun } from '@/lib/tracks';
import { useRefetchOnFocus } from '@/lib/queryFocus';
import { qk } from '@/lib/queryKeys';
import { fetchMyRuns, type RunRow } from '@/lib/runs';
import { colors, fonts, sizing, spacing, textStyles, typeScale } from '@/theme/theme';

type TabId = 'all' | 'managed' | 'joined' | 'past';

interface Item {
  run: RunRow;
  role: 'hosted' | 'joined';
  pendingCount?: number;
  myStatus?: string;
}

export default function RunsScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<TabId>('all');
  // Per-mount clock — "past" runs only need day-level accuracy here
  const [now] = useState(() => Date.now());

  const query = useQuery({ queryKey: qk.runsMine(), queryFn: fetchMyRuns });
  useRefetchOnFocus([qk.runsMine()]);
  const { notificationsUnread } = useUnreadBadges();
  const { startRun, explainer } = useStartRun();

  const pastQuery = useQuery({ queryKey: qk.runsPast(), queryFn: listPastRuns });
  const past = pastQuery.data ?? [];

  // Completed runs live in PAST — keep them out of the upcoming lists.
  const hosted: Item[] = (query.data?.hosted ?? [])
    .filter((r) => r.status !== 'completed')
    .map((r) => ({
      run: r,
      role: 'hosted',
      pendingCount: r.pendingCount,
    }));
  const joined: Item[] = (query.data?.joined ?? [])
    .filter((m) => m.run.status !== 'completed')
    .map((m) => ({
      run: m.run,
      role: 'joined',
      myStatus: m.myStatus,
    }));

  // ALL: upcoming first (soonest on top), past runs sink to the bottom
  const nowIso = new Date(now).toISOString();
  const byStart = (a: Item, b: Item) => a.run.starts_at.localeCompare(b.run.starts_at);
  const union = [...hosted, ...joined];
  const all = [
    ...union.filter((i) => i.run.starts_at >= nowIso).sort(byStart),
    ...union.filter((i) => i.run.starts_at < nowIso).sort(byStart),
  ];
  const items = tab === 'managed' ? hosted : tab === 'joined' ? joined : all;

  const emptyCopy =
    tab === 'joined'
      ? "You haven't joined a run yet."
      : tab === 'managed'
        ? "You aren't hosting any runs yet."
        : 'No runs yet — find one nearby or host your own.';

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sp4 }]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={[textStyles.screenTitle, styles.title]}>Your runs</Text>
          <View>
            <IconButton
              variant="surface"
              round
              accessibilityLabel="Notifications"
              onPress={() => router.push('/notifications')}
            >
              <Bell size={20} />
            </IconButton>
            {notificationsUnread > 0 ? (
              <View style={styles.bellBadge}>
                <Badge tone="danger" solid>
                  {notificationsUnread > 99 ? '99+' : notificationsUnread}
                </Badge>
              </View>
            ) : null}
          </View>
        </View>
        <Tabs
          items={[
            { id: 'all', label: 'All' },
            { id: 'managed', label: 'Managed by you', count: hosted.length },
            { id: 'joined', label: 'Joined', count: joined.length },
            { id: 'past', label: 'Past', count: past.length },
          ]}
          value={tab}
          onChange={(id) => setTab(id as TabId)}
        />
      </View>

      {tab === 'past' ? (
        <FlatList
          data={past}
          keyExtractor={(item) => item.run_id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.sp16 }]}
          refreshControl={
            <RefreshControl
              refreshing={pastQuery.isRefetching}
              onRefresh={() => pastQuery.refetch()}
            />
          }
          ListEmptyComponent={
            pastQuery.isLoading ? null : (
              <View style={styles.empty}>
                <Text style={textStyles.body}>
                  No completed runs yet — join one and hit START.
                </Text>
              </View>
            )
          }
          renderItem={({ item }) => <PastRunCard item={item} />}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => `${item.role}-${item.run.id}`}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.sp16 }]}
          refreshControl={
            <RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} />
          }
          ListEmptyComponent={
            query.isLoading ? null : (
              <View style={styles.empty}>
                <Text style={textStyles.body}>{emptyCopy}</Text>
                <Button
                  label="Explore runs"
                  size="sm"
                  variant="secondary"
                  onPress={() => router.push('/(tabs)')}
                />
              </View>
            )
          }
          renderItem={({ item }) => {
            const isPastDated = new Date(item.run.starts_at).getTime() < now;
            const cancelled = item.run.status === 'cancelled';
            const startable =
              item.run.status === 'published' &&
              now >= new Date(item.run.starts_at).getTime() - 30 * 60 * 1000 &&
              (item.role === 'hosted' || item.myStatus === 'approved');
            return (
              <View style={[styles.cardWrap, isPastDated && !cancelled && !startable && styles.past]}>
                <View style={styles.badges}>
                  {item.role === 'hosted' && (item.pendingCount ?? 0) > 0 ? (
                    <Badge tone="warn">{item.pendingCount} requests</Badge>
                  ) : null}
                  {item.role === 'joined' && item.myStatus === 'pending' ? (
                    <Badge tone="warn">Pending</Badge>
                  ) : null}
                  {cancelled ? <Badge tone="danger">Cancelled</Badge> : null}
                </View>
                <RunCard
                  type={item.run.type}
                  title={item.run.title}
                  goal={item.run.goal || undefined}
                  distance={formatKm(item.run.distance_km)}
                  pace={
                    item.run.target_pace_s_per_km
                      ? formatPace(item.run.target_pace_s_per_km)
                      : undefined
                  }
                  when={formatWhen(item.run.starts_at)}
                  city={`${item.run.area_name} · ${item.run.city}`}
                  closedLoop={item.run.closed_loop}
                  onPress={() => router.push(`/run/${item.run.id}`)}
                />
                {startable ? (
                  <Pressable
                    accessibilityRole="button"
                    style={styles.startFooter}
                    onPress={() => void startRun(item.run.id)}
                  >
                    <Text style={styles.startFooterText}>
                      Tap to start · +{item.run.points_reward} pts
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            );
          }}
        />
      )}
      {explainer}
    </View>
  );
}

/** Past-history card (P4 H5): completed chip + track stats + earned footer. */
function PastRunCard({ item }: { item: PastRun }) {
  const km = item.track_distance_m != null ? item.track_distance_m / 1000 : item.distance_km;
  const pace = item.track_avg_pace_s_per_km;
  const footerBits = [
    item.my_rating_given != null ? `You rated ${Number(item.my_rating_given).toFixed(1)}` : null,
    item.points_earned > 0 ? `+${item.points_earned} pts` : null,
    'view recap',
  ].filter(Boolean);
  return (
    <View style={styles.cardWrap}>
      <View style={styles.badges}>
        <Badge tone="ink">Completed</Badge>
      </View>
      <RunCard
        type={item.type}
        title={item.title}
        distance={formatKm(Number(km))}
        pace={pace != null ? formatPace(pace) : undefined}
        when={formatWhen(item.starts_at)}
        city={`${item.area_name} · ${item.city}`}
        onPress={() => router.push(`/run/${item.run_id}`)}
      />
      <Text style={styles.pastFooter}>{footerBits.join(' · ')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper2 },
  header: { paddingHorizontal: sizing.gutter, gap: spacing.sp3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { flex: 1 },
  bellBadge: { position: 'absolute', top: -6, right: -6 },
  list: { paddingHorizontal: sizing.gutter, paddingTop: spacing.sp3, gap: spacing.sp3 },
  empty: { alignItems: 'center', gap: spacing.sp3, paddingVertical: spacing.sp10 },
  cardWrap: { gap: spacing.sp1 },
  badges: { flexDirection: 'row', gap: spacing.sp2 },
  past: { opacity: 0.6 },
  startFooter: {
    backgroundColor: colors.volt,
    borderRadius: 8,
    paddingVertical: spacing.sp2,
    alignItems: 'center',
  },
  startFooterText: {
    fontFamily: fonts.displayExtra,
    fontSize: typeScale.tSm,
    color: colors.ink900,
  },
  pastFooter: {
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.tXs,
    color: colors.ink500,
    paddingHorizontal: spacing.sp1,
  },
});
