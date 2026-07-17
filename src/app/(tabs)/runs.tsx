/**
 * Your Runs (P2 J1) — ALL / MANAGED BY YOU / JOINED. No PAST tab until P4's
 * complete_run exists (Decisions #17).
 */
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { RunCard } from '@/components/ui/RunCard';
import { Tabs } from '@/components/ui/Tabs';
import { formatKm, formatPace, formatWhen } from '@/lib/format';
import { useRefetchOnFocus } from '@/lib/queryFocus';
import { qk } from '@/lib/queryKeys';
import { fetchMyRuns, type RunRow } from '@/lib/runs';
import { colors, sizing, spacing, textStyles } from '@/theme/theme';

type TabId = 'all' | 'managed' | 'joined';

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

  const hosted: Item[] = (query.data?.hosted ?? []).map((r) => ({
    run: r,
    role: 'hosted',
    pendingCount: r.pendingCount,
  }));
  const joined: Item[] = (query.data?.joined ?? []).map((m) => ({
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
        <Text style={textStyles.screenTitle}>Your runs</Text>
        <Tabs
          items={[
            { id: 'all', label: 'All' },
            { id: 'managed', label: 'Managed by you', count: hosted.length },
            { id: 'joined', label: 'Joined', count: joined.length },
          ]}
          value={tab}
          onChange={(id) => setTab(id as TabId)}
        />
      </View>

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
          const past = new Date(item.run.starts_at).getTime() < now;
          const cancelled = item.run.status === 'cancelled';
          return (
            <View style={[styles.cardWrap, past && !cancelled && styles.past]}>
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
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper2 },
  header: { paddingHorizontal: sizing.gutter, gap: spacing.sp3 },
  list: { paddingHorizontal: sizing.gutter, paddingTop: spacing.sp3, gap: spacing.sp3 },
  empty: { alignItems: 'center', gap: spacing.sp3, paddingVertical: spacing.sp10 },
  cardWrap: { gap: spacing.sp1 },
  badges: { flexDirection: 'row', gap: spacing.sp2 },
  past: { opacity: 0.6 },
});
