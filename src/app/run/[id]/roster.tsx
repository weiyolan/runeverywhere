/**
 * Roster (P2 I3) — host + approved members. Host can remove approved
 * members (server blocks re-join).
 */
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Star } from 'lucide-react-native';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { qk } from '@/lib/queryKeys';
import { useRemoveMember } from '@/lib/runMutations';
import { fetchRunDetail, fetchRunMembers } from '@/lib/runs';
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

export default function RosterScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const uid = useSession((s) => s.session?.user.id);

  const detail = useQuery({ queryKey: qk.run(id), queryFn: () => fetchRunDetail(id) }).data;
  const membersQuery = useQuery({ queryKey: qk.runMembers(id), queryFn: () => fetchRunMembers(id) });
  const remove = useRemoveMember(id);

  const isHost = Boolean(detail && uid && detail.run.host_id === uid);
  const approved = (membersQuery.data ?? []).filter((m) => m.status === 'approved');
  const pendingCount = (membersQuery.data ?? []).filter((m) => m.status === 'pending').length;

  const confirmRemove = (userId: string, name: string) =>
    Alert.alert(`Remove ${name}?`, "They won't be able to rejoin.", [
      { text: 'Keep', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => remove.mutate(userId) },
    ]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sp2 }]}>
      <View style={styles.header}>
        <IconButton accessibilityLabel="Back" onPress={() => router.back()}>
          <ArrowLeft size={20} />
        </IconButton>
        <Text style={textStyles.sectionHeader}>Roster</Text>
      </View>

      <FlatList
        data={approved}
        keyExtractor={(m) => m.user_id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <Text style={textStyles.eyebrow}>HOST</Text>
            <View style={styles.row}>
              <Avatar src={detail?.host?.avatar_url} name={detail?.host?.display_name} size="md" />
              <Text style={styles.name}>{detail?.host?.display_name || 'Host'}</Text>
            </View>
            <Text style={[textStyles.eyebrow, styles.goingHeader]}>GOING · {approved.length + 1}</Text>
          </View>
        }
        ListFooterComponent={
          isHost && pendingCount > 0 ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/run/${id}/requests`)}
              style={styles.pendingFooter}
            >
              <Text style={styles.pendingText}>
                {pendingCount} pending {pendingCount === 1 ? 'request' : 'requests'} →
              </Text>
            </Pressable>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.memberRow}>
            <Avatar src={item.profile?.avatar_url} name={item.profile?.display_name} size="md" />
            <View style={styles.memberText}>
              <Text style={styles.name}>{item.profile?.display_name || 'Runner'}</Text>
              {item.profile?.rating_avg != null ? (
                <View style={styles.rating}>
                  <Star size={12} color={colors.star} fill={colors.star} />
                  <Text style={styles.ratingValue}>{Number(item.profile.rating_avg).toFixed(1)}</Text>
                </View>
              ) : null}
            </View>
            {isHost ? (
              <Button
                label="Remove"
                size="sm"
                variant="danger"
                onPress={() => confirmRemove(item.user_id, item.profile?.display_name || 'this runner')}
              />
            ) : null}
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
    paddingBottom: spacing.sp3,
  },
  list: { paddingHorizontal: sizing.gutter, gap: spacing.sp3, paddingBottom: spacing.sp12 },
  headerBlock: { gap: spacing.sp2 },
  goingHeader: { marginTop: spacing.sp3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sp3 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sp3,
    backgroundColor: semantic.bgSurface,
    borderRadius: radius.md,
    borderWidth: borderWidth.hair,
    borderColor: colors.ink200,
    padding: spacing.sp3,
  },
  memberText: { flex: 1, gap: 2 },
  name: {
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
  pendingFooter: { paddingVertical: spacing.sp3, alignItems: 'center' },
  pendingText: {
    fontFamily: fonts.displayExtra,
    fontSize: typeScale.tSm,
    color: colors.ink900,
    letterSpacing: 0.5,
  },
});
