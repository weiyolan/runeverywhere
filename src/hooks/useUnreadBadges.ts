/**
 * Unread badges (P3 D8): messages-tab dot + notification-bell count. Both read
 * the same tables the center reads, so counts can never disagree.
 */
import { useQuery } from '@tanstack/react-query';

import { listConversations } from '@/lib/chat';
import { qk } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/stores/session';

export function useUnreadBadges() {
  const signedIn = useSession((s) => s.status === 'signedIn');

  const conversations = useQuery({
    queryKey: qk.conversations(),
    queryFn: listConversations,
    enabled: signedIn,
  });

  const unreadCount = useQuery({
    queryKey: qk.notificationsUnread(),
    enabled: signedIn,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .is('read_at', null);
      if (error) throw error;
      return count ?? 0;
    },
  });

  return {
    messagesUnread: (conversations.data ?? []).some((c) => c.unread_count > 0),
    notificationsUnread: unreadCount.data ?? 0,
  };
}
