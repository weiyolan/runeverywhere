/**
 * Explore filters (P2 F3) — modal editing a local copy of the D6 store;
 * SHOW RUNS commits, back/CANCEL discards. Filters map 1:1 to
 * runs_within_radius params (design's PACE/DISTANCE chips dropped —
 * Decisions #6).
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { TypeChip } from '@/components/ui/TypeChip';
import {
  useExploreFilters,
  type ExploreRoute,
  type ExploreSort,
  type ExploreWhen,
} from '@/stores/exploreFilters';
import {
  borderWidth,
  colors,
  fonts,
  radius,
  sizing,
  spacing,
  textStyles,
  typeScale,
  type RunType,
} from '@/theme/theme';

const RUN_TYPES: RunType[] = ['discover', 'challenge', 'social'];
const WHEN_OPTIONS: { value: ExploreWhen; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'weekend', label: 'Weekend' },
];
const ROUTE_OPTIONS: { value: ExploreRoute; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 'open', label: 'Open route' },
  { value: 'closed', label: 'Closed loop' },
];

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export default function ExploreFiltersScreen() {
  const insets = useSafeAreaInsets();
  const store = useExploreFilters();

  // Local copy — commit on SHOW RUNS, discard on back (F3)
  const [types, setTypes] = useState<RunType[]>(store.types);
  const [when, setWhen] = useState<ExploreWhen>(store.when);
  const [route, setRoute] = useState<ExploreRoute>(store.route);
  const [onlyOpenSpots, setOnlyOpenSpots] = useState(store.onlyOpenSpots);
  const [sort, setSort] = useState<ExploreSort>(store.sort);

  const toggleType = (t: RunType) =>
    setTypes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  const clearAll = () => {
    setTypes([]);
    setWhen('any');
    setRoute('any');
    setOnlyOpenSpots(false);
    setSort('nearest');
  };

  const apply = () => {
    store.setTypes(types);
    store.setWhen(when);
    store.setRoute(route);
    store.setOnlyOpenSpots(onlyOpenSpots);
    store.setSort(sort);
    router.back();
  };

  return (
    <View style={[styles.screen, { paddingBottom: insets.bottom + spacing.sp4 }]}>
      <View style={styles.header}>
        <Text style={textStyles.sectionHeader}>Filters</Text>
        <Pressable accessibilityRole="button" onPress={clearAll}>
          <Text style={styles.clearAll}>CLEAR ALL</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={textStyles.eyebrow}>RUN TYPE</Text>
        <View style={styles.chipRow}>
          {RUN_TYPES.map((t) => (
            <Pressable key={t} accessibilityRole="button" onPress={() => toggleType(t)}>
              <TypeChip type={t} chipStyle={types.includes(t) ? 'solid' : 'soft'} />
            </Pressable>
          ))}
        </View>

        <Text style={textStyles.eyebrow}>WHEN</Text>
        <View style={styles.chipRow}>
          {WHEN_OPTIONS.map((o) => (
            <Chip key={o.value} label={o.label} selected={when === o.value} onPress={() => setWhen(o.value)} />
          ))}
        </View>

        <Text style={textStyles.eyebrow}>ROUTE</Text>
        <View style={styles.chipRow}>
          {ROUTE_OPTIONS.map((o) => (
            <Chip key={o.value} label={o.label} selected={route === o.value} onPress={() => setRoute(o.value)} />
          ))}
        </View>

        <Text style={textStyles.eyebrow}>SPOTS</Text>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Only runs with open spots</Text>
          <Switch
            value={onlyOpenSpots}
            onValueChange={setOnlyOpenSpots}
            trackColor={{ true: colors.volt, false: colors.ink200 }}
            thumbColor={colors.paper}
          />
        </View>

        <Text style={textStyles.eyebrow}>SORT BY</Text>
        <Tabs
          variant="pill"
          items={[
            { id: 'nearest', label: 'Nearest' },
            { id: 'soonest', label: 'Soonest' },
            { id: 'distance', label: 'Distance' },
          ]}
          value={sort}
          onChange={(id) => setSort(id as ExploreSort)}
        />
      </ScrollView>

      <View style={styles.footer}>
        <Button label="Show runs" full onPress={apply} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper2, paddingTop: spacing.sp5 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: sizing.gutter,
    paddingBottom: spacing.sp3,
  },
  clearAll: {
    fontFamily: fonts.displayExtra,
    fontSize: typeScale.tXs,
    color: colors.ink500,
    letterSpacing: 0.5,
  },
  body: { paddingHorizontal: sizing.gutter, gap: spacing.sp3, paddingBottom: spacing.sp8 },
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
  chipSelected: {
    backgroundColor: colors.ink900,
    borderColor: colors.ink900,
  },
  chipText: {
    fontFamily: fonts.display,
    fontSize: typeScale.tXs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: colors.ink700,
  },
  chipTextSelected: { color: colors.paper },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    borderWidth: borderWidth.hair,
    borderColor: colors.ink200,
    paddingHorizontal: spacing.sp4,
    paddingVertical: spacing.sp3,
  },
  switchLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.tSm,
    color: colors.ink900,
  },
  footer: { paddingHorizontal: sizing.gutter, paddingTop: spacing.sp3 },
});
