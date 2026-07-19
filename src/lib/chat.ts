/**
 * Chat service (P3 D2) — screens stay presentational. Messages persist first
 * (INSERT under RLS); broadcast delivery is the DB trigger's job, the client
 * never channel.send()s.
 */
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database.types';

export type ConversationRow =
  Database['public']['Functions']['list_conversations']['Returns'][number];
export type MessageRow = Database['public']['Tables']['messages']['Row'];

export interface MessageWithSender extends MessageRow {
  sender: { id: string; display_name: string; avatar_url: string | null } | null;
}

export const MESSAGES_PAGE_SIZE = 30;

export async function listConversations(): Promise<ConversationRow[]> {
  const { data, error } = await supabase.rpc('list_conversations');
  if (error) throw error;
  return data;
}

export async function fetchMessagesPage(
  conversationId: string,
  cursor?: string,
): Promise<MessageWithSender[]> {
  let query = supabase
    .from('messages')
    .select('*, sender:profiles(id, display_name, avatar_url)')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(MESSAGES_PAGE_SIZE);
  if (cursor) query = query.lt('created_at', cursor);
  const { data, error } = await query;
  if (error) throw error;
  return data as MessageWithSender[];
}

export async function sendMessage(args: {
  id: string;
  conversationId: string;
  body: string;
  kind?: 'user' | 'meeting_point';
}): Promise<MessageRow> {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) throw new Error('not signed in');
  const { data, error } = await supabase
    .from('messages')
    .insert({
      id: args.id,
      conversation_id: args.conversationId,
      sender_id: uid,
      kind: args.kind ?? 'user',
      body: args.body,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getOrCreateDm(otherUserId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_or_create_dm', { p_other_user: otherUserId });
  if (error) throw error;
  return data;
}

export async function markConversationRead(conversationId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_conversation_read', {
    p_conversation_id: conversationId,
  });
  if (error) throw error;
}

export async function latestMeetingPoint(conversationId: string): Promise<MessageRow | null> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .eq('kind', 'meeting_point')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}
