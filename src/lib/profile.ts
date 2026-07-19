/**
 * Own-profile write helpers (P1 H) — onboarding writes through, prefills from
 * `useSession().profile`. Column grants (migration 11) cap what can change.
 */
import { decode } from 'base64-arraybuffer';
import { File } from 'expo-file-system';

import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database.types';

type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('not signed in');
  return data.user.id;
}

export async function updateProfile(patch: ProfileUpdate) {
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', await uid())
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Upload the picked image to `avatars/<uid>/avatar.jpg` (upsert) and return
 * the public URL with a cache-buster.
 */
export async function uploadAvatar(localUri: string): Promise<string> {
  const userId = await uid();
  const base64 = await new File(localUri).base64();
  const path = `${userId}/avatar.jpg`;
  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, decode(base64), { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

export async function setHomeLocation(lat: number, lng: number, city: string) {
  const { data, error } = await supabase.rpc('set_home_location', {
    p_lat: lat,
    p_lng: lng,
    p_city: city,
  });
  if (error) throw error;
  return data;
}

// --- P5 profile reads -------------------------------------------------------

export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
export type BadgeRow = Database['public']['Tables']['badges']['Row'];
export type LevelRow = Database['public']['Tables']['levels']['Row'];

export interface BadgeWithEarned extends BadgeRow {
  earned_at: string | null;
}

export interface ReviewWithAuthor {
  id: string;
  stars: number;
  tags: string[];
  note: string;
  created_at: string;
  reviewer: { id: string; display_name: string; avatar_url: string | null } | null;
  run: { title: string } | null;
}

/** Null when the row is unreadable (hidden / blocked-by-them / deleted). */
export async function fetchProfile(id: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchProfileStats(id: string) {
  const { data, error } = await supabase.rpc('get_profile_stats', { p_user_id: id });
  if (error) throw error;
  return data[0] ?? null;
}

export async function canViewProfile(id: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('can_view_profile', { p_profile_id: id });
  if (error) throw error;
  return data;
}

/** Full catalog left-joined with the user's earned rows. */
export async function fetchBadges(userId: string): Promise<BadgeWithEarned[]> {
  const [catalogRes, earnedRes] = await Promise.all([
    supabase.from('badges').select('*').eq('active', true).order('sort'),
    supabase.from('user_badges').select('badge_code, earned_at').eq('user_id', userId),
  ]);
  if (catalogRes.error) throw catalogRes.error;
  if (earnedRes.error) throw earnedRes.error;
  const earned = new Map(earnedRes.data.map((b) => [b.badge_code, b.earned_at]));
  return catalogRes.data.map((b) => ({ ...b, earned_at: earned.get(b.code) ?? null }));
}

export async function fetchReviews(revieweeId: string): Promise<ReviewWithAuthor[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select(
      'id, stars, tags, note, created_at, reviewer:profiles!reviews_reviewer_id_fkey(id, display_name, avatar_url), run:runs(title)',
    )
    .eq('reviewee_id', revieweeId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data as unknown as ReviewWithAuthor[];
}

export async function fetchLevels(): Promise<LevelRow[]> {
  const { data, error } = await supabase.from('levels').select('*').order('level');
  if (error) throw error;
  return data;
}
