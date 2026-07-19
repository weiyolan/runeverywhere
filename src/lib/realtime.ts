/**
 * Realtime subscription helpers (P3 D3). Only the focused chat screen ever
 * subscribes (PLAN.md §6 quota mitigation).
 */
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database.types';

type MessageRow = Database['public']['Tables']['messages']['Row'];

/**
 * Subscribe to a conversation's private Broadcast channel. Returns an
 * unsubscribe closure — call it on screen blur.
 */
export function subscribeToConversation(
  conversationId: string,
  onInsert: (message: MessageRow) => void,
): () => void {
  const channel = supabase
    .channel(`conversation:${conversationId}`, { config: { private: true } })
    .on('broadcast', { event: 'INSERT' }, (msg) => {
      const record = (msg.payload as { record?: MessageRow } | undefined)?.record;
      if (record) onInsert(record);
    })
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

/**
 * Private channels require the access token on the socket — call on sign-in
 * and token refresh (wired into the session store).
 */
export function syncRealtimeAuth() {
  void supabase.realtime.setAuth();
}
