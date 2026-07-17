/**
 * Freshness wiring (P2 D5): TanStack refetch-on-focus follows RN app state,
 * and screens opt into refetch-on-navigation-focus. No realtime in P2 —
 * push/broadcast arrive with P3.
 */
import { focusManager, type QueryKey } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { AppState } from 'react-native';

import { queryClient } from '@/lib/queryClient';

// Imported once from src/app/_layout.tsx for the module side effect.
AppState.addEventListener('change', (state) => {
  focusManager.setFocused(state === 'active');
});

/** Invalidate the given keys whenever the screen regains navigation focus. */
export function useRefetchOnFocus(keys: QueryKey[]) {
  const serialized = JSON.stringify(keys);
  useFocusEffect(
    useCallback(() => {
      for (const queryKey of keys) {
        void queryClient.invalidateQueries({ queryKey });
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps -- keys identity tracked via serialization
    }, [serialized]),
  );
}
