/**
 * Other-runner profile (P5 E4). Four states: unavailable (row unreadable),
 * blocked-by-me banner, limited (members without shared run), full.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, MoreHorizontal } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ReportSheet } from '@/components/ReportSheet';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { RatingStars } from '@/components/ui/RatingStars';
import { StatBlock } from '@/components/ui/StatBlock';
import { useBlocks } from '@/hooks/useBlocks';
import { useOpenDm } from '@/hooks/useOpenDm';
import {
  canViewProfile,
  fetchProfile,
  fetchProfileStats,
  fetchReviews,
} from '@/lib/profile';
import { qk } from '@/lib/queryKeys';
import { unblock } from '@/lib/safety';
import { useSession } from '@/stores/session';
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

const fmtStat = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)));

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const me = useSession((s) => s.session?.user.id);
  const { isBlocked } = useBlocks();
  const { openDm, openingFor } = useOpenDm();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dmError, setDmError] = useState<string | null>(null);

  const profileQuery = useQuery({
    queryKey: qk.profile(id ?? ''),
    queryFn: () => fetchProfile(id!),
    enabled: id != null,
  });
  const viewable = useQuery({
    queryKey: qk.profileCanView(id ?? ''),
    queryFn: () => canViewProfile(id!),
    enabled: id != null,
  }).data;

  const profile = profileQuery.data;
  const full = viewable === true && profile != null;

  const stats = useQuery({
    queryKey: qk.profileStats(id ?? ''),
    queryFn: () => fetchProfileStats(id!),
    enabled: full,
  }).data;
  const reviews = useQuery({
    queryKey: qk.reviews(id ?? ''),
    queryFn: () => fetchReviews(id!),
    enabled: full,
  }).data;

  const blockedByMe = id != null && isBlocked(id);

  if (id === me) {
    router.replace('/(tabs)/profile');
    return null;
  }

  const header = (
    <View style={styles.topBar}>
      <IconButton variant="ghost" accessibilityLabel="Back" onPress={() => router.back()}>
        <ArrowLeft size={22} />
      </IconButton>
      {profile ? (
        <IconButton
          variant="ghost"
          accessibilityLabel="More options"
          onPress={() => setSheetOpen(true)}
        >
          <MoreHorizontal size={22} />
        </IconButton>
      ) : null}
    </View>
  );

  // Unavailable: hidden / blocked-by-them / deleted.
  if (profileQuery.isSuccess && profile == null) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + spacing.sp3 }]}>
        {header}
        <View style={styles.centered}>
          <Text style={textStyles.body}>Profile unavailable</Text>
          <Button label="BACK" variant="secondary" onPress={() => router.back()} />
        </View>
      </View>
    );
  }
  if (!profile) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + spacing.sp3 }]}>
        {header}
        <View style={styles.centered}>
          <View style={styles.skeletonAvatar} />
          <View style={styles.skeletonLine} />
        </View>
      </View>
    );
  }

  const limitedCard = (
    <View style={[styles.limitedCard, blockedByMe && styles.dimmed]}>
      <Avatar name={profile.display_name} src={profile.avatar_url ?? undefined} size="xl" />
      <Text style={styles.name}>{profile.display_name}</Text>
      {profile.home_city ? <Text style={textStyles.caption}>{profile.home_city}</Text> : null}
    </View>
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sp3 }]}>
      {header}
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}>
        {blockedByMe ? (
          <>
            <View style={styles.blockedBanner}>
              <Text style={styles.blockedText}>You blocked {profile.display_name}.</Text>
              <Button
                label="UNBLOCK"
                size="sm"
                variant="secondary"
                onPress={() => {
                  void unblock(id!).then(() => {
                    void queryClient.invalidateQueries({ queryKey: qk.blocks() });
                    void queryClient.invalidateQueries();
                  });
                }}
              />
            </View>
            {limitedCard}
          </>
        ) : !full ? (
          <>
            {limitedCard}
            <Text style={[textStyles.caption, styles.lockCaption]}>
              Full profile is visible to runners who share a run.
            </Text>
          </>
        ) : (
          <>
            <View style={styles.hero}>
              <Avatar name={profile.display_name} src={profile.avatar_url ?? undefined} size="xl" />
              <Text style={styles.name}>{profile.display_name}</Text>
              <Text style={textStyles.caption}>
                {[profile.home_city, profile.languages.join(' · ')].filter(Boolean).join(' · ')}
              </Text>
              <View style={styles.ratingRow}>
                {profile.rating_avg != null ? (
                  <RatingStars
                    value={Number(profile.rating_avg)}
                    size={14}
                    showValue
                    count={profile.rating_count}
                  />
                ) : null}
                <Text style={textStyles.caption}>Level {profile.level}</Text>
              </View>
            </View>

            <View style={styles.statsCard}>
              <StatBlock value={stats ? fmtStat(Number(stats.total_km)) : '—'} label="KM" />
              <StatBlock value={stats ? String(stats.runs_count) : '—'} label="RUNS" />
              <StatBlock value={stats ? fmtStat(Number(stats.total_dplus)) : '—'} label="D+ M" />
            </View>

            {profile.bio ? <Text style={styles.bio}>&ldquo;{profile.bio}&rdquo;</Text> : null}

            <View>
              <Text style={textStyles.sectionHeader}>Reviews</Text>
              {reviews == null || reviews.length === 0 ? (
                <Text style={[textStyles.caption, styles.lockCaption]}>No reviews yet.</Text>
              ) : (
                <View style={styles.reviewsList}>
                  {reviews.map((r) => (
                    <View key={r.id} style={styles.reviewCard}>
                      <View style={styles.reviewHeader}>
                        <RatingStars value={r.stars} size={13} />
                        {r.run?.title ? <Text style={styles.reviewRun}>{r.run.title}</Text> : null}
                      </View>
                      {r.note ? <Text style={styles.reviewNote}>&ldquo;{r.note}&rdquo;</Text> : null}
                      <Text style={textStyles.caption}>
                        — {r.reviewer?.display_name ?? 'A runner'}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {full && !blockedByMe ? (
        <View style={[styles.ctaBar, { paddingBottom: insets.bottom + spacing.sp3 }]}>
          {dmError ? <Text style={styles.dmError}>{dmError}</Text> : null}
          <Button
            label={openingFor ? 'OPENING…' : 'MESSAGE'}
            full
            disabled={openingFor != null}
            onPress={() => {
              setDmError(null);
              void openDm(id!).catch(() => setDmError('This runner is unavailable.'));
            }}
          />
        </View>
      ) : null}

      <ReportSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        subjectUserId={id ?? ''}
        subjectName={profile.display_name}
        onBlocked={() => router.back()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper2 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sp3,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sp4,
    paddingHorizontal: sizing.gutter,
  },
  skeletonAvatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.ink100 },
  skeletonLine: { width: 160, height: 22, borderRadius: radius.xs, backgroundColor: colors.ink100 },
  content: {
    paddingHorizontal: sizing.gutter,
    paddingTop: spacing.sp4,
    gap: spacing.sp5,
  },
  blockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.sp4,
    gap: spacing.sp3,
  },
  blockedText: {
    flex: 1,
    fontFamily: fonts.bodySemiBold,
    fontSize: typeScale.tSm,
    color: colors.danger,
  },
  limitedCard: {
    alignItems: 'center',
    gap: spacing.sp2,
    backgroundColor: colors.paper,
    borderRadius: radius.lg,
    borderWidth: borderWidth.hair,
    borderColor: colors.ink100,
    paddingVertical: spacing.sp8,
  },
  dimmed: { opacity: 0.5 },
  lockCaption: { textAlign: 'center', marginTop: spacing.sp2 },
  hero: { alignItems: 'center', gap: spacing.sp2 },
  name: {
    fontFamily: fonts.displayExtra,
    fontSize: typeScale.d3,
    color: colors.ink900,
    textTransform: 'uppercase',
    letterSpacing: letterSpacing(typeScale.d3, tracking.caps),
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sp3,
  },
  statsCard: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    borderWidth: borderWidth.hair,
    borderColor: colors.ink100,
    padding: spacing.sp4,
  },
  bio: {
    fontFamily: fonts.body,
    fontSize: typeScale.tMd,
    lineHeight: typeScale.tMd * 1.45,
    color: colors.ink500,
    textAlign: 'center',
  },
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
  ctaBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: sizing.gutter,
    paddingTop: spacing.sp3,
    backgroundColor: colors.paper2,
    gap: spacing.sp2,
  },
  dmError: {
    ...textStyles.caption,
    color: colors.danger,
    textAlign: 'center',
  },
});
