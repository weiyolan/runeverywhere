import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

import { supabase } from '@/lib/supabase';

type SessionStatus = 'loading' | 'signedOut' | 'signedIn';

interface SessionState {
  status: SessionStatus;
  session: Session | null;
  /** Subscribe to Supabase auth state; resolves to signedOut when unconfigured. */
  init: () => void;
  /**
   * Scaffold-only escape hatch so the app is navigable before Phase 1 wires
   * real auth. Remove when sign-in screens talk to Supabase.
   */
  devSignIn: () => void;
  signOut: () => Promise<void>;
}

export const useSession = create<SessionState>((set) => ({
  status: 'loading',
  session: null,

  init: () => {
    if (!supabase) {
      set({ status: 'signedOut', session: null });
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      set({ session: data.session, status: data.session ? 'signedIn' : 'signedOut' });
    });
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, status: session ? 'signedIn' : 'signedOut' });
    });
  },

  devSignIn: () => set({ status: 'signedIn' }),

  signOut: async () => {
    await supabase?.auth.signOut();
    set({ session: null, status: 'signedOut' });
  },
}));
