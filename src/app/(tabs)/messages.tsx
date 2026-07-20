/**
 * Messages tab (P3 D5) — run groups + DMs with last-message preview and
 * unread pills from list_conversations(); search is client-side filtering.
 */
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNowStrict } from 'date-fns';
import { router } from 'expo-router';
import { Search } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { listConversations, type ConversationRow } from '@/lib/chat';
import { useRefetchOnFocus } from '@/lib/queryFocus';
import { qk } from '@/lib/queryKeys';
import {
  borderWidth,
  colors,
  fonts,
  letterSpacing,
  radius,
  runType,
  shadows,
  sizing,
  spacing,
  textStyles,
  tracking,
  typeScale,
} from '@/theme/theme';

function previewText(c: ConversationRow): string {
  if (!c.last_body) return 'No messages yet';
  if (c.last_kind === 'system') {
    const name = c.peer_names[c.peer_ids.indexOf(c.last_sender_id ?? '')] ?? 'Someone';
    if (c.last_body === 'joined') return `${name} joined`;
    if (c.last_body === 'left') return `${name} left`;
    return `${name} was removed`;
  }
  if (c.last_kind === 'meeting_point') return `Meeting point: ${c.last_body}`;
  return c.last_body;
}

function ConversationCard({ c }: { c: ConversationRow }) {
  const isRun = c.kind === 'run';
  const typeColor = isRun && c.run_type ? runType[c.run_type].main : undefined;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/chat/${c.conversation_id}`)}
      style={[styles.card, typeColor ? { borderLeftWidth: 5, borderLeftColor: typeColor } : null]}
    >
      <View style={styles.avatars}>
        {c.peer_names.length === 0 ? (
          <Avatar name="?" size="sm" />
        ) : (
          c.peer_names.slice(0, 3).map((name, i) => (
            <View key={c.peer_ids[i] ?? i} style={i > 0 ? styles.avatarOverlap : undefined}>
              <Avatar name={name} src={c.peer_avatars[i] ?? undefined} size="sm" />
            </View>
          ))
        )}
      </View>
      <View style={styles.cardBody}>
        <Text style={isRun ? styles.runTitle : styles.dmTitle} numberOfLines={1}>
          {c.title}
        </Text>
        <Text style={styles.preview} numberOfLines={1}>
          {previewText(c)}
        </Text>
      </View>
      <View style={styles.cardMeta}>
        {c.last_at ? (
          <Text style={styles.time}>
            {formatDistanceToNowStrict(new Date(c.last_at), { addSuffix: false })}
          </Text>
        ) : null}
        {c.unread_count > 0 ? (
          <Badge tone="danger" solid>
            {c.unread_count}
          </Badge>
        ) : null}
      </View>
    </Pressable>
  );
}

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const query = useQuery({ queryKey: qk.conversations(), queryFn: listConversations });
  useRefetchOnFocus([qk.conversations()]);

  const q = search.trim().toLowerCase();
  const matches = (c: ConversationRow) =>
    q.length === 0 ||
    c.title.toLowerCase().includes(q) ||
    c.peer_names.some((n) => n.toLowerCase().includes(q));

  const rows = (query.data ?? []).filter(matches);
  const runGroups = rows.filter((c) => c.kind === 'run');
  const dms = rows.filter((c) => c.kind === 'dm');

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sp4 }]}>
      <View style={styles.header}>
        <Text style={textStyles.screenTitle}>Messages</Text>
        <Input
          value={search}
          onChangeText={setSearch}
          placeholder="Search conversations"
          leading={<Search size={18} color={colors.ink400} />}
        />
      </View>

      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.sp16 }]}
        refreshControl={
          <RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} />
        }
      >
        {query.isLoading ? (
          <View style={styles.skeletons}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.skeleton} />
            ))}
          </View>
        ) : query.isError ? (
          <View style={styles.empty}>
            <Text style={textStyles.body}>Could not load your conversations.</Text>
            <Button label="RETRY" size="sm" variant="secondary" onPress={() => query.refetch()} />
          </View>
        ) : rows.length === 0 ? (
          <View style={styles.empty}>
            <Text style={[textStyles.body, styles.emptyText]}>
              No conversations yet — join a run to unlock its group chat.
            </Text>
            <Button
              label="EXPLORE RUNS"
              size="sm"
              variant="secondary"
              onPress={() => router.push('/(tabs)')}
            />
          </View>
        ) : (
          <>
            {runGroups.length > 0 ? (
              <>
                <Text style={styles.sectionLabel}>RUN GROUPS</Text>
                {runGroups.map((c) => (
                  <ConversationCard key={c.conversation_id} c={c} />
                ))}
              </>
            ) : null}
            {dms.length > 0 ? (
              <>
                <Text style={styles.sectionLabel}>DIRECT</Text>
                {dms.map((c) => (
                  <ConversationCard key={c.conversation_id} c={c} />
                ))}
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper2 },
  header: { paddingHorizontal: sizing.gutter, gap: spacing.sp3 },
  list: { paddingHorizontal: sizing.gutter, paddingTop: spacing.sp4, gap: spacing.sp3 },
  sectionLabel: {
    fontFamily: fonts.displaySemiBold,
    fontSize: typeScale.dEyebrow,
    letterSpacing: letterSpacing(typeScale.dEyebrow, tracking.label),
    color: colors.ink400,
    marginTop: spacing.sp2,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sp3,
    backgroundColor: colors.paper,
    borderWidth: borderWidth.hair,
    borderColor: colors.ink100,
    borderRadius: radius.md,
    padding: spacing.sp4,
    ...shadows.sm,
  },
  avatars: { flexDirection: 'row', alignItems: 'center' },
  avatarOverlap: { marginLeft: -10 },
  cardBody: { flex: 1, gap: 2 },
  runTitle: {
    fontFamily: fonts.display,
    fontSize: typeScale.tMd,
    letterSpacing: letterSpacing(typeScale.tMd, tracking.caps),
    textTransform: 'uppercase',
    color: colors.ink900,
  },
  dmTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: typeScale.tMd,
    color: colors.ink900,
  },
  preview: {
    fontFamily: fonts.body,
    fontSize: typeScale.tSm,
    color: colors.ink500,
  },
  cardMeta: { alignItems: 'flex-end', gap: spacing.sp1 },
  time: {
    fontFamily: fonts.body,
    fontSize: typeScale.tXs,
    color: colors.ink400,
  },
  skeletons: { gap: spacing.sp3 },
  skeleton: {
    height: 76,
    borderRadius: radius.md,
    backgroundColor: colors.ink100,
  },
  empty: { alignItems: 'center', gap: spacing.sp3, paddingVertical: spacing.sp10 },
  emptyText: { textAlign: 'center' },
});
