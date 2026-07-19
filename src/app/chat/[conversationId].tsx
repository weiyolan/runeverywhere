/**
 * Chat screen (P3 D6). Persisted-first: optimistic messages reconcile by
 * client-generated uuid when the INSERT returns; the broadcast echo dedupes
 * by id. Only this screen ever holds a Realtime subscription.
 */
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { format } from 'date-fns';
import { ArrowLeft, Info, MapPin, Send } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import {
  fetchMessagesPage,
  latestMeetingPoint,
  listConversations,
  markConversationRead,
  sendMessage,
  MESSAGES_PAGE_SIZE,
  type MessageWithSender,
} from '@/lib/chat';
import { ReportSheet } from '@/components/ReportSheet';
import { useBlocks } from '@/hooks/useBlocks';
import { subscribeToConversation } from '@/lib/realtime';
import { qk } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';
import { useChatStore } from '@/stores/chat';
import { useSession } from '@/stores/session';
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
import type { Database } from '@/types/database.types';

type MessageRow = Database['public']['Tables']['messages']['Row'];
type Pages = InfiniteData<MessageWithSender[], string | undefined>;

/** Optimistic entries carry a client-only status. */
interface LocalMessage extends MessageWithSender {
  localStatus?: 'sending' | 'failed';
}

function systemCopy(m: MessageWithSender, isSelf: boolean, peerName: string): string {
  if (m.body === 'joined') {
    return isSelf ? 'You joined the run — say hi to the group.' : `${peerName} joined the run`;
  }
  if (m.body === 'left') return isSelf ? 'You left the run' : `${peerName} left the run`;
  return isSelf ? 'You were removed from the run' : `${peerName} was removed`;
}

export default function ChatScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const uid = useSession((s) => s.session?.user.id);
  const setActiveConversationId = useChatStore((s) => s.setActiveConversationId);
  const { blockedIds } = useBlocks();

  const [draft, setDraft] = useState('');
  const [meetingModal, setMeetingModal] = useState(false);
  const [meetingDraft, setMeetingDraft] = useState('');
  const [savingMeeting, setSavingMeeting] = useState(false);
  const [reportTarget, setReportTarget] = useState<{
    userId: string;
    name: string;
    messageId: string;
  } | null>(null);

  // Conversation metadata from the list RPC (usually a cache hit).
  const conversations = useQuery({ queryKey: qk.conversations(), queryFn: listConversations });
  const convo = conversations.data?.find((c) => c.conversation_id === conversationId);
  const isRun = convo?.kind === 'run';

  const hostQuery = useQuery({
    queryKey: qk.runHost(convo?.run_id ?? 'none'),
    enabled: convo?.run_id != null,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('runs')
        .select('host_id')
        .eq('id', convo!.run_id!)
        .single();
      if (error) throw error;
      return data;
    },
  });
  const hostId = hostQuery.data?.host_id;

  const meetingQuery = useQuery({
    queryKey: qk.meetingPoint(conversationId ?? ''),
    queryFn: () => latestMeetingPoint(conversationId!),
    enabled: isRun && conversationId != null,
  });

  const messagesQuery = useInfiniteQuery({
    queryKey: qk.conversationMessages(conversationId ?? ''),
    enabled: conversationId != null,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => fetchMessagesPage(conversationId!, pageParam),
    getNextPageParam: (lastPage) =>
      lastPage.length < MESSAGES_PAGE_SIZE ? undefined : lastPage[lastPage.length - 1]?.created_at,
  });

  const messages: LocalMessage[] = useMemo(
    () => (messagesQuery.data?.pages ?? []).flat(),
    [messagesQuery.data],
  );

  /** Prepend (newest-first page 0) if the id is not already present. */
  const appendToCache = useCallback(
    (record: MessageRow, localStatus?: LocalMessage['localStatus']) => {
      queryClient.setQueryData<Pages>(qk.conversationMessages(conversationId ?? ''), (old) => {
        if (!old) return old;
        const exists = old.pages.some((p) => p.some((m) => m.id === record.id));
        const entry: LocalMessage = { ...record, sender: null, localStatus };
        if (exists) {
          return {
            ...old,
            pages: old.pages.map((p) =>
              p.map((m) => (m.id === record.id ? { ...m, ...record, localStatus } : m)),
            ),
          };
        }
        return { ...old, pages: [[entry, ...old.pages[0]], ...old.pages.slice(1)] };
      });
    },
    [conversationId, queryClient],
  );

  useFocusEffect(
    useCallback(() => {
      if (!conversationId) return;
      setActiveConversationId(conversationId);
      void markConversationRead(conversationId).then(() => {
        void queryClient.invalidateQueries({ queryKey: qk.conversations() });
        void queryClient.invalidateQueries({ queryKey: qk.notificationsUnread() });
      });
      const unsubscribe = subscribeToConversation(conversationId, (record) => {
        // Broadcast auth is topic-level; blocked senders are dropped here (P5).
        if (record.sender_id && blockedIds.has(record.sender_id)) return;
        appendToCache(record);
        if (record.kind === 'meeting_point') {
          void queryClient.invalidateQueries({
            queryKey: qk.meetingPoint(conversationId),
          });
        }
        void markConversationRead(conversationId);
      });
      return () => {
        unsubscribe();
        setActiveConversationId(null);
      };
    }, [conversationId, appendToCache, blockedIds, queryClient, setActiveConversationId]),
  );

  const submit = async (body: string, existingId?: string) => {
    if (!conversationId) return;
    const id = existingId ?? Crypto.randomUUID();
    appendToCache(
      {
        id,
        conversation_id: conversationId,
        sender_id: uid ?? null,
        kind: 'user',
        body,
        created_at: new Date().toISOString(),
      },
      'sending',
    );
    try {
      const saved = await sendMessage({ id, conversationId, body });
      appendToCache(saved);
    } catch {
      appendToCache(
        {
          id,
          conversation_id: conversationId,
          sender_id: uid ?? null,
          kind: 'user',
          body,
          created_at: new Date().toISOString(),
        },
        'failed',
      );
    }
  };

  const onSend = () => {
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    void submit(body);
  };

  const saveMeetingPoint = async () => {
    const body = meetingDraft.trim();
    if (!body || !conversationId) return;
    setSavingMeeting(true);
    try {
      await sendMessage({ id: Crypto.randomUUID(), conversationId, body, kind: 'meeting_point' });
      await queryClient.invalidateQueries({
        queryKey: qk.meetingPoint(conversationId),
      });
      await queryClient.invalidateQueries({ queryKey: qk.conversationMessages(conversationId) });
      setMeetingModal(false);
      setMeetingDraft('');
    } finally {
      setSavingMeeting(false);
    }
  };

  const amHost = hostId != null && hostId === uid;
  const meetingPoint = meetingQuery.data;
  const peerName = convo?.peer_names[0] ?? 'Runner';
  const typeColor = isRun && convo?.run_type ? runType[convo.run_type].main : colors.ink900;

  const renderItem = ({ item, index }: { item: LocalMessage; index: number }) => {
    const mine = item.sender_id === uid;
    if (item.kind === 'system') {
      const name =
        convo?.peer_names[convo.peer_ids.indexOf(item.sender_id ?? '')] ?? 'A runner';
      return (
        <View style={styles.systemRow}>
          <Text style={styles.systemText}>{systemCopy(item, mine, name)}</Text>
        </View>
      );
    }
    if (item.kind === 'meeting_point') {
      return (
        <View style={styles.meetingInStream}>
          <MapPin size={14} color={colors.volt} />
          <Text style={styles.meetingInStreamText}>{item.body}</Text>
        </View>
      );
    }
    // Inverted list: the *next* index is the older message.
    const older = messages[index + 1];
    const showSender = !mine && (!older || older.sender_id !== item.sender_id);
    const senderName =
      item.sender?.display_name ??
      convo?.peer_names[convo.peer_ids.indexOf(item.sender_id ?? '')] ??
      'Runner';
    return (
      <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : null]}>
        {showSender ? (
          <View style={styles.senderRow}>
            <Avatar name={senderName} src={item.sender?.avatar_url ?? undefined} size="xs" />
            <Text style={styles.senderName}>{senderName}</Text>
          </View>
        ) : null}
        <Pressable
          disabled={item.localStatus !== 'failed' && mine}
          onPress={
            item.localStatus === 'failed' ? () => void submit(item.body, item.id) : undefined
          }
          onLongPress={
            !mine && item.sender_id
              ? () => setReportTarget({ userId: item.sender_id!, name: senderName, messageId: item.id })
              : undefined
          }
          style={[
            styles.bubble,
            mine ? styles.bubbleMine : styles.bubbleTheirs,
            item.localStatus === 'sending' ? styles.bubbleSending : null,
          ]}
        >
          <Text style={mine ? styles.bubbleTextMine : styles.bubbleText}>{item.body}</Text>
        </Pressable>
        <Text style={styles.timestamp}>
          {item.localStatus === 'failed'
            ? 'Failed — tap the message to retry'
            : item.localStatus === 'sending'
              ? 'Sending…'
              : format(new Date(item.created_at), 'HH:mm')}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.screen, { paddingTop: insets.top + spacing.sp2 }]}>
        {/* Header */}
        <View style={styles.header}>
          <IconButton variant="ghost" accessibilityLabel="Back" onPress={() => router.back()}>
            <ArrowLeft size={22} />
          </IconButton>
          {isRun ? (
            <View style={[styles.typeBlock, { backgroundColor: typeColor }]} />
          ) : (
            <Avatar name={peerName} src={convo?.peer_avatars[0] ?? undefined} size="sm" />
          )}
          <View style={styles.headerText}>
            <Text style={isRun ? styles.headerTitleRun : styles.headerTitleDm} numberOfLines={1}>
              {convo?.title ?? 'Chat'}
            </Text>
            <Text style={styles.headerSub} numberOfLines={1}>
              {isRun
                ? `You + ${Math.max((convo?.member_count ?? 1) - 1, 0)} going` +
                  (convo?.starts_at ? ` · ${format(new Date(convo.starts_at), 'EEE HH:mm')}` : '')
                : 'Direct message'}
            </Text>
          </View>
          {isRun && convo?.run_id ? (
            <IconButton
              variant="ghost"
              accessibilityLabel="Run details"
              onPress={() => router.push(`/run/${convo.run_id}`)}
            >
              <Info size={20} />
            </IconButton>
          ) : null}
        </View>

        {/* Pinned meeting point (run chats) */}
        {isRun ? (
          meetingPoint ? (
            <Pressable
              style={styles.meetingBanner}
              onPress={() => (amHost ? (setMeetingDraft(meetingPoint.body), setMeetingModal(true)) : null)}
            >
              <MapPin size={16} color={colors.volt} />
              <View style={styles.meetingBody}>
                <Text style={styles.meetingLabel}>MEETING POINT</Text>
                <Text style={styles.meetingText}>{meetingPoint.body}</Text>
              </View>
              {convo?.run_id ? (
                <Pressable onPress={() => router.push(`/run/${convo.run_id}`)} hitSlop={8}>
                  <Text style={styles.meetingMap}>MAP</Text>
                </Pressable>
              ) : null}
            </Pressable>
          ) : amHost ? (
            <Pressable style={styles.meetingGhost} onPress={() => setMeetingModal(true)}>
              <MapPin size={16} color={colors.ink400} />
              <Text style={styles.meetingGhostText}>SET MEETING POINT</Text>
            </Pressable>
          ) : null
        ) : null}

        {/* Stream */}
        {messagesQuery.isLoading ? (
          <View style={styles.loader}>
            <ActivityIndicator color={colors.ink900} />
          </View>
        ) : messagesQuery.isError ? (
          <View style={styles.loader}>
            <Text style={textStyles.body}>Could not load messages.</Text>
            <Button
              label="RETRY"
              size="sm"
              variant="secondary"
              onPress={() => messagesQuery.refetch()}
            />
          </View>
        ) : (
          <FlatList
            inverted
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={renderItem}
            contentContainerStyle={styles.stream}
            onEndReached={() => {
              if (messagesQuery.hasNextPage && !messagesQuery.isFetchingNextPage) {
                void messagesQuery.fetchNextPage();
              }
            }}
            onEndReachedThreshold={0.4}
            ListFooterComponent={
              messagesQuery.isFetchingNextPage ? (
                <ActivityIndicator color={colors.ink400} style={{ marginVertical: spacing.sp3 }} />
              ) : null
            }
          />
        )}

        {/* Composer */}
        <View style={[styles.composer, { paddingBottom: insets.bottom + spacing.sp3 }]}>
          <View style={styles.composerField}>
            <Input
              value={draft}
              onChangeText={setDraft}
              placeholder={isRun ? 'Message the group' : `Message ${peerName}`}
              maxLength={2000}
            />
          </View>
          <IconButton
            variant="volt"
            size="lg"
            round
            accessibilityLabel="Send"
            disabled={draft.trim().length === 0}
            onPress={onSend}
          >
            <Send size={20} />
          </IconButton>
        </View>

        {/* Meeting-point modal (host) */}
        <Modal visible={meetingModal} transparent animationType="fade">
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={textStyles.cardTitle}>Meeting point</Text>
              <Input
                value={meetingDraft}
                onChangeText={setMeetingDraft}
                placeholder="Praça do Comércio · arch · 7:50"
                maxLength={200}
                autoFocus
              />
              <View style={styles.modalActions}>
                <Button
                  label="CANCEL"
                  variant="ghost"
                  size="sm"
                  onPress={() => setMeetingModal(false)}
                />
                <Button
                  label={savingMeeting ? 'SAVING…' : 'SAVE'}
                  size="sm"
                  disabled={meetingDraft.trim().length === 0 || savingMeeting}
                  onPress={() => void saveMeetingPoint()}
                />
              </View>
            </View>
          </View>
        </Modal>

        {/* Report a message (P5 G5) */}
        {reportTarget ? (
          <ReportSheet
            visible
            onClose={() => setReportTarget(null)}
            subjectUserId={reportTarget.userId}
            subjectName={reportTarget.name}
            messageId={reportTarget.messageId}
            onBlocked={() => router.back()}
          />
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.paper2 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sp3,
    paddingHorizontal: spacing.sp3,
    paddingBottom: spacing.sp3,
    borderBottomWidth: borderWidth.hair,
    borderBottomColor: colors.ink100,
    backgroundColor: colors.paper,
  },
  typeBlock: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
  },
  headerText: { flex: 1 },
  headerTitleRun: {
    fontFamily: fonts.display,
    fontSize: typeScale.tLg,
    letterSpacing: letterSpacing(typeScale.tLg, tracking.caps),
    textTransform: 'uppercase',
    color: colors.ink900,
  },
  headerTitleDm: {
    fontFamily: fonts.bodySemiBold,
    fontSize: typeScale.tLg,
    color: colors.ink900,
  },
  headerSub: {
    fontFamily: fonts.body,
    fontSize: typeScale.tXs,
    color: colors.ink500,
  },
  meetingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sp3,
    backgroundColor: colors.ink900,
    marginHorizontal: sizing.gutter,
    marginTop: spacing.sp3,
    borderRadius: radius.md,
    padding: spacing.sp4,
    ...shadows.md,
  },
  meetingBody: { flex: 1, gap: 2 },
  meetingLabel: {
    fontFamily: fonts.displayExtra,
    fontSize: typeScale.t2xs,
    letterSpacing: letterSpacing(typeScale.t2xs, tracking.label),
    color: colors.volt,
  },
  meetingText: {
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.tSm,
    color: colors.paper,
  },
  meetingMap: {
    fontFamily: fonts.displayExtra,
    fontSize: typeScale.tSm,
    color: colors.volt,
  },
  meetingGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sp2,
    marginHorizontal: sizing.gutter,
    marginTop: spacing.sp3,
    borderRadius: radius.md,
    borderWidth: borderWidth.mid,
    borderColor: colors.ink200,
    borderStyle: 'dashed',
    paddingVertical: spacing.sp3,
  },
  meetingGhostText: {
    fontFamily: fonts.display,
    fontSize: typeScale.tSm,
    letterSpacing: letterSpacing(typeScale.tSm, tracking.caps),
    color: colors.ink500,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sp3,
  },
  stream: {
    paddingHorizontal: sizing.gutter,
    paddingVertical: spacing.sp4,
    gap: spacing.sp2,
  },
  systemRow: { alignItems: 'center', marginVertical: spacing.sp2 },
  systemText: {
    fontFamily: fonts.body,
    fontSize: typeScale.tXs,
    color: colors.ink500,
    backgroundColor: colors.ink100,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sp3,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  meetingInStream: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: spacing.sp2,
    backgroundColor: colors.ink900,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sp4,
    paddingVertical: 6,
    marginVertical: spacing.sp2,
  },
  meetingInStreamText: {
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.tXs,
    color: colors.paper,
  },
  bubbleRow: { alignItems: 'flex-start', gap: 3 },
  bubbleRowMine: { alignItems: 'flex-end' },
  senderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sp2, marginTop: spacing.sp2 },
  senderName: {
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.tXs,
    color: colors.ink500,
  },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: spacing.sp4,
    paddingVertical: spacing.sp2 + 2,
  },
  bubbleMine: {
    backgroundColor: colors.ink900,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    borderBottomRightRadius: 5,
    borderBottomLeftRadius: 15,
  },
  bubbleTheirs: {
    backgroundColor: colors.paper,
    borderWidth: borderWidth.hair,
    borderColor: colors.ink200,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    borderBottomRightRadius: 15,
    borderBottomLeftRadius: 5,
  },
  bubbleSending: { opacity: 0.55 },
  bubbleText: {
    fontFamily: fonts.body,
    fontSize: typeScale.tMd,
    color: colors.ink900,
  },
  bubbleTextMine: {
    fontFamily: fonts.body,
    fontSize: typeScale.tMd,
    color: colors.paper,
  },
  timestamp: {
    fontFamily: fonts.body,
    fontSize: typeScale.t2xs,
    color: colors.ink400,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sp3,
    paddingHorizontal: sizing.gutter,
    paddingTop: spacing.sp2,
    backgroundColor: colors.paper2,
  },
  composerField: { flex: 1 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(11,11,12,0.5)',
    justifyContent: 'center',
    paddingHorizontal: sizing.gutter,
  },
  modalCard: {
    backgroundColor: colors.paper,
    borderRadius: radius.lg,
    padding: spacing.sp5,
    gap: spacing.sp4,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sp2,
  },
});
