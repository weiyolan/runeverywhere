/**
 * Run detail (P2 H2) — the core discovery → join surface with the CTA state
 * machine. Exactly one primary action at a time.
 */
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Repeat, Share2, Star } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppMap, AppMarker } from '@/components/map/AppMap';
import { RouteMarker } from '@/components/map/RouteMarker';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { StatBlock } from '@/components/ui/StatBlock';
import { TypeChip } from '@/components/ui/TypeChip';
import { useOpenDm } from '@/hooks/useOpenDm';
import { formatPace, spotsLeft as spotsLeftOf } from '@/lib/format';
import { regionForRadius } from '@/lib/geo';
import { useRefetchOnFocus } from '@/lib/queryFocus';
import { qk } from '@/lib/queryKeys';
import { useCancelJoin, useJoinRun } from '@/lib/runMutations';
import { fetchRunDetail, fetchRunMembers, RunNotFoundError } from '@/lib/runs';
import { shareRunInvite } from '@/lib/share';
import { useSession } from '@/stores/session';
import {
  borderWidth,
  colors,
  fonts,
  radius,
  runType,
  semantic,
  sizing,
  spacing,
  textStyles,
  typeScale,
} from '@/theme/theme';

function StatePanel({ tone, title, caption }: { tone: 'go' | 'warn' | 'muted' | 'danger'; title: string; caption?: string }) {
  const bg = { go: colors.goSoft, warn: colors.warnSoft, muted: colors.ink100, danger: colors.dangerSoft }[tone];
  const fg = { go: colors.go, warn: colors.warn, muted: colors.ink500, danger: colors.danger }[tone];
  return (
    <View style={[styles.panel, { backgroundColor: bg }]}>
      <Text style={[styles.panelTitle, { color: fg }]}>{title}</Text>
      {caption ? <Text style={styles.panelCaption}>{caption}</Text> : null}
    </View>
  );
}

export default function RunDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id, code } = useLocalSearchParams<{ id: string; code?: string }>();
  const uid = useSession((s) => s.session?.user.id);
  const [now] = useState(() => Date.now());

  const query = useQuery({
    queryKey: qk.run(id),
    queryFn: () => fetchRunDetail(id, code),
    retry: (count, error) => error.name !== 'RunNotFoundError' && count < 2,
  });
  useRefetchOnFocus([qk.run(id)]);

  const detail = query.data;
  const isHost = Boolean(detail && uid && detail.run.host_id === uid);
  const { openDm, openingFor } = useOpenDm();
  const isApproved = detail?.myMembership?.status === 'approved';

  const membersQuery = useQuery({
    queryKey: qk.runMembers(id),
    queryFn: () => fetchRunMembers(id),
    enabled: Boolean(detail) && (isHost || isApproved),
  });

  const join = useJoinRun(id);
  const cancel = useCancelJoin(id);

  if (query.isError) {
    const notFound = query.error instanceof RunNotFoundError;
    return (
      <View style={[styles.stateScreen, { paddingTop: insets.top + spacing.sp12 }]}>
        <Text style={textStyles.body}>
          {notFound ? 'This run is no longer available.' : 'Couldn\u2019t load this run.'}
        </Text>
        {notFound ? (
          <Button label="Back" variant="secondary" onPress={() => router.back()} />
        ) : (
          <Button label="Retry" variant="secondary" onPress={() => query.refetch()} />
        )}
      </View>
    );
  }
  if (!detail) {
    return (
      <View style={[styles.stateScreen, { paddingTop: insets.top + spacing.sp12 }]}>
        <View style={styles.skeletonMap} />
        <View style={styles.skeletonLine} />
        <View style={[styles.skeletonLine, { width: '60%' }]} />
      </View>
    );
  }

  const { run, host, approvedCount, myMembership } = detail;
  const t = runType[run.type];
  const starts = new Date(run.starts_at);
  const started = starts.getTime() < now;
  const spots = spotsLeftOf(run.max_group, approvedCount);
  const full = spots <= 0;
  const members = membersQuery.data ?? [];
  const approvedMembers = members.filter((m) => m.status === 'approved');
  const pendingCount = members.filter((m) => m.status === 'pending').length;
  const canShare = isHost || isApproved;

  const share = () => shareRunInvite(run);

  const joinDirectly = () =>
    join.mutate('', {
      onError: (e) => Alert.alert('Couldn’t join', e instanceof Error ? e.message : 'Try again.'),
    });

  const confirmCancelSpot = () =>
    Alert.alert('Cancel your spot?', 'The host and crew will see you dropped out.', [
      { text: 'Keep my spot', style: 'cancel' },
      { text: 'Cancel spot', style: 'destructive', onPress: () => cancel.mutate() },
    ]);

  const footer = (() => {
    if (run.status === 'cancelled')
      return <StatePanel tone="danger" title="This run was cancelled by the host." />;
    if (run.status === 'completed' || started)
      return <StatePanel tone="muted" title="This run has already started." />;
    if (isHost)
      return (
        <View style={styles.hostFooter}>
          <View style={styles.hostFooterButton}>
            <Button label="Manage run" variant="secondary" full onPress={() => router.push(`/run/${id}/manage`)} />
          </View>
          {pendingCount > 0 ? (
            <Pressable accessibilityRole="button" onPress={() => router.push(`/run/${id}/requests`)}>
              <Badge tone="warn">{pendingCount} requests</Badge>
            </Pressable>
          ) : null}
        </View>
      );
    if (myMembership?.status === 'approved')
      return (
        <View style={styles.footerStack}>
          <StatePanel tone="go" title="YOU'RE IN — see you at the start." />
          <Button label="Cancel my spot" variant="ghost" full onPress={confirmCancelSpot} />
        </View>
      );
    if (myMembership?.status === 'pending')
      return (
        <View style={styles.footerStack}>
          <StatePanel
            tone="warn"
            title="REQUEST SENT"
            caption={`${host?.display_name ?? 'The host'} will review your request. You'll see it here the moment they decide.`}
          />
          <Button label="Withdraw request" variant="ghost" full onPress={() => cancel.mutate()} />
        </View>
      );
    if (myMembership?.status === 'removed')
      return <StatePanel tone="muted" title="The host removed you from this run." />;

    const declinedCaption =
      myMembership?.status === 'declined' ? (
        <Text style={textStyles.caption}>Your request wasn&apos;t accepted this time.</Text>
      ) : null;
    if (full)
      return (
        <View style={styles.footerStack}>
          {declinedCaption}
          <Button label="Full" full disabled />
        </View>
      );
    if (run.visibility === 'approval')
      return (
        <View style={styles.footerStack}>
          {declinedCaption}
          <Button label="Request to join" full onPress={() => router.push(`/run/${id}/request`)} />
        </View>
      );
    return (
      <View style={styles.footerStack}>
        {declinedCaption}
        <Button
          label={join.isPending ? 'Joining…' : 'Join run'}
          full
          disabled={join.isPending}
          onPress={joinDirectly}
        />
      </View>
    );
  })();

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 + insets.bottom }}
        refreshControl={
          <RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} />
        }
      >
        <View style={styles.mapHeader}>
          <AppMap
            style={StyleSheet.absoluteFill}
            interactive={false}
            initialRegion={regionForRadius(run.point, 900)}
          >
            <AppMarker
              coordinate={{ latitude: run.point.lat, longitude: run.point.lng }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
            >
              <RouteMarker kind="start" type={run.type} size={26} />
            </AppMarker>
          </AppMap>
          <View style={[styles.mapButtons, { top: insets.top + spacing.sp2 }]}>
            <IconButton accessibilityLabel="Back" onPress={() => router.back()}>
              <ArrowLeft size={20} />
            </IconButton>
            {canShare ? (
              <IconButton accessibilityLabel="Share invite link" onPress={share}>
                <Share2 size={20} />
              </IconButton>
            ) : null}
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.badgeRow}>
            <TypeChip type={run.type} size="sm" />
            {run.visibility === 'invite' ? <Badge tone="ink">Invite only</Badge> : null}
            {run.visibility === 'open' ? <Badge tone="go">Open</Badge> : null}
            {run.closed_loop ? (
              <View accessibilityLabel="Closed loop">
                <Repeat size={18} color={t.main} />
              </View>
            ) : null}
          </View>

          <Text style={styles.title}>{run.title}</Text>
          <Text style={textStyles.caption}>
            {run.area_name} · {run.city}
          </Text>
          {run.goal ? <Text style={styles.goal}>“{run.goal}”</Text> : null}

          <View style={styles.statsRow}>
            <StatBlock value={run.distance_km} unit="km" label="Distance" size="sm" align="left" />
            {run.target_pace_s_per_km ? (
              <StatBlock
                value={formatPace(run.target_pace_s_per_km).replace(' /km', '')}
                unit="/km"
                label="Pace"
                size="sm"
                align="left"
              />
            ) : null}
            <StatBlock value={format(starts, 'EEE')} label="Day" size="sm" align="left" />
            <StatBlock value={format(starts, 'HH:mm')} label="Time" size="sm" align="left" />
          </View>

          <Badge tone="volt" solid>+{run.points_reward} PTS</Badge>

          <View style={styles.hostCard}>
            <Avatar src={host?.avatar_url} name={host?.display_name ?? undefined} size="md" />
            <View style={styles.hostText}>
              <Text style={textStyles.eyebrow}>HOSTS THIS RUN</Text>
              <View style={styles.hostNameRow}>
                <Text style={styles.hostName}>{host?.display_name || 'Host'}</Text>
                {host?.rating_avg != null ? (
                  <View style={styles.rating}>
                    <Star size={12} color={colors.star} fill={colors.star} />
                    <Text style={styles.ratingValue}>{Number(host.rating_avg).toFixed(1)}</Text>
                  </View>
                ) : null}
              </View>
            </View>
            {isApproved && !isHost ? (
              <Button
                label={openingFor ? 'OPENING…' : 'MESSAGE'}
                size="sm"
                variant="ghost"
                disabled={openingFor != null}
                onPress={() => void openDm(run.host_id)}
              />
            ) : null}
          </View>

          <View style={styles.capacityRow}>
            <Text style={styles.going}>GOING · {approvedCount + 1}</Text>
            {full ? <Badge>Full</Badge> : <Badge tone="warn">{spots} spots left</Badge>}
          </View>
          {(isHost || isApproved) && approvedMembers.length ? (
            <View style={styles.avatarStrip}>
              {approvedMembers.map((m) => (
                <Avatar
                  key={m.user_id}
                  src={m.profile?.avatar_url}
                  name={m.profile?.display_name}
                  size="sm"
                />
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sp4 }]}>{footer}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper2 },
  stateScreen: {
    flex: 1,
    backgroundColor: colors.paper2,
    alignItems: 'center',
    gap: spacing.sp4,
    paddingHorizontal: sizing.gutter,
  },
  skeletonMap: { alignSelf: 'stretch', height: 180, borderRadius: radius.md, backgroundColor: colors.ink100 },
  skeletonLine: { alignSelf: 'stretch', height: 28, borderRadius: radius.xs, backgroundColor: colors.ink100 },
  mapHeader: { height: 180 },
  mapButtons: {
    position: 'absolute',
    left: sizing.gutter,
    right: sizing.gutter,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  body: { paddingHorizontal: sizing.gutter, paddingTop: spacing.sp4, gap: spacing.sp3 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sp2 },
  title: {
    fontFamily: fonts.displayExtra,
    fontSize: typeScale.d2,
    lineHeight: typeScale.d2 * 1.05,
    color: semantic.textPrimary,
    textTransform: 'uppercase',
  },
  goal: {
    fontFamily: fonts.body,
    fontSize: typeScale.tMd,
    lineHeight: typeScale.tMd * 1.45,
    color: semantic.textSecondary,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: semantic.bgSurface,
    borderRadius: radius.md,
    borderWidth: borderWidth.hair,
    borderColor: colors.ink200,
    padding: spacing.sp4,
  },
  hostCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sp3,
    backgroundColor: semantic.bgSurface,
    borderRadius: radius.md,
    borderWidth: borderWidth.hair,
    borderColor: colors.ink200,
    padding: spacing.sp4,
  },
  hostText: { gap: 2 },
  hostNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sp2 },
  hostName: {
    fontFamily: fonts.bodySemiBold,
    fontSize: typeScale.tMd,
    color: semantic.textPrimary,
  },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingValue: {
    fontFamily: fonts.displaySemiBold,
    fontSize: typeScale.tSm,
    color: semantic.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  capacityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sp3 },
  going: {
    fontFamily: fonts.displayExtra,
    fontSize: typeScale.tSm,
    color: semantic.textPrimary,
    letterSpacing: 0.5,
  },
  avatarStrip: { flexDirection: 'row', gap: spacing.sp1 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: sizing.gutter,
    paddingTop: spacing.sp3,
    backgroundColor: colors.paper2,
    borderTopWidth: borderWidth.hair,
    borderTopColor: colors.ink200,
  },
  footerStack: { gap: spacing.sp2 },
  hostFooter: { flexDirection: 'row', alignItems: 'center', gap: spacing.sp2 },
  hostFooterButton: { flex: 1 },
  panel: { borderRadius: radius.md, padding: spacing.sp4, gap: 4 },
  panelTitle: {
    fontFamily: fonts.displayExtra,
    fontSize: typeScale.tSm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  panelCaption: {
    fontFamily: fonts.body,
    fontSize: typeScale.tSm,
    lineHeight: typeScale.tSm * 1.45,
    color: semantic.textSecondary,
  },
});
