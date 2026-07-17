/**
 * Explore (P2 E3) — clustered map + list of nearby published runs with
 * search/filter entry points and the run-preview sheet.
 */
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { useQuery } from '@tanstack/react-query';
import { Link, router } from 'expo-router';
import { Search, SlidersHorizontal, Navigation } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppMap, AppMarker, type AppMapHandle } from '@/components/map/AppMap';
import { MapPin } from '@/components/map/MapPin';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { RunCard } from '@/components/ui/RunCard';
import { Tabs } from '@/components/ui/Tabs';
import { TypeChip } from '@/components/ui/TypeChip';
import { useClusters, type PinProperties } from '@/hooks/useClusters';
import { useExploreCenter, useUserLocation } from '@/hooks/useUserLocation';
import { formatAway, formatKm, formatPace, formatWhen } from '@/lib/format';
import { distanceMeters, regionForRadius, type LatLng, type Region } from '@/lib/geo';
import { qk } from '@/lib/queryKeys';
import { fetchNearbyRuns, type NearbyRun } from '@/lib/runs';
import { useExploreFilters } from '@/stores/exploreFilters';
import { useSession } from '@/stores/session';
import {
  borderWidth,
  colors,
  fonts,
  radius,
  semantic,
  shadows,
  sizing,
  spacing,
  textStyles,
  typeScale,
  type RunType,
} from '@/theme/theme';

const RADIUS_M = 25_000;
const SEARCH_AREA_THRESHOLD_M = 5_000;
const RUN_TYPES: RunType[] = ['discover', 'challenge', 'social'];
const SHEET_HEIGHT = 248;

const sortRuns = (runs: NearbyRun[], sort: 'nearest' | 'soonest' | 'distance') =>
  [...runs].sort((a, b) => {
    if (sort === 'soonest') return a.run.starts_at.localeCompare(b.run.starts_at);
    if (sort === 'distance') return a.run.distance_km - b.run.distance_km;
    return a.distanceM - b.distanceM;
  });

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const location = useUserLocation();
  const initialCenter = useExploreCenter(location);
  const profile = useSession((s) => s.profile);
  const filters = useExploreFilters();

  const [view, setView] = useState<'map' | 'list'>('map');
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [queryCenter, setQueryCenter] = useState<LatLng | null>(null);
  const center = queryCenter ?? initialCenter;
  const [mapRegion, setMapRegion] = useState<Region>(() => regionForRadius(center, RADIUS_M));

  const mapRef = useRef<AppMapHandle>(null);
  const sheetRef = useRef<BottomSheet>(null);

  const rpcFilters = filters.toRpcParams();
  const query = useQuery({
    queryKey: qk.runsNearby({ ...center, radiusM: RADIUS_M, filters: rpcFilters }),
    queryFn: () => fetchNearbyRuns({ ...center, radiusM: RADIUS_M, filters: rpcFilters }),
  });
  const runs = useMemo(() => query.data ?? [], [query.data]);
  const sorted = useMemo(() => sortRuns(runs, filters.sort), [runs, filters.sort]);
  const selected = runs.find((r) => r.run.id === selectedRunId) ?? null;

  const { clusters, expansionRegion } = useClusters(runs, mapRegion);

  const mapMoved =
    distanceMeters({ lat: mapRegion.latitude, lng: mapRegion.longitude }, center) >
    SEARCH_AREA_THRESHOLD_M;

  const openRun = (id: string) => router.push(`/run/${id}`);

  const selectRun = (id: string) => {
    setSelectedRunId(id);
    sheetRef.current?.snapToIndex(0);
  };
  const closeSheet = () => {
    setSelectedRunId(null);
    sheetRef.current?.close();
  };

  const cycleSort = () => {
    const order = ['nearest', 'soonest', 'distance'] as const;
    filters.setSort(order[(order.indexOf(filters.sort) + 1) % order.length]);
  };

  const activeFilters = filters.activeCount();
  const city = profile?.home_city || 'your city';

  return (
    <View style={styles.screen}>
      {view === 'map' ? (
        <View style={StyleSheet.absoluteFill}>
          <AppMap
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            initialRegion={regionForRadius(center, RADIUS_M)}
            showsUserLocation={location.status === 'granted'}
            onRegionChangeComplete={setMapRegion}
            onPress={closeSheet}
          >
            {clusters.map((feature) => {
              const [lng, lat] = feature.geometry.coordinates;
              const coordinate = { latitude: lat, longitude: lng };
              if ('cluster' in feature.properties && feature.properties.cluster) {
                const clusterId = feature.properties.cluster_id;
                return (
                  <AppMarker
                    key={`cluster-${clusterId}`}
                    coordinate={coordinate}
                    anchor={{ x: 0.5, y: 0.5 }}
                    tracksViewChanges={false}
                    onPress={() =>
                      mapRef.current?.animateToRegion(expansionRegion(clusterId, { lat, lng }), 300)
                    }
                  >
                    <MapPin cluster label={String(feature.properties.point_count ?? '')} />
                  </AppMarker>
                );
              }
              const pin = feature.properties as PinProperties;
              return (
                <AppMarker
                  key={pin.runId}
                  coordinate={coordinate}
                  anchor={{ x: 0.5, y: 1 }}
                  tracksViewChanges={false}
                  onPress={() => selectRun(pin.runId)}
                >
                  <MapPin type={pin.type} label={pin.kmLabel} selected={pin.runId === selectedRunId} />
                </AppMarker>
              );
            })}
          </AppMap>

          {mapMoved ? (
            <View style={[styles.searchArea, { top: insets.top + 158 }]}>
              <Button
                label="Search this area"
                size="sm"
                variant="secondary"
                shape="pill"
                onPress={() => {
                  const c = { lat: mapRegion.latitude, lng: mapRegion.longitude };
                  setQueryCenter(c);
                }}
              />
            </View>
          ) : null}

          <View style={[styles.recenter, { bottom: insets.bottom + spacing.sp10 }]}>
            <IconButton
              round
              accessibilityLabel="Recenter on my location"
              onPress={() => location.coords && mapRef.current?.animateToCoordinate({
                latitude: location.coords.lat,
                longitude: location.coords.lng,
              })}
            >
              <Navigation size={20} />
            </IconButton>
          </View>
        </View>
      ) : null}

      {/* Header overlay: search pill, filters, type chips, map/list toggle */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sp2 }]}>
        <View style={styles.headerRow}>
          <Pressable
            accessibilityRole="button"
            style={styles.searchPill}
            onPress={() => router.push('/explore/search')}
          >
            <Search size={18} color={colors.ink400} />
            <Text numberOfLines={1} style={styles.searchPlaceholder}>
              Search runs in {city}
            </Text>
          </Pressable>
          <View>
            <IconButton accessibilityLabel="Filters" onPress={() => router.push('/explore/filters')}>
              <SlidersHorizontal size={20} />
            </IconButton>
            {activeFilters > 0 ? (
              <View style={styles.filterBadge}>
                <Badge tone="ink" solid>{activeFilters}</Badge>
              </View>
            ) : null}
          </View>
        </View>
        <View style={styles.chipRow}>
          {RUN_TYPES.map((t) => (
            <Pressable key={t} accessibilityRole="button" onPress={() => filters.toggleType(t)}>
              <TypeChip type={t} chipStyle={filters.types.includes(t) ? 'solid' : 'soft'} />
            </Pressable>
          ))}
        </View>
        <Tabs
          variant="pill"
          items={[
            { id: 'map', label: 'Map' },
            { id: 'list', label: 'List' },
          ]}
          value={view}
          onChange={(id) => setView(id as 'map' | 'list')}
        />
        {location.status === 'denied' ? (
          <Pressable
            accessibilityRole="button"
            style={styles.locationBanner}
            onPress={() => Linking.openSettings()}
          >
            <Text style={styles.locationBannerText}>
              Location is off — showing {city}. Enable in Settings.
            </Text>
          </Pressable>
        ) : null}
      </View>

      {view === 'list' ? (
        <FlatList
          style={styles.list}
          contentContainerStyle={[
            styles.listContent,
            { paddingTop: insets.top + 170, paddingBottom: insets.bottom + spacing.sp12 },
          ]}
          data={sorted}
          keyExtractor={(item) => item.run.id}
          refreshControl={
            <RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} />
          }
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <Text style={textStyles.eyebrow}>{sorted.length} RUNS NEAR YOU</Text>
              <Pressable accessibilityRole="button" onPress={cycleSort}>
                <Text style={styles.sortLabel}>SORT: {filters.sort.toUpperCase()}</Text>
              </Pressable>
            </View>
          }
          ListEmptyComponent={
            query.isLoading ? (
              <View style={styles.skeletons}>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={styles.skeleton} />
                ))}
              </View>
            ) : query.isError ? (
              <View style={styles.stateBox}>
                <Text style={textStyles.body}>Couldn&apos;t load runs.</Text>
                <Button label="Retry" size="sm" variant="secondary" onPress={() => query.refetch()} />
              </View>
            ) : (
              <View style={styles.stateBox}>
                <Text style={textStyles.body}>No runs match — widen your filters.</Text>
                <Button label="Clear filters" size="sm" variant="ghost" onPress={filters.clearAll} />
              </View>
            )
          }
          renderItem={({ item }) => (
            <RunCard
              type={item.run.type}
              title={item.run.title}
              goal={item.run.goal || undefined}
              distance={formatKm(item.run.distance_km)}
              pace={item.run.target_pace_s_per_km ? formatPace(item.run.target_pace_s_per_km) : undefined}
              when={formatWhen(item.run.starts_at)}
              city={`${item.run.area_name} · ${item.run.city}`}
              spotsLeft={item.spotsLeft}
              spotsTotal={item.run.max_group}
              closedLoop={item.run.closed_loop}
              onPress={() => openRun(item.run.id)}
            />
          )}
        />
      ) : null}

      {__DEV__ ? (
        <Link href="/dev/components" style={[styles.devLink, { bottom: insets.bottom + spacing.sp2 }]}>
          <Text style={textStyles.caption}>Gallery</Text>
        </Link>
      ) : null}

      {view === 'map' ? (
        <BottomSheet
          ref={sheetRef}
          index={-1}
          snapPoints={[SHEET_HEIGHT]}
          enablePanDownToClose
          onClose={() => setSelectedRunId(null)}
        >
          <BottomSheetView style={styles.sheet}>
            {selected ? (
              <>
                <RunCard
                  variant="compact"
                  type={selected.run.type}
                  title={selected.run.title}
                  distance={formatKm(selected.run.distance_km)}
                  pace={
                    selected.run.target_pace_s_per_km
                      ? formatPace(selected.run.target_pace_s_per_km)
                      : undefined
                  }
                  when={formatWhen(selected.run.starts_at)}
                  spotsLeft={selected.spotsLeft}
                  host={undefined}
                  onPress={() => openRun(selected.run.id)}
                />
                <Text style={textStyles.caption}>{formatAway(selected.distanceM)}</Text>
                <Button label="View run" full onPress={() => openRun(selected.run.id)} />
              </>
            ) : null}
          </BottomSheetView>
        </BottomSheet>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper2 },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: sizing.gutter,
    gap: spacing.sp2,
  },
  headerRow: { flexDirection: 'row', gap: spacing.sp2, alignItems: 'center' },
  searchPill: {
    flex: 1,
    height: sizing.touchMin,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sp2,
    paddingHorizontal: 14,
    backgroundColor: semantic.bgSurface,
    borderRadius: radius.sm,
    borderWidth: borderWidth.mid,
    borderColor: colors.ink200,
    ...shadows.sm,
  },
  searchPlaceholder: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.tSm,
    color: semantic.textMuted,
  },
  filterBadge: { position: 'absolute', top: -6, right: -6 },
  chipRow: { flexDirection: 'row', gap: spacing.sp2 },
  locationBanner: {
    backgroundColor: colors.warnSoft,
    borderRadius: radius.sm,
    paddingVertical: 6,
    paddingHorizontal: spacing.sp3,
  },
  locationBannerText: {
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.tXs,
    color: colors.ink700,
  },
  searchArea: { position: 'absolute', alignSelf: 'center' },
  recenter: { position: 'absolute', right: sizing.gutter },
  list: { flex: 1 },
  listContent: { paddingHorizontal: sizing.gutter, gap: spacing.sp3 },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sortLabel: {
    fontFamily: fonts.displayExtra,
    fontSize: typeScale.tXs,
    color: colors.ink900,
    letterSpacing: 0.5,
  },
  skeletons: { gap: spacing.sp3 },
  skeleton: {
    height: 148,
    borderRadius: radius.md,
    backgroundColor: colors.ink100,
  },
  stateBox: {
    alignItems: 'center',
    gap: spacing.sp3,
    paddingVertical: spacing.sp10,
  },
  sheet: {
    paddingHorizontal: sizing.gutter,
    gap: spacing.sp3,
  },
  devLink: { position: 'absolute', alignSelf: 'center' },
});
