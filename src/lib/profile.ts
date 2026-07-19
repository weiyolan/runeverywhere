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
