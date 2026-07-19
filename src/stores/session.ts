import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

import { syncRealtimeAuth } from '@/lib/realtime';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database.types';

type SessionStatus = 'loading' | 'signedOut' | 'signedIn';
export type Profile = Database['public']['Tables']['profiles']['Row'];

interface SessionState {
  status: SessionStatus;
  session: Session | null;
  /** Own profile row; null until fetched (or when signed out / dev bypass). */
  profile: Profile | null;
  profileStatus: 'idle' | 'loading' | 'ready' | 'error';
  /** Subscribe to Supabase auth state. */
  init: () => void;
  /** Refetch own profile (onboarding writes call this explicitly). */
  refreshProfile: () => Promise<void>;
  /** Password-recovery deep link in progress — AuthGate suspends redirects. */
  recovering: boolean;
  setRecovering: (recovering: boolean) => void;
  signOut: () => Promise<void>;
}

export const useSession = create<SessionState>((set, get) => ({
  status: 'loading',
  session: null,
  profile: null,
  profileStatus: 'idle',

  init: () => {
    supabase.auth.getSession().then(({ data }) => {
      set({ session: data.session, status: data.session ? 'signedIn' : 'signedOut' });
      if (data.session) void get().refreshProfile();
    });
    supabase.auth.onAuthStateChange((_event, session) => {
      const hadSession = get().session != null;
      set({ session, status: session ? 'signedIn' : 'signedOut' });
      // Private Broadcast channels need the fresh token on the socket (P3 D3)
      if (session) syncRealtimeAuth();
      if (session && !hadSession) void get().refreshProfile();
      if (!session) set({ profile: null, profileStatus: 'idle' });
    });
  },

  refreshProfile: async () => {
    const uid = get().session?.user.id;
    if (!uid) return;
    set({ profileStatus: 'loading' });
    const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).single();
    if (error) {
      set({ profileStatus: 'error' });
      return;
    }
    set({ profile: data, profileStatus: 'ready' });
  },

  recovering: false,
  setRecovering: (recovering) => set({ recovering }),

  signOut: async () => {
    // Dynamic import dodges a require cycle (notifications → supabase → …).
    const { unregisterPush } = await import('@/lib/notifications');
    await unregisterPush();
    await supabase.auth.signOut();
    set({ session: null, status: 'signedOut', profile: null, profileStatus: 'idle' });
  },
}));
