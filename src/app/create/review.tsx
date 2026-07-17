/**
 * Create step 4/4 (P2 G6) — review, server-authoritative points preview,
 * publish, and the in-route published-success state.
 */
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { WizardHeader } from '@/components/create/WizardHeader';
import { AppMap, AppMarker } from '@/components/map/AppMap';
import { RouteMarker } from '@/components/map/RouteMarker';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { TypeChip } from '@/components/ui/TypeChip';
import { formatKm, formatPace, formatWhen } from '@/lib/format';
import { regionForRadius } from '@/lib/geo';
import { qk } from '@/lib/queryKeys';
import { useCreateRun } from '@/lib/runMutations';
import { fetchPointsPreview } from '@/lib/runs';
import { publishSchema } from '@/lib/validation/run';
import { useCreateRunDraft } from '@/stores/createRun';
import {
  borderWidth,
  colors,
  fonts,
  radius,
  semantic,
  sizing,
  spacing,
  textStyles,
  typeScale,
} from '@/theme/theme';

const VISIBILITY_LABEL = { open: 'OPEN', approval: 'APPROVAL', invite: 'INVITE ONLY' } as const;

export default function CreateReviewScreen() {
  const insets = useSafeAreaInsets();
  const draft = useCreateRunDraft();
  const publish = useCreateRun();
  const [publishedRunId, setPublishedRunId] = useState<string | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);

  const type = draft.type ?? 'discover';
  const pointsQuery = useQuery({
    queryKey: qk.pointsPreview(draft.distance_km, type),
    queryFn: () => fetchPointsPreview(draft.distance_km, type),
  });

  const onPublish = () => {
    const parsed = publishSchema.safeParse(draft);
    if (!parsed.success) {
      setDraftError(parsed.error.issues[0]?.message ?? 'Check your run details.');
      return;
    }
    setDraftError(null);
    publish.mutate(parsed.data, { onSuccess: (run) => setPublishedRunId(run.id) });
  };

  if (publishedRunId) {
    const viewRun = () => {
      draft.reset();
      router.dismissAll();
      router.replace(`/run/${publishedRunId}`);
    };
    const done = () => {
      draft.reset();
      router.dismissAll();
    };
    return (
      <View style={[styles.success, { paddingTop: insets.top + spacing.sp12, paddingBottom: insets.bottom + spacing.sp6 }]}>
        <View style={styles.successBody}>
          <View style={styles.check}>
            <Check size={40} color={colors.voltInk} strokeWidth={3} />
          </View>
          <Text style={styles.successTitle}>Your run is live</Text>
          <Text style={styles.successSub}>
            It&apos;s on the {draft.city || 'city'} map and in Managed by you. We&apos;ll ping you
            the moment someone asks to join.
          </Text>
          <View style={styles.successStats}>
            <Badge tone="volt" solid>{formatKm(draft.distance_km)}</Badge>
            {draft.target_pace_s_per_km ? (
              <Badge tone="volt" solid>{formatPace(draft.target_pace_s_per_km)}</Badge>
            ) : null}
            {draft.starts_at ? <Badge tone="volt" solid>{formatWhen(draft.starts_at)}</Badge> : null}
          </View>
        </View>
        <View style={styles.successActions}>
          <Button label="View run" full onPress={viewRun} />
          <Button label="Done" variant="volt-outline" full onPress={done} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.headerWrap}>
        <WizardHeader step={4} title="Review & publish" />
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        {draft.point ? (
          <View style={styles.mapPreview}>
            <AppMap
              style={StyleSheet.absoluteFill}
              interactive={false}
              initialRegion={regionForRadius(draft.point, 900)}
            >
              <AppMarker
                coordinate={{ latitude: draft.point.lat, longitude: draft.point.lng }}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={false}
              >
                <RouteMarker kind="start" type={type} size={26} />
              </AppMarker>
            </AppMap>
          </View>
        ) : null}

        <View style={styles.summary}>
          <View style={styles.summaryHeader}>
            <TypeChip type={type} size="sm" />
            <Badge tone={draft.visibility === 'invite' ? 'ink' : draft.visibility === 'open' ? 'go' : 'neutral'}>
              {VISIBILITY_LABEL[draft.visibility]}
            </Badge>
          </View>
          <Text style={textStyles.cardTitle}>{draft.title}</Text>
          <Text style={textStyles.caption}>
            {draft.area_name}
            {draft.city ? ` · ${draft.city}` : ''}
          </Text>
          {draft.goal ? <Text style={styles.goal}>“{draft.goal}”</Text> : null}
          <View style={styles.statsRow}>
            <Text style={styles.stat}>{formatKm(draft.distance_km)}</Text>
            {draft.target_pace_s_per_km ? (
              <Text style={styles.stat}>· {formatPace(draft.target_pace_s_per_km)}</Text>
            ) : null}
            {draft.starts_at ? <Text style={styles.stat}>· {formatWhen(draft.starts_at)}</Text> : null}
            <Text style={styles.stat}>· {draft.max_group} ppl</Text>
            {draft.closed_loop ? <Text style={styles.stat}>· loop</Text> : null}
          </View>
          <Badge tone="volt" solid>
            +{pointsQuery.data ?? '…'} PTS TO FINISHERS
          </Badge>
        </View>

        <Button
          label="Edit details"
          variant="ghost"
          size="sm"
          full
          onPress={() => router.back()}
        />
        {draftError ? <Text style={styles.error}>{draftError}</Text> : null}
        {publish.isError ? (
          <Text style={styles.error}>
            {publish.error instanceof Error ? publish.error.message : 'Publishing failed — try again.'}
          </Text>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sp4 }]}>
        <Button
          label={publish.isPending ? 'Publishing…' : 'Publish run'}
          full
          disabled={publish.isPending}
          onPress={onPublish}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper2 },
  headerWrap: { paddingHorizontal: sizing.gutter, paddingBottom: spacing.sp3 },
  body: { paddingHorizontal: sizing.gutter, gap: spacing.sp3, paddingBottom: spacing.sp8 },
  mapPreview: {
    height: 160,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: borderWidth.hair,
    borderColor: colors.ink200,
  },
  summary: {
    backgroundColor: semantic.bgSurface,
    borderRadius: radius.md,
    borderWidth: borderWidth.hair,
    borderColor: colors.ink200,
    padding: spacing.sp4,
    gap: spacing.sp2,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goal: {
    fontFamily: fonts.body,
    fontSize: typeScale.tSm,
    lineHeight: typeScale.tSm * 1.45,
    color: semantic.textSecondary,
  },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  stat: {
    fontFamily: fonts.displaySemiBold,
    fontSize: typeScale.tSm,
    color: semantic.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  error: {
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.tSm,
    color: colors.danger,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: sizing.gutter,
    paddingTop: spacing.sp3,
    backgroundColor: colors.paper2,
  },
  // Published success (ink hero, mirrors P1's finish pattern)
  success: {
    flex: 1,
    backgroundColor: colors.ink900,
    paddingHorizontal: sizing.gutter,
    justifyContent: 'space-between',
  },
  successBody: { alignItems: 'center', gap: spacing.sp4 },
  check: {
    width: 84,
    height: 84,
    borderRadius: radius.pill,
    backgroundColor: colors.volt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontFamily: fonts.displayExtra,
    fontSize: typeScale.d1,
    color: colors.paper,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  successSub: {
    fontFamily: fonts.body,
    fontSize: typeScale.tMd,
    lineHeight: typeScale.tMd * 1.45,
    color: colors.ink300,
    textAlign: 'center',
  },
  successStats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sp2, justifyContent: 'center' },
  successActions: { gap: spacing.sp3 },
});
