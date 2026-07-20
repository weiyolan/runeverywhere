/**
 * Safety service (P5 G2): contacts, live share, reports, blocks, SMS compose.
 * SOS is compose-only — the user always presses send; no dispatch claims.
 */
import * as SMS from 'expo-sms';
import { Share } from 'react-native';

import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database.types';

export type SafetyContact = Database['public']['Tables']['safety_contacts']['Row'];
export type ReportReason = Database['public']['Enums']['report_reason'];
export type LiveShareSession = Database['public']['Tables']['live_share_sessions']['Row'];

export async function listContacts(): Promise<SafetyContact[]> {
  const { data, error } = await supabase
    .from('safety_contacts')
    .select('*')
    .order('is_emergency', { ascending: false })
    .order('created_at');
  if (error) throw error;
  return data;
}

export async function saveContact(contact: {
  id?: string;
  name: string;
  phone: string;
  label: string;
  is_emergency: boolean;
}): Promise<SafetyContact> {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) throw new Error('not signed in');
  const row = { ...contact, user_id: uid };
  const { data, error } = contact.id
    ? await supabase.from('safety_contacts').update(row).eq('id', contact.id).select().single()
    : await supabase.from('safety_contacts').insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function deleteContact(id: string): Promise<void> {
  const { error } = await supabase.from('safety_contacts').delete().eq('id', id);
  if (error) throw error;
}

// --- Live share -------------------------------------------------------------

export async function startLiveShare(runId?: string): Promise<LiveShareSession> {
  const { data, error } = await supabase.rpc('start_live_share', { p_run_id: runId });
  if (error) throw error;
  return data;
}

export async function endLiveShare(): Promise<void> {
  const { error } = await supabase.rpc('end_live_share');
  if (error) throw error;
}

export async function upsertLiveLocation(
  sessionId: string,
  point: { lat: number; lng: number; accuracyM?: number; distanceKm?: number; elapsedS?: number },
): Promise<void> {
  const { error } = await supabase.from('live_locations').upsert({
    session_id: sessionId,
    lat: point.lat,
    lng: point.lng,
    accuracy_m: point.accuracyM ?? null,
    distance_km: point.distanceKm ?? null,
    elapsed_s: point.elapsedS ?? null,
    recorded_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export const liveShareUrl = (token: string) =>
  `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/live-share-page?token=${token}`;

// --- Reports + blocks -------------------------------------------------------

export async function insertReport(report: {
  subjectUserId: string;
  reason: ReportReason;
  note: string;
  runId?: string;
  messageId?: string;
}): Promise<void> {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) throw new Error('not signed in');
  const { error } = await supabase.from('reports').insert({
    reporter_id: uid,
    subject_user_id: report.subjectUserId,
    reason: report.reason,
    note: report.note,
    run_id: report.runId ?? null,
    message_id: report.messageId ?? null,
  });
  if (error) throw error;
}

export async function block(userId: string): Promise<void> {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) throw new Error('not signed in');
  const { error } = await supabase
    .from('blocks')
    .insert({ blocker_id: uid, blocked_id: userId });
  if (error && error.code !== '23505') throw error; // already blocked is fine
}

export async function unblock(userId: string): Promise<void> {
  const { error } = await supabase.from('blocks').delete().eq('blocked_id', userId);
  if (error) throw error;
}

export interface BlockedProfile {
  blocked_id: string;
  created_at: string;
  profile: { display_name: string; avatar_url: string | null } | null;
}

export async function listBlocked(): Promise<BlockedProfile[]> {
  const { data, error } = await supabase
    .from('blocks')
    .select('blocked_id, created_at, profile:profiles!blocks_blocked_id_fkey(display_name, avatar_url)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as unknown as BlockedProfile[];
}

// --- SMS --------------------------------------------------------------------

/** Composer only; falls back to the share sheet where SMS is unavailable. */
export async function composeSms(phones: string[], message: string): Promise<void> {
  const available = await SMS.isAvailableAsync();
  if (available && phones.length > 0) {
    await SMS.sendSMSAsync(phones, message);
  } else {
    await Share.share({ message });
  }
}
