/**
 * Explore search (P2 F2) — title/area matches via the search_runs RPC,
 * recent queries + areas-near-you suggestions when idle.
 */
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ArrowLeft, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import { RunCard } from '@/components/ui/RunCard';
import { useExploreCenter, useUserLocation } from '@/hooks/useUserLocation';
import { formatAway, formatKm, formatPace, formatWhen } from '@/lib/format';
import { queryClient } from '@/lib/queryClient';
import { qk } from '@/lib/queryKeys';
import { searchRuns, type NearbyRun } from '@/lib/runs';
import { useExploreFilters } from '@/stores/exploreFilters';
import { useSession } from '@/stores/session';
import {
  borderWidth,
  colors,
  fonts,
  radius,
  sizing,
  spacing,
  textStyles,
  typeScale,
} from '@/theme/theme';

const DEBOUNCE_MS = 300;
const MIN_QUERY_LEN = 2;

interface AreaSuggestion {
  area: string;
  count: number;
  minDistanceM: number;
}

/** Areas near you, derived client-side from whatever nearby data is cached. */
function cachedAreaSuggestions(): AreaSuggestion[] {
  const cached = queryClient.getQueriesData<NearbyRun[]>({ queryKey: ['runs', 'nearby'] });
  const runs = cached.flatMap(([, data]) => data ?? []);
  const byArea = new Map<string, AreaSuggestion>();
  for (const r of runs) {
    const area = r.run.area_name.trim();
    if (!area) continue;
    const existing = byArea.get(area);
    byArea.set(area, {
      area,
      count: (existing?.count ?? 0) + 1,
      minDistanceM: Math.min(existing?.minDistanceM ?? Infinity, r.distanceM),
    });
  }
  return [...byArea.values()].sort((a, b) => a.minDistanceM - b.minDistanceM).slice(0, 6);
}

export default function ExploreSearchScreen() {
  const insets = useSafeAreaInsets();
  const location = useUserLocation();
  const center = useExploreCenter(location);
  const profile = useSession((s) => s.profile);
  const recentQueries = useExploreFilters((s) => s.recentQueries);
  const addRecentQuery = useExploreFilters((s) => s.addRecentQuery);

  const [text, setText] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(text.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [text]);

  const active = debounced.length >= MIN_QUERY_LEN;
  const query = useQuery({
    queryKey: qk.runsSearch(debounced),
    queryFn: () => searchRuns(debounced, center.lat, center.lng),
    enabled: active,
  });

  const areas = useMemo(() => cachedAreaSuggestions(), []);
  const results = query.data ?? [];

  const submit = () => {
    const q = text.trim();
    if (q.length >= MIN_QUERY_LEN) addRecentQuery(q);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sp2 }]}>
      <View style={styles.header}>
        <IconButton accessibilityLabel="Back" onPress={() => router.back()}>
          <ArrowLeft size={20} />
        </IconButton>
        <View style={styles.headerInput}>
          <Input
            value={text}
            onChangeText={setText}
            placeholder="Search runs, areas, runners"
            autoFocus
            returnKeyType="search"
            onSubmitEditing={submit}
            trailing={
              text ? (
                <Pressable accessibilityRole="button" onPress={() => setText('')}>
                  <X size={18} color={colors.ink400} />
                </Pressable>
              ) : undefined
            }
          />
        </View>
      </View>

      {!active ? (
        <View style={styles.idle}>
          {recentQueries.length ? (
            <>
              <Text style={textStyles.eyebrow}>RECENT</Text>
              <View style={styles.chipRow}>
                {recentQueries.map((q) => (
                  <Pressable
                    key={q}
                    accessibilityRole="button"
                    style={styles.chip}
                    onPress={() => setText(q)}
                  >
                    <Text style={styles.chipText}>{q}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}
          {areas.length ? (
            <>
              <Text style={textStyles.eyebrow}>
                AREAS IN {(profile?.home_city || 'your city').toUpperCase()}
              </Text>
              {areas.map((a) => (
                <Pressable
                  key={a.area}
                  accessibilityRole="button"
                  style={styles.areaRow}
                  onPress={() => setText(a.area)}
                >
                  <Text style={styles.areaName}>{a.area}</Text>
                  <Text style={textStyles.caption}>
                    {a.count} {a.count === 1 ? 'run' : 'runs'} · {formatAway(a.minDistanceM)}
                  </Text>
                </Pressable>
              ))}
            </>
          ) : null}
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.run.id}
          contentContainerStyle={styles.results}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            query.isLoading ? null : (
              <View style={styles.empty}>
                <Text style={textStyles.body}>No runs found for “{debounced}”.</Text>
                <Text style={textStyles.caption}>Try an area name or shorter word.</Text>
              </View>
            )
          }
          renderItem={({ item }) => (
            <View style={styles.result}>
              <RunCard
                variant="compact"
                type={item.run.type}
                title={item.run.title}
                distance={formatKm(item.run.distance_km)}
                pace={
                  item.run.target_pace_s_per_km ? formatPace(item.run.target_pace_s_per_km) : undefined
                }
                when={formatWhen(item.run.starts_at)}
                spotsLeft={item.spotsLeft}
                onPress={() => {
                  submit();
                  router.push(`/run/${item.run.id}`);
                }}
              />
              <Text style={textStyles.caption}>{formatAway(item.distanceM)}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper2 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sp2,
    paddingHorizontal: sizing.gutter,
    paddingBottom: spacing.sp3,
  },
  headerInput: { flex: 1 },
  idle: { paddingHorizontal: sizing.gutter, gap: spacing.sp3 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sp2 },
  chip: {
    height: sizing.controlHXs,
    paddingHorizontal: spacing.sp3,
    borderRadius: radius.pill,
    backgroundColor: colors.paper,
    borderWidth: borderWidth.mid,
    borderColor: colors.ink200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.tSm,
    color: colors.ink700,
  },
  areaRow: {
    paddingVertical: spacing.sp2,
    borderBottomWidth: borderWidth.hair,
    borderBottomColor: colors.ink100,
    gap: 2,
  },
  areaName: {
    fontFamily: fonts.bodySemiBold,
    fontSize: typeScale.tMd,
    color: colors.ink900,
  },
  results: { paddingHorizontal: sizing.gutter, gap: spacing.sp3, paddingBottom: spacing.sp12 },
  result: { gap: 4 },
  empty: { alignItems: 'center', gap: spacing.sp1, paddingVertical: spacing.sp10 },
});
