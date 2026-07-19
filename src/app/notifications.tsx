/**
 * Notification center (P3 E2). Today/Earlier sections, mark-all-read, rows
 * deep-navigate by kind. Same table the push pipeline reads.
 */
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNowStrict, isToday } from 'date-fns';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { ArrowLeft, BellOff } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Linking, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { registerForPush } from '@/lib/notifications';
import { qk } from '@/lib/queryKeys';
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
import type { Database } from '@/types/database.types';

type NotificationRow = Database['public']['Tables']['notifications']['Row'] & {
  actor: { display_name: string; avatar_url: string | null } | null;
};

const PAGE = 30;

const KIND_DOT: Record<Database['public']['Enums']['notification_kind'], string> = {
  join_request: colors.challenge,
  request_approved: colors.go,
  request_declined: colors.ink400,
  member_joined: colors.go,
  message: colors.discover,
  run_reminder: colors.volt,
  run_completed: colors.go,
  review_received: colors.star,
  badge_earned: colors.volt,
  leaderboard_weekly: colors.volt,
};

function targetFor(n: NotificationRow): string | null {
  if (n.kind === 'message' && n.conversation_id) return `/chat/${n.conversation_id}`;
  if (n.kind === 'join_request' && n.run_id) return `/run/${n.run_id}/requests`;
  if (n.kind === 'run_completed' && n.run_id) return `/review/${n.run_id}`;
  if (n.kind === 'badge_earned' || n.kind === 'leaderboard_weekly') return '/rewards';
  if (n.run_id) return `/run/${n.run_id}`;
  return null;
}

async function fetchPage(cursor?: string): Promise<NotificationRow[]> {
  let query = supabase
    .from('notifications')
    .select('*, actor:profiles!notifications_actor_id_fkey(display_name, avatar_url)')
    .order('created_at', { ascending: false })
    .limit(PAGE);
  if (cursor) query = query.lt('created_at', cursor);
  const { data, error } = await query;
  if (error) throw error;
  return data as NotificationRow[];
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [permissionCard, setPermissionCard] = useState(false);

  // Opt-in card when push permission was never asked (P3 E3 prompt timing).
  useEffect(() => {
    void Notifications.getPermissionsAsync().then((perm) =>
      setPermissionCard(perm.status === 'undetermined'),
    );
  }, []);

  const query = useInfiniteQuery({
    queryKey: qk.notifications(),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    getNextPageParam: (last) => (last.length < PAGE ? undefined : last[last.length - 1]?.created_at),
  });

  const rows = (query.data?.pages ?? []).flat();
  const today = rows.filter((n) => isToday(new Date(n.created_at)));
  const earlier = rows.filter((n) => !isToday(new Date(n.created_at)));
  const sections = [
    ...(today.length ? [{ title: 'TODAY', data: today }] : []),
    ...(earlier.length ? [{ title: 'EARLIER', data: earlier }] : []),
  ];

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: qk.notifications() });
    void queryClient.invalidateQueries({ queryKey: qk.notificationsUnread() });
  };

  const markAllRead = async () => {
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .is('read_at', null);
    invalidate();
  };

  const open = async (n: NotificationRow) => {
    if (!n.read_at) {
      void supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', n.id)
        .then(invalidate);
    }
    const target = targetFor(n);
    if (target) router.push(target as never);
  };

  const enablePush = async () => {
    const granted = await registerForPush();
    if (!granted) void Linking.openSettings();
    setPermissionCard(false);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sp3 }]}>
      <View style={styles.header}>
        <IconButton variant="ghost" accessibilityLabel="Back" onPress={() => router.back()}>
          <ArrowLeft size={22} />
        </IconButton>
        <Text style={[textStyles.screenTitle, styles.headerTitle]}>Notifications</Text>
        <Pressable onPress={() => void markAllRead()} hitSlop={8}>
          <Text style={styles.markAll}>MARK ALL READ</Text>
        </Pressable>
      </View>

      {permissionCard ? (
        <View style={styles.permissionCard}>
          <BellOff size={18} color={colors.paper} />
          <Text style={styles.permissionText}>
            Turn on notifications to hear about requests and messages.
          </Text>
          <Button label="TURN ON" size="sm" onPress={() => void enablePush()} />
        </View>
      ) : null}

      <SectionList
        sections={sections}
        keyExtractor={(n) => n.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.sp8 }]}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
        }}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          query.isLoading ? (
            <View style={styles.skeletons}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={styles.skeleton} />
              ))}
            </View>
          ) : query.isError ? (
            <View style={styles.empty}>
              <Text style={textStyles.body}>Could not load notifications.</Text>
              <Button label="RETRY" size="sm" variant="secondary" onPress={() => query.refetch()} />
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={textStyles.body}>Nothing yet — go find a run.</Text>
            </View>
          )
        }
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionLabel}>{section.title}</Text>
        )}
        renderItem={({ item }) => {
          const unread = item.read_at == null;
          return (
            <Pressable
              accessibilityRole="button"
              onPress={() => void open(item)}
              style={[styles.row, unread && styles.rowUnread]}
            >
              <View>
                <Avatar
                  name={item.actor?.display_name ?? 'R'}
                  src={item.actor?.avatar_url ?? undefined}
                  size="md"
                />
                <View style={[styles.kindDot, { backgroundColor: KIND_DOT[item.kind] }]} />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                {item.body ? (
                  <Text style={styles.rowText} numberOfLines={2}>
                    {item.body}
                  </Text>
                ) : null}
                <Text style={styles.rowTime}>
                  {formatDistanceToNowStrict(new Date(item.created_at), { addSuffix: true })}
                </Text>
              </View>
              {unread ? <View style={styles.unreadDot} /> : null}
            </Pressable>
          );
        }}
      />
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
  headerTitle: { flex: 1, fontSize: typeScale.d2 },
  markAll: {
    fontFamily: fonts.displayExtra,
    fontSize: typeScale.tXs,
    letterSpacing: letterSpacing(typeScale.tXs, tracking.label),
    color: colors.discover,
  },
  permissionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sp3,
    backgroundColor: colors.ink900,
    marginHorizontal: sizing.gutter,
    borderRadius: radius.md,
    padding: spacing.sp4,
    marginBottom: spacing.sp2,
  },
  permissionText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: typeScale.tSm,
    color: colors.paper,
  },
  list: { paddingHorizontal: sizing.gutter, gap: spacing.sp2, paddingTop: spacing.sp2 },
  sectionLabel: {
    fontFamily: fonts.displaySemiBold,
    fontSize: typeScale.dEyebrow,
    letterSpacing: letterSpacing(typeScale.dEyebrow, tracking.label),
    color: colors.ink400,
    marginTop: spacing.sp3,
    marginBottom: spacing.sp1,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sp3,
    padding: spacing.sp3,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  rowUnread: {
    backgroundColor: colors.paper,
    borderWidth: borderWidth.hair,
    borderColor: colors.ink100,
  },
  kindDot: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.paper2,
  },
  rowBody: { flex: 1, gap: 1 },
  rowTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: typeScale.tSm,
    color: colors.ink900,
  },
  rowText: {
    fontFamily: fonts.body,
    fontSize: typeScale.tSm,
    color: colors.ink500,
  },
  rowTime: {
    fontFamily: fonts.body,
    fontSize: typeScale.tXs,
    color: colors.ink400,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.volt,
  },
  skeletons: { gap: spacing.sp2 },
  skeleton: { height: 68, borderRadius: radius.md, backgroundColor: colors.ink100 },
  empty: { alignItems: 'center', gap: spacing.sp3, paddingVertical: spacing.sp10 },
});
