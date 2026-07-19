/**
 * My Profile (P5 E3) — dark header, stats card, level card, running style,
 * badges preview, "Other runners say".
 */
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ChevronRight, Pencil, Settings } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BadgeTile } from '@/components/BadgeTile';
import { Avatar } from '@/components/ui/Avatar';
import { IconButton } from '@/components/ui/IconButton';
import { RatingStars } from '@/components/ui/RatingStars';
import { StatBlock } from '@/components/ui/StatBlock';
import { TypeChip } from '@/components/ui/TypeChip';
import {
  fetchBadges,
  fetchLevels,
  fetchProfileStats,
  fetchReviews,
} from '@/lib/profile';
import { qk } from '@/lib/queryKeys';
import { useSession } from '@/stores/session';
import {
  borderWidth,
  colors,
  fonts,
  letterSpacing,
  radius,
  shadows,
  sizing,
  spacing,
  textStyles,
  tracking,
  typeScale,
} from '@/theme/theme';

const PACE_COPY: Record<string, string> = {
  easy: 'Easy · 6:30+ /km',
  steady: 'Steady · 5:30–6:30 /km',
  quick: 'Quick · 4:45–5:30 /km',
  fast: 'Fast · sub 4:45 /km',
};
const DISTANCE_COPY: Record<string, string> = {
  short: 'Short · up to 5K',
  mid: 'Mid · 5–10K',
  long: 'Long · 10K–half',
  ultra: 'Ultra · beyond half',
};

const fmtStat = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)));

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const profile = useSession((s) => s.profile);
  const uid = profile?.id;

  const stats = useQuery({
    queryKey: qk.profileStats(uid ?? ''),
    queryFn: () => fetchProfileStats(uid!),
    enabled: uid != null,
  }).data;

  const badges = useQuery({
    queryKey: qk.badges(uid ?? ''),
    queryFn: () => fetchBadges(uid!),
    enabled: uid != null,
  }).data;

  const reviews = useQuery({
    queryKey: qk.reviews(uid ?? ''),
    queryFn: () => fetchReviews(uid!),
    enabled: uid != null,
  }).data;

  const levels = useQuery({
    queryKey: qk.levels(),
    queryFn: fetchLevels,
    staleTime: Infinity,
  }).data;

  if (!profile) return null;

  const level = levels?.find((l) => l.level === profile.level);
  const next = levels?.find((l) => l.level === profile.level + 1);
  const earned = (badges ?? []).filter((b) => b.earned_at != null);
  const previewBadges = [...(badges ?? [])].sort(
    (a, b) => Number(b.earned_at != null) - Number(a.earned_at != null) || a.sort - b.sort,
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: insets.bottom + spacing.sp16 }}>
      {/* Dark header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sp4 }]}>
        <View style={styles.headerButtons}>
          <IconButton
            variant="ghost"
            accessibilityLabel="Edit profile"
            onPress={() => router.push('/settings/edit-profile')}
          >
            <Pencil size={20} color={colors.paper} />
          </IconButton>
          <IconButton
            variant="ghost"
            accessibilityLabel="Settings"
            onPress={() => router.push('/settings')}
          >
            <Settings size={20} color={colors.paper} />
          </IconButton>
        </View>
        <Avatar name={profile.display_name} src={profile.avatar_url ?? undefined} size="xl" />
        <Text style={styles.name}>{profile.display_name}</Text>
        {profile.home_city ? <Text style={styles.city}>{profile.home_city}</Text> : null}
        {profile.rating_avg != null ? (
          <View style={styles.ratingRow}>
            <RatingStars value={Number(profile.rating_avg)} size={14} showValue count={profile.rating_count} />
          </View>
        ) : null}
      </View>

      {/* Stats card overlapping the header */}
      <View style={styles.statsCard}>
        <StatBlock value={stats ? fmtStat(Number(stats.total_km)) : '—'} label="KM" />
        <StatBlock value={stats ? String(stats.runs_count) : '—'} label="RUNS" />
        <StatBlock value={stats ? fmtStat(Number(stats.total_dplus)) : '—'} label="D+ M" />
      </View>

      <View style={styles.body}>
        {/* Level card */}
        <Pressable style={styles.levelCard} onPress={() => router.push('/rewards')}>
          <View style={styles.levelRing}>
            <Text style={styles.levelNumber}>{profile.level}</Text>
          </View>
          <View style={styles.levelText}>
            <Text style={styles.levelTitle}>{level?.title || `Level ${profile.level}`}</Text>
            <Text style={textStyles.caption}>
              {profile.points_total} pts
              {next ? ` · ${next.min_points - profile.points_total} to ${next.title}` : ' · top level'}
            </Text>
          </View>
          <ChevronRight size={20} color={colors.ink400} />
        </Pressable>

        {/* Running style */}
        <View style={styles.card}>
          <Text style={textStyles.eyebrow}>RUNNING STYLE</Text>
          {profile.pace_band ? (
            <Text style={styles.styleLine}>{PACE_COPY[profile.pace_band]}</Text>
          ) : null}
          {profile.distance_band ? (
            <Text style={styles.styleLine}>{DISTANCE_COPY[profile.distance_band]}</Text>
          ) : null}
          {profile.like_types.length > 0 ? (
            <View style={styles.likesRow}>
              {profile.like_types.map((t) => (
                <TypeChip key={t} type={t} size="sm" />
              ))}
            </View>
          ) : null}
          {profile.languages.length > 0 ? (
            <Text style={textStyles.caption}>Speaks {profile.languages.join(' · ')}</Text>
          ) : null}
        </View>

        {profile.bio ? <Text style={textStyles.body}>{profile.bio}</Text> : null}

        {/* Badges preview */}
        <Pressable onPress={() => router.push('/rewards')}>
          <View style={styles.sectionHeaderRow}>
            <Text style={textStyles.sectionHeader}>Badges</Text>
            <Text style={textStyles.caption}>
              {earned.length} / {(badges ?? []).length} earned
            </Text>
          </View>
          <View style={styles.badgeRow}>
            {previewBadges.slice(0, 3).map((b) => (
              <BadgeTile key={b.code} badge={b} />
            ))}
          </View>
        </Pressable>

        {/* Reviews */}
        <View>
          <Text style={textStyles.sectionHeader}>Other runners say</Text>
          {reviews == null ? null : reviews.length === 0 ? (
            <Text style={[textStyles.caption, styles.reviewsEmpty]}>
              No reviews yet — finish a run together.
            </Text>
          ) : (
            <View style={styles.reviewsList}>
              {reviews.map((r) => (
                <View key={r.id} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <RatingStars value={r.stars} size={13} />
                    {r.run?.title ? <Text style={styles.reviewRun}>{r.run.title}</Text> : null}
                  </View>
                  {r.note ? <Text style={styles.reviewNote}>&ldquo;{r.note}&rdquo;</Text> : null}
                  <Text style={textStyles.caption}>— {r.reviewer?.display_name ?? 'A runner'}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper2 },
  header: {
    backgroundColor: colors.ink900,
    alignItems: 'center',
    paddingBottom: spacing.sp10,
    gap: spacing.sp2,
  },
  headerButtons: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    paddingHorizontal: spacing.sp3,
  },
  name: {
    fontFamily: fonts.displayExtra,
    fontSize: typeScale.d3,
    color: colors.paper,
    textTransform: 'uppercase',
    letterSpacing: letterSpacing(typeScale.d3, tracking.caps),
  },
  city: {
    fontFamily: fonts.body,
    fontSize: typeScale.tSm,
    color: colors.ink400,
  },
  ratingRow: { marginTop: 2 },
  statsCard: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: colors.paper,
    marginHorizontal: sizing.gutter,
    marginTop: -spacing.sp6,
    borderRadius: radius.md,
    padding: spacing.sp4,
    ...shadows.md,
  },
  body: {
    paddingHorizontal: sizing.gutter,
    paddingTop: spacing.sp5,
    gap: spacing.sp5,
  },
  levelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sp4,
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    borderWidth: borderWidth.hair,
    borderColor: colors.ink100,
    padding: spacing.sp4,
  },
  levelRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 3,
    borderColor: colors.volt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelNumber: {
    fontFamily: fonts.displayBlack,
    fontSize: typeScale.d3,
    color: colors.ink900,
  },
  levelText: { flex: 1, gap: 2 },
  levelTitle: {
    fontFamily: fonts.display,
    fontSize: typeScale.tLg,
    letterSpacing: letterSpacing(typeScale.tLg, tracking.caps),
    color: colors.ink900,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    borderWidth: borderWidth.hair,
    borderColor: colors.ink100,
    padding: spacing.sp4,
    gap: spacing.sp2,
  },
  styleLine: {
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.tSm,
    color: colors.ink900,
  },
  likesRow: { flexDirection: 'row', gap: spacing.sp2, flexWrap: 'wrap' },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.sp3,
  },
  badgeRow: { flexDirection: 'row', gap: spacing.sp3 },
  reviewsEmpty: { marginTop: spacing.sp2 },
  reviewsList: { gap: spacing.sp3, marginTop: spacing.sp3 },
  reviewCard: {
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    borderWidth: borderWidth.hair,
    borderColor: colors.ink100,
    padding: spacing.sp4,
    gap: spacing.sp2,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reviewRun: {
    fontFamily: fonts.displaySemiBold,
    fontSize: typeScale.tXs,
    letterSpacing: letterSpacing(typeScale.tXs, tracking.label),
    color: colors.ink400,
    textTransform: 'uppercase',
  },
  reviewNote: {
    fontFamily: fonts.body,
    fontSize: typeScale.tSm,
    lineHeight: typeScale.tSm * 1.45,
    color: colors.ink900,
  },
});
