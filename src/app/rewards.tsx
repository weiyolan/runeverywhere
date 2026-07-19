/**
 * Rewards (P5 E6) — level hero, full badge grid, weekly city leaderboard
 * with THIS WEEK | LAST WEEK toggle (UTC ISO weeks, matching the SQL rule).
 */
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BadgeTile } from '@/components/BadgeTile';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Tabs } from '@/components/ui/Tabs';
import { fetchBadges, fetchLevels } from '@/lib/profile';
import { qk } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';
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

/** UTC ISO Monday of the current week, as YYYY-MM-DD (mirrors date_trunc). */
function utcWeekStart(offsetWeeks = 0): string {
  const now = new Date();
  const utc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = utc.getUTCDay() || 7; // Sunday → 7
  utc.setUTCDate(utc.getUTCDate() - day + 1 + offsetWeeks * 7);
  return utc.toISOString().slice(0, 10);
}

export default function RewardsScreen() {
  const insets = useSafeAreaInsets();
  const profile = useSession((s) => s.profile);
  const [week, setWeek] = useState<'this' | 'last'>('this');
  const uid = profile?.id;

  const badges = useQuery({
    queryKey: qk.badges(uid ?? ''),
    queryFn: () => fetchBadges(uid!),
    enabled: uid != null,
  }).data;

  const levels = useQuery({ queryKey: qk.levels(), queryFn: fetchLevels, staleTime: Infinity }).data;

  const weekStart = utcWeekStart(week === 'this' ? 0 : -1);
  const city = profile?.home_city?.trim() ?? '';

  const leaderboard = useQuery({
    queryKey: qk.leaderboard(weekStart, city),
    enabled: city.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_leaderboard', {
        p_city: city,
        p_week_start: weekStart,
      });
      if (error) throw error;
      return data;
    },
  });

  const level = levels?.find((l) => l.level === profile?.level);
  const earned = (badges ?? []).filter((b) => b.earned_at != null);
  const rows = leaderboard.data ?? [];

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sp3 }]}>
      <View style={styles.header}>
        <IconButton variant="ghost" accessibilityLabel="Back" onPress={() => router.back()}>
          <ArrowLeft size={22} />
        </IconButton>
        <Text style={textStyles.sectionHeader}>Rewards</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.sp10 }]}>
        {/* Level hero */}
        <View style={styles.hero}>
          <View style={styles.heroRing}>
            <Text style={styles.heroLevel}>{profile?.level ?? 1}</Text>
          </View>
          <Text style={styles.heroTitle}>{level?.title || `Level ${profile?.level ?? 1}`}</Text>
          <Text style={styles.heroPts}>{profile?.points_total ?? 0} pts</Text>
        </View>

        {/* Badge grid */}
        <View style={styles.sectionHeaderRow}>
          <Text style={textStyles.sectionHeader}>Badges</Text>
          <Text style={textStyles.caption}>
            {earned.length} / {(badges ?? []).length} earned
          </Text>
        </View>
        <View style={styles.badgeGrid}>
          {(badges ?? []).map((b) => (
            <BadgeTile key={b.code} badge={b} showDescription />
          ))}
        </View>

        {/* Leaderboard */}
        <View style={styles.leaderboardHeader}>
          <Text style={styles.leaderboardEyebrow}>
            {week === 'this' ? 'THIS WEEK' : 'LAST WEEK'}
            {city ? ` · ${city.toUpperCase()}` : ''}
          </Text>
          <Tabs
            items={[
              { id: 'this', label: 'This week' },
              { id: 'last', label: 'Last week' },
            ]}
            value={week}
            onChange={(id) => setWeek(id as 'this' | 'last')}
          />
        </View>

        {city.length === 0 ? (
          <View style={styles.empty}>
            <Text style={textStyles.body}>Set your home city to join the leaderboard.</Text>
            <Button
              label="EDIT PROFILE"
              size="sm"
              variant="secondary"
              onPress={() => router.push('/settings/edit-profile')}
            />
          </View>
        ) : leaderboard.isLoading ? (
          <View style={styles.skeletons}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.skeleton} />
            ))}
          </View>
        ) : leaderboard.isError ? (
          <View style={styles.empty}>
            <Text style={textStyles.body}>Could not load the leaderboard.</Text>
            <Button label="RETRY" size="sm" variant="secondary" onPress={() => leaderboard.refetch()} />
          </View>
        ) : rows.length === 0 ? (
          <View style={styles.empty}>
            <Text style={textStyles.body}>
              No points in {city} yet this week — finish a run.
            </Text>
          </View>
        ) : (
          <View style={styles.board}>
            {rows.map((row) => (
              <Pressable
                key={row.user_id}
                style={[styles.row, row.is_me && styles.rowMe]}
                onPress={() => (row.is_me ? null : router.push(`/user/${row.user_id}`))}
              >
                <Text style={[styles.rank, row.rank <= 3 && styles.rankTop]}>{row.rank}</Text>
                <Avatar name={row.display_name} src={row.avatar_url ?? undefined} size="sm" />
                <View style={styles.rowText}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {row.display_name}
                    {row.is_me ? ' · You' : ''}
                  </Text>
                  <Text style={textStyles.caption}>
                    {row.runs_count} {row.runs_count === 1 ? 'run' : 'runs'} this week
                  </Text>
                </View>
                <Text style={styles.rowPoints}>{row.points}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper2 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sp2,
    paddingHorizontal: spacing.sp3,
    paddingBottom: spacing.sp2,
  },
  content: {
    paddingHorizontal: sizing.gutter,
    gap: spacing.sp4,
  },
  hero: {
    alignItems: 'center',
    backgroundColor: colors.ink900,
    borderRadius: radius.lg,
    paddingVertical: spacing.sp6,
    gap: spacing.sp2,
  },
  heroRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 4,
    borderColor: colors.volt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLevel: {
    fontFamily: fonts.displayBlack,
    fontSize: 40,
    color: colors.paper,
  },
  heroTitle: {
    fontFamily: fonts.displayExtra,
    fontSize: typeScale.d3,
    color: colors.paper,
    textTransform: 'uppercase',
    letterSpacing: letterSpacing(typeScale.d3, tracking.caps),
  },
  heroPts: {
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.tSm,
    color: colors.volt,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sp4,
    justifyContent: 'space-between',
  },
  leaderboardHeader: { gap: spacing.sp3, marginTop: spacing.sp2 },
  leaderboardEyebrow: {
    fontFamily: fonts.displaySemiBold,
    fontSize: typeScale.dEyebrow,
    letterSpacing: letterSpacing(typeScale.dEyebrow, tracking.label),
    color: colors.ink500,
  },
  board: { gap: spacing.sp2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sp3,
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    borderWidth: borderWidth.hair,
    borderColor: colors.ink100,
    padding: spacing.sp3,
  },
  rowMe: {
    backgroundColor: colors.voltSoft,
    borderColor: colors.voltPress,
  },
  rank: {
    width: 26,
    fontFamily: fonts.displayExtra,
    fontSize: typeScale.tMd,
    color: colors.ink400,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  rankTop: { color: colors.ink900 },
  rowText: { flex: 1 },
  rowName: {
    fontFamily: fonts.bodySemiBold,
    fontSize: typeScale.tSm,
    color: colors.ink900,
  },
  rowPoints: {
    fontFamily: fonts.displayExtra,
    fontSize: typeScale.tLg,
    color: colors.ink900,
    fontVariant: ['tabular-nums'],
  },
  skeletons: { gap: spacing.sp2 },
  skeleton: { height: 60, borderRadius: radius.md, backgroundColor: colors.ink100 },
  empty: { alignItems: 'center', gap: spacing.sp3, paddingVertical: spacing.sp8 },
});
