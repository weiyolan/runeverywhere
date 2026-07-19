/**
 * Cached block set (P5 E2) — own `blocks` rows are exactly the blocker's set.
 * The chat screen uses it to drop live broadcasts from blocked senders
 * (surface #5: topic-level Broadcast auth can't filter per sender).
 */
import { useQuery } from '@tanstack/react-query';

import { qk } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/stores/session';

export function useBlocks() {
  const signedIn = useSession((s) => s.status === 'signedIn');
  const query = useQuery({
    queryKey: qk.blocks(),
    enabled: signedIn,
    queryFn: async () => {
      const { data, error } = await supabase.from('blocks').select('blocked_id');
      if (error) throw error;
      return new Set(data.map((b) => b.blocked_id));
    },
  });
  const set = query.data ?? new Set<string>();
  return { blockedIds: set, isBlocked: (id: string) => set.has(id) };
}
