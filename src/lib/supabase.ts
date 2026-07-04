import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Null until EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY are set (see .env.example),
 * so the scaffold runs without a backend. Callers must handle the null case
 * until Phase 1 wires real auth.
 */
export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          // React Native has no URL-based session detection
          detectSessionInUrl: false,
        },
      })
    : null;
