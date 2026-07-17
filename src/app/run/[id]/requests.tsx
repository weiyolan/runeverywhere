/**
 * Host inbox (P2 I1) — pending join requests with ACCEPT / DECLINE.
 * Host-only; non-hosts are bounced back to detail.
 */
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useEffect } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { useRefetchOnFocus } from '@/lib/queryFocus';
import { qk } from '@/lib/queryKeys';
import { useRespondToRequest } from '@/lib/runMutations';
import { fetchRunDetail, fetchRunMembers } from '@/lib/runs';
import { shareRunInvite } from '@/lib/share';
import { useSession } from '@/stores/session';
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

const relativeTime = (iso: string) => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
};

export default function RunRequestsScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const uid = useSession((s) => s.session?.user.id);

  const detail = useQuery({ queryKey: qk.run(id), queryFn: () => fetchRunDetail(id) }).data;
  const membersQuery = useQuery({
    queryKey: qk.runMembers(id),
    queryFn: () => fetchRunMembers(id),
  });
  useRefetchOnFocus([qk.runMembers(id)]);
  const respond = useRespondToRequest(id);

  const isHost = Boolean(detail && uid && detail.run.host_id === uid);
  useEffect(() => {
    if (detail && !isHost) router.replace(`/run/${id}`);
  }, [detail, isHost, id]);

  const pending = (membersQuery.data ?? []).filter((m) => m.status === 'pending');
  const approvedCount = (membersQuery.data ?? []).filter((m) => m.status === 'approved').length;

  const decide = (userId: string, approve: boolean) =>
    respond.mutate(
      { userId, approve },
      {
        onError: (e) => {
          Alert.alert('Couldn’t update', e instanceof Error ? e.message : 'Try again.');
          void membersQuery.refetch();
        },
      },
    );

  const share = () => detail && shareRunInvite(detail.run);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sp2 }]}>
      <View style={styles.header}>
        <IconButton accessibilityLabel="Back" onPress={() => router.back()}>
          <ArrowLeft size={20} />
        </IconButton>
        <Text style={textStyles.sectionHeader}>Join requests · {pending.length}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push(`/run/${id}/roster`)}
        style={styles.goingRow}
      >
        <Text style={textStyles.eyebrow}>GOING · {approvedCount + 1}</Text>
        <Text style={styles.goingLink}>VIEW ROSTER</Text>
      </Pressable>

      <FlatList
        data={pending}
        keyExtractor={(m) => m.user_id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          membersQuery.isLoading ? null : (
            <View style={styles.empty}>
              <Text style={textStyles.body}>No requests yet — share your run to fill spots.</Text>
              <Button label="Share" size="sm" variant="secondary" onPress={share} />
            </View>
          )
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Avatar src={item.profile?.avatar_url} name={item.profile?.display_name} size="md" />
              <View style={styles.cardHeaderText}>
                <Text style={styles.name}>{item.profile?.display_name || 'Runner'}</Text>
                <Text style={textStyles.caption}>
                  {item.profile?.rating_avg != null ? `★ ${Number(item.profile.rating_avg).toFixed(1)} · ` : ''}
                  {relativeTime(item.requested_at)}
                </Text>
              </View>
            </View>
            {item.profile?.languages?.length ? (
              <View style={styles.langRow}>
                {item.profile.languages.map((l) => (
                  <View key={l} style={styles.lang}>
                    <Text style={styles.langText}>{l}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            {item.intro_message ? <Text style={styles.intro}>“{item.intro_message}”</Text> : null}
            <View style={styles.actions}>
              <View style={styles.accept}>
                <Button label="Accept" size="sm" full onPress={() => decide(item.user_id, true)} />
              </View>
              <Button label="Decline" size="sm" variant="ghost" onPress={() => decide(item.user_id, false)} />
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper2 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sp3,
    paddingHorizontal: sizing.gutter,
    paddingBottom: spacing.sp2,
  },
  goingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: sizing.gutter,
    paddingBottom: spacing.sp3,
  },
  goingLink: {
    fontFamily: fonts.displayExtra,
    fontSize: typeScale.tXs,
    color: colors.ink900,
    letterSpacing: 0.5,
  },
  list: { paddingHorizontal: sizing.gutter, gap: spacing.sp3, paddingBottom: spacing.sp12 },
  empty: { alignItems: 'center', gap: spacing.sp3, paddingVertical: spacing.sp10 },
  card: {
    backgroundColor: semantic.bgSurface,
    borderRadius: radius.md,
    borderWidth: borderWidth.hair,
    borderColor: colors.ink200,
    padding: spacing.sp4,
    gap: spacing.sp2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sp3 },
  cardHeaderText: { gap: 2 },
  name: {
    fontFamily: fonts.bodySemiBold,
    fontSize: typeScale.tMd,
    color: semantic.textPrimary,
  },
  langRow: { flexDirection: 'row', gap: spacing.sp1 },
  lang: {
    backgroundColor: colors.ink100,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sp2,
    paddingVertical: 2,
  },
  langText: {
    fontFamily: fonts.display,
    fontSize: 10,
    color: colors.ink700,
    textTransform: 'uppercase',
  },
  intro: {
    fontFamily: fonts.body,
    fontSize: typeScale.tSm,
    lineHeight: typeScale.tSm * 1.45,
    color: semantic.textSecondary,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sp2 },
  accept: { flex: 1 },
});
