/**
 * Completed-run state of run/[id] (P4 H4) — static track header, YOUR RESULT
 * strip, points-earned card, RAN WITH rows with peer aggregate + rate status.
 */
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { router } from 'expo-router';
import { ArrowLeft, Star } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppMap, AppMarker, AppPolyline } from '@/components/map/AppMap';
import { RouteMarker } from '@/components/map/RouteMarker';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { RatingStars } from '@/components/ui/RatingStars';
import { StatBlock } from '@/components/ui/StatBlock';
import { TypeChip } from '@/components/ui/TypeChip';
import { formatPace } from '@/lib/format';
import { regionForRadius } from '@/lib/geo';
import { decodeTrack } from '@/lib/recording/geo';
import { fetchCrew } from '@/lib/reviews';
import type { RunDetail } from '@/lib/runs';
import { fetchRunAwards } from '@/lib/tracks';
import { supabase } from '@/lib/supabase';
import {
  borderWidth,
  colors,
  fonts,
  letterSpacing,
  radius,
  sizing,
  spacing,
  textStyles,
  tracking,
  typeScale,
} from '@/theme/theme';

export function CompletedRunDetail({ detail }: { detail: RunDetail }) {
  const insets = useSafeAreaInsets();
  const { run } = detail;

  const myTrack = useQuery({
    queryKey: ['run', run.id, 'my-track'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('run_tracks')
        .select('*')
        .eq('run_id', run.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  }).data;

  const awards = useQuery({
    queryKey: ['run', run.id, 'awards'],
    queryFn: () => fetchRunAwards(run.id),
  }).data;

  const crew = useQuery({
    queryKey: ['run', run.id, 'crew'],
    queryFn: () => fetchCrew(run.id),
  }).data;

  const totalPoints = (awards ?? []).reduce((sum, a) => sum + a.points, 0);
  const trackCoords = myTrack ? decodeTrack(myTrack.polyline) : [];

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.sp8 }}>
        <View style={styles.mapHeader}>
          <AppMap
            style={StyleSheet.absoluteFill}
            interactive={false}
            initialRegion={regionForRadius(run.point, myTrack ? 1500 : 900)}
          >
            {trackCoords.length > 1 ? (
              <AppPolyline
                coordinates={trackCoords.map((c) => ({ latitude: c.lat, longitude: c.lng }))}
                strokeColor={colors.ink900}
                strokeWidth={4}
              />
            ) : (
              <AppMarker
                coordinate={{ latitude: run.point.lat, longitude: run.point.lng }}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={false}
              >
                <RouteMarker kind="start" type={run.type} size={26} />
              </AppMarker>
            )}
          </AppMap>
          <View style={[styles.mapButtons, { top: insets.top + spacing.sp2 }]}>
            <IconButton accessibilityLabel="Back" onPress={() => router.back()}>
              <ArrowLeft size={20} />
            </IconButton>
            <View style={styles.completedPill}>
              <Text style={styles.completedPillText}>COMPLETED</Text>
            </View>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.badgeRow}>
            <TypeChip type={run.type} size="sm" />
            <Text style={textStyles.caption}>{format(new Date(run.starts_at), 'EEE d MMM · HH:mm')}</Text>
          </View>
          <Text style={styles.title}>{run.title}</Text>
          <Text style={textStyles.caption}>
            {run.area_name} · {run.city}
          </Text>
          {run.goal ? <Text style={styles.goal}>&ldquo;{run.goal}&rdquo;</Text> : null}

          {myTrack ? (
            <View style={styles.resultCard}>
              <Text style={textStyles.eyebrow}>YOUR RESULT</Text>
              <View style={styles.resultStrip}>
                <StatBlock value={(myTrack.distance_m / 1000).toFixed(2)} label="KM" size="sm" />
                <StatBlock
                  value={`${Math.floor(myTrack.duration_s / 60)}:${String(myTrack.duration_s % 60).padStart(2, '0')}`}
                  label="TIME"
                  size="sm"
                />
                <StatBlock
                  value={formatPace(myTrack.avg_pace_s_per_km).replace(' /km', '')}
                  label="/KM"
                  size="sm"
                />
                <StatBlock value={String(myTrack.elevation_gain_m)} label="D+ M" size="sm" />
              </View>
            </View>
          ) : null}

          {totalPoints > 0 ? (
            <View style={styles.pointsCard}>
              <Text style={styles.pointsValue}>+{totalPoints} pts earned</Text>
              <Text style={styles.pointsCaption}>
                Finishing · distance goal · on time · reviews
              </Text>
            </View>
          ) : null}

          {crew && crew.length > 0 ? (
            <View style={styles.crewSection}>
              <Text style={textStyles.eyebrow}>RAN WITH · {crew.length}</Text>
              {crew.map((member) => (
                <View key={member.user_id} style={styles.crewRow}>
                  <Avatar name={member.display_name} src={member.avatar_url ?? undefined} size="md" />
                  <View style={styles.crewText}>
                    <View style={styles.crewNameRow}>
                      <Text style={styles.crewName}>{member.display_name}</Text>
                      {member.rating_avg != null ? (
                        <View style={styles.peerRating}>
                          <Star size={12} color={colors.star} fill={colors.star} />
                          <Text style={styles.peerRatingValue}>
                            {Number(member.rating_avg).toFixed(1)} ({member.rating_count})
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={textStyles.caption}>{member.isHost ? 'Host' : 'Runner'}</Text>
                  </View>
                  {member.myStars != null ? (
                    <RatingStars value={member.myStars} size={13} />
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      style={styles.rateChip}
                      onPress={() => router.push(`/review/${run.id}`)}
                    >
                      <Text style={styles.rateChipText}>RATE</Text>
                    </Pressable>
                  )}
                </View>
              ))}
            </View>
          ) : null}

          <Button label="DONE" variant="secondary" full onPress={() => router.back()} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper2 },
  mapHeader: { height: 200 },
  mapButtons: {
    position: 'absolute',
    left: sizing.gutter,
    right: sizing.gutter,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  completedPill: {
    backgroundColor: colors.ink900,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sp3,
    height: 30,
    justifyContent: 'center',
  },
  completedPillText: {
    fontFamily: fonts.displayExtra,
    fontSize: typeScale.t2xs,
    letterSpacing: letterSpacing(typeScale.t2xs, tracking.label),
    color: colors.paper,
  },
  body: { paddingHorizontal: sizing.gutter, paddingTop: spacing.sp4, gap: spacing.sp3 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sp2 },
  title: {
    fontFamily: fonts.displayExtra,
    fontSize: typeScale.d2,
    lineHeight: typeScale.d2 * 1.05,
    color: colors.ink900,
    textTransform: 'uppercase',
  },
  goal: {
    fontFamily: fonts.body,
    fontSize: typeScale.tMd,
    lineHeight: typeScale.tMd * 1.45,
    color: colors.ink500,
  },
  resultCard: {
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    borderWidth: borderWidth.hair,
    borderColor: colors.ink200,
    padding: spacing.sp4,
    gap: spacing.sp3,
  },
  resultStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pointsCard: {
    backgroundColor: colors.ink900,
    borderRadius: radius.md,
    padding: spacing.sp4,
    gap: 2,
  },
  pointsValue: {
    fontFamily: fonts.displayExtra,
    fontSize: typeScale.d3,
    color: colors.volt,
  },
  pointsCaption: {
    fontFamily: fonts.body,
    fontSize: typeScale.tXs,
    color: colors.ink400,
  },
  crewSection: { gap: spacing.sp2 },
  crewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sp3,
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    borderWidth: borderWidth.hair,
    borderColor: colors.ink200,
    padding: spacing.sp3,
  },
  crewText: { flex: 1 },
  crewNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sp2 },
  crewName: {
    fontFamily: fonts.bodySemiBold,
    fontSize: typeScale.tMd,
    color: colors.ink900,
  },
  peerRating: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  peerRatingValue: {
    fontFamily: fonts.displaySemiBold,
    fontSize: typeScale.tXs,
    color: colors.ink900,
    fontVariant: ['tabular-nums'],
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
});
