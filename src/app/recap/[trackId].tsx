/**
 * Post-run recap (P4 G2) — dark celebration: animated points ring, stat
 * strip, breakdown, draw-on route card, rate-the-crew funnel.
 */
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Check, Share2 } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedProps,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { RatingStars } from '@/components/ui/RatingStars';
import { StatBlock } from '@/components/ui/StatBlock';
import { formatPace } from '@/lib/format';
import { qk } from '@/lib/queryKeys';
import { decodeTrack } from '@/lib/recording/geo';
import { fetchCrew } from '@/lib/reviews';
import { fetchRunDetail } from '@/lib/runs';
import { fetchRunAwards, fetchTrack, type Award, type CompleteRunResult } from '@/lib/tracks';
import {
  colors,
  fonts,
  letterSpacing,
  radius,
  shadows,
  sizing,
  spacing,
  tracking,
  typeScale,
} from '@/theme/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

const RING_SIZE = 180;
const RING_STROKE = 10;
const RING_R = (RING_SIZE - RING_STROKE) / 2;
const RING_C = 2 * Math.PI * RING_R;

const AWARD_COPY: Record<string, (points: number, km?: number) => string> = {
  finished: (p) => `Finished the run +${p}`,
  distance_goal: (p, km) => `Hit the ${km ?? '—'} km distance +${p}`,
  on_time: (p) => `On time at the start +${p}`,
};

function PointsRing({ total }: { total: number }) {
  const progress = useSharedValue(0);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: 1000, easing: Easing.out(Easing.cubic) });
  }, [progress]);

  useDerivedValue(() => {
    runOnJS(setDisplay)(Math.round(progress.value * total));
  }, [total]);

  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: RING_C * (1 - progress.value),
  }));

  return (
    <View style={styles.ringWrap}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_R}
          stroke={colors.ink700}
          strokeWidth={RING_STROKE}
          fill="none"
        />
        <AnimatedCircle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_R}
          stroke={colors.volt}
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          strokeDasharray={`${RING_C} ${RING_C}`}
          animatedProps={ringProps}
          fill="none"
          transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
        />
      </Svg>
      <View style={styles.ringCenter}>
        <Text style={styles.ringPoints}>+{display}</Text>
        <Text style={styles.ringLabel}>PTS EARNED</Text>
      </View>
    </View>
  );
}

/** Track polyline projected into a local SVG viewBox with draw-on animation. */
function RouteCard({ encoded }: { encoded: string }) {
  const points = useMemo(() => decodeTrack(encoded), [encoded]);
  const draw = useSharedValue(0);

  const { d, length } = useMemo(() => {
    if (points.length < 2) return { d: '', length: 0 };
    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const spanLat = Math.max(maxLat - minLat, 1e-6);
    const spanLng = Math.max(maxLng - minLng, 1e-6);
    const W = 300;
    const H = 160;
    const PAD = 14;
    const sx = (lng: number) => PAD + ((lng - minLng) / spanLng) * (W - 2 * PAD);
    const sy = (lat: number) => H - PAD - ((lat - minLat) / spanLat) * (H - 2 * PAD);
    let path = `M ${sx(points[0].lng).toFixed(1)} ${sy(points[0].lat).toFixed(1)}`;
    let len = 0;
    for (let i = 1; i < points.length; i++) {
      const x1 = sx(points[i - 1].lng);
      const y1 = sy(points[i - 1].lat);
      const x2 = sx(points[i].lng);
      const y2 = sy(points[i].lat);
      len += Math.hypot(x2 - x1, y2 - y1);
      path += ` L ${x2.toFixed(1)} ${y2.toFixed(1)}`;
    }
    return { d: path, length: len };
  }, [points]);

  useEffect(() => {
    draw.value = withDelay(
      1000,
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.cubic) }),
    );
  }, [draw]);

  const pathProps = useAnimatedProps(() => ({
    strokeDashoffset: length * (1 - draw.value),
  }));

  if (!d) return null;
  return (
    <View style={styles.routeCard}>
      <Svg width="100%" height={160} viewBox="0 0 300 160">
        <AnimatedPath
          d={d}
          stroke={colors.ink900}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={`${length} ${length}`}
          animatedProps={pathProps}
          fill="none"
        />
      </Svg>
    </View>
  );
}

export default function RecapScreen() {
  const { trackId, result, runId: runIdParam } = useLocalSearchParams<{
    trackId: string;
    result?: string;
    runId?: string;
  }>();
  const insets = useSafeAreaInsets();

  const passed = useMemo<CompleteRunResult | null>(() => {
    try {
      return result ? (JSON.parse(result) as CompleteRunResult) : null;
    } catch {
      return null;
    }
  }, [result]);

  const track = useQuery({
    queryKey: qk.track(trackId ?? ''),
    queryFn: () => fetchTrack(trackId!),
    enabled: trackId != null,
  }).data;

  const runId = runIdParam ?? track?.run_id ?? null;

  const detail = useQuery({
    queryKey: qk.run(runId ?? 'none'),
    queryFn: () => fetchRunDetail(runId!),
    enabled: runId != null,
  }).data;

  const awardsQuery = useQuery({
    queryKey: qk.runAwards(runId ?? 'none'),
    queryFn: () => fetchRunAwards(runId!),
    enabled: runId != null && passed == null,
  });

  const crewQuery = useQuery({
    queryKey: qk.runCrew(runId ?? 'none'),
    queryFn: () => fetchCrew(runId!),
    enabled: runId != null,
  });

  const awards: Award[] = passed?.awards ?? awardsQuery.data ?? [];
  const nonReview = awards.filter((a) => a.reason !== 'rate_crew');
  const rated = awards.some((a) => a.reason === 'rate_crew');
  const total = nonReview.reduce((sum, a) => sum + a.points, 0) + (rated ? 10 : 0);

  const distanceM = passed?.distance_m ?? track?.distance_m ?? 0;
  const durationS = passed?.duration_s ?? track?.duration_s ?? 0;
  const paceS = passed?.avg_pace_s_per_km ?? track?.avg_pace_s_per_km ?? null;
  const elevation = passed?.elevation_gain_m ?? track?.elevation_gain_m ?? 0;

  const km = (distanceM / 1000).toFixed(2);
  const time = `${Math.floor(durationS / 60)}:${String(durationS % 60).padStart(2, '0')}`;
  const crew = crewQuery.data ?? [];

  const share = () => {
    void Share.share({
      message: `Ran ${km} km in ${time} (${paceS ? formatPace(paceS) : '—'}, +${total} pts) with Run Everywhere — ${detail?.run.title ?? 'a run'}`,
    });
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.sp6, paddingBottom: insets.bottom + spacing.sp8 },
      ]}
    >
      <Text style={styles.eyebrow}>RUN COMPLETE</Text>
      <Text style={styles.hero}>NICE RUN.</Text>
      {detail ? (
        <Text style={styles.caption}>
          {detail.run.title} · {detail.run.area_name}
          {crew.length > 0 ? ` · with ${crew.length} runner${crew.length === 1 ? '' : 's'}` : ''}
        </Text>
      ) : null}

      {awards.length > 0 ? <PointsRing total={total} /> : null}

      <View style={styles.statStrip}>
        <StatBlock value={km} label="KM" accent={colors.paper} />
        <StatBlock value={time} label="TIME" accent={colors.paper} />
        <StatBlock
          value={paceS ? formatPace(paceS).replace(' /km', '') : '—'}
          label="/KM"
          accent={colors.paper}
        />
        <StatBlock value={String(elevation)} label="D+ M" accent={colors.paper} />
      </View>

      {awards.length > 0 ? (
        <View style={styles.breakdown}>
          {nonReview.map((a) => (
            <View key={a.reason} style={styles.breakdownRow}>
              <Text style={styles.breakdownText}>
                {AWARD_COPY[a.reason]?.(a.points, detail?.run.distance_km) ??
                  `${a.reason} +${a.points}`}
              </Text>
              <Check size={16} color={colors.go} strokeWidth={3} />
            </View>
          ))}
          <View style={styles.breakdownRow}>
            <Text style={[styles.breakdownText, !rated && styles.breakdownPending]}>
              Rate the crew +10
            </Text>
            {rated ? (
              <Check size={16} color={colors.go} strokeWidth={3} />
            ) : (
              <View style={styles.pendingDot} />
            )}
          </View>
        </View>
      ) : null}

      {track?.polyline ? <RouteCard encoded={track.polyline} /> : null}

      {crew.length > 0 ? (
        <View style={styles.crewSection}>
          <View style={styles.crewHeader}>
            <Text style={styles.crewTitle}>RATE THE CREW</Text>
            {!rated ? (
              <View style={styles.crewTag}>
                <Text style={styles.crewTagText}>+10 pts</Text>
              </View>
            ) : null}
          </View>
          {crew.map((member) => (
            <Pressable
              key={member.user_id}
              style={styles.crewRow}
              onPress={() => runId && router.push(`/review/${runId}`)}
            >
              <Avatar name={member.display_name} src={member.avatar_url ?? undefined} size="md" />
              <View style={styles.crewText}>
                <Text style={styles.crewName}>{member.display_name}</Text>
                <Text style={styles.crewRole}>{member.isHost ? 'Host' : 'Runner'}</Text>
              </View>
              {member.myStars != null ? (
                <RatingStars value={member.myStars} size={13} />
              ) : (
                <View style={styles.rateChip}>
                  <Text style={styles.rateChipText}>RATE</Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.footer}>
        <IconButton variant="ghost" accessibilityLabel="Share" onPress={share}>
          <Share2 size={20} color={colors.paper} />
        </IconButton>
        <View style={styles.saveButton}>
          <Button
            label="SAVE RUN"
            full
            onPress={() => (runId ? router.replace(`/run/${runId}`) : router.replace('/(tabs)'))}
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink900 },
  content: {
    paddingHorizontal: sizing.gutter,
    gap: spacing.sp5,
  },
  eyebrow: {
    fontFamily: fonts.displaySemiBold,
    fontSize: typeScale.dEyebrow,
    letterSpacing: letterSpacing(typeScale.dEyebrow, tracking.label),
    color: colors.go,
  },
  hero: {
    fontFamily: fonts.displayBlack,
    fontSize: 52,
    lineHeight: 54,
    color: colors.paper,
    letterSpacing: letterSpacing(52, tracking.tight),
    marginTop: -spacing.sp3,
  },
  caption: {
    fontFamily: fonts.body,
    fontSize: typeScale.tSm,
    color: colors.ink400,
    marginTop: -spacing.sp3,
  },
  ringWrap: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCenter: {
    position: 'absolute',
    alignItems: 'center',
  },
  ringPoints: {
    fontFamily: fonts.displayBlack,
    fontSize: 44,
    color: colors.volt,
    fontVariant: ['tabular-nums'],
  },
  ringLabel: {
    fontFamily: fonts.displaySemiBold,
    fontSize: typeScale.t2xs,
    letterSpacing: letterSpacing(typeScale.t2xs, tracking.label),
    color: colors.ink400,
  },
  statStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  breakdown: {
    backgroundColor: colors.ink800,
    borderRadius: radius.md,
    padding: spacing.sp4,
    gap: spacing.sp3,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  breakdownText: {
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.tSm,
    color: colors.paper,
  },
  breakdownPending: { color: colors.ink500 },
  pendingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.ink500,
  },
  routeCard: {
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    padding: spacing.sp2,
    ...shadows.md,
  },
  crewSection: {
    gap: spacing.sp3,
  },
  crewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sp2,
  },
  crewTitle: {
    fontFamily: fonts.display,
    fontSize: typeScale.d3,
    color: colors.paper,
    letterSpacing: letterSpacing(typeScale.d3, tracking.caps),
  },
  crewTag: {
    backgroundColor: colors.volt,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sp2,
    paddingVertical: 2,
  },
  crewTagText: {
    fontFamily: fonts.displayExtra,
    fontSize: typeScale.t2xs,
    color: colors.voltInk,
  },
  crewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sp3,
    backgroundColor: colors.ink800,
    borderRadius: radius.md,
    padding: spacing.sp3,
  },
  crewText: { flex: 1, gap: 1 },
  crewName: {
    fontFamily: fonts.bodySemiBold,
    fontSize: typeScale.tMd,
    color: colors.paper,
  },
  crewRole: {
    fontFamily: fonts.body,
    fontSize: typeScale.tXs,
    color: colors.ink400,
  },
  rateChip: {
    backgroundColor: colors.volt,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sp4,
    paddingVertical: 6,
  },
  rateChipText: {
    fontFamily: fonts.displayExtra,
    fontSize: typeScale.tXs,
    color: colors.voltInk,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sp3,
  },
  saveButton: { flex: 1 },
});
