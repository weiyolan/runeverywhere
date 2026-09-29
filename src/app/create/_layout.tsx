import { Stack, router, useSegments } from 'expo-router';
import { useEffect } from 'react';

import { useCreateRunDraft } from '@/stores/createRun';

/** Create-run wizard: type → location → details → review (Phase 2). */
export default function CreateLayout() {
  const segments = useSegments();

  // The draft is in-memory: a web reload or a deep link into a later step
  // lands with no type picked. Mount-only, so publish's reset() can't bounce us.
  useEffect(() => {
    const step = segments[segments.length - 1];
    if (useCreateRunDraft.getState().type == null && step !== 'type') {
      router.replace('/create/type');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <Stack screenOptions={{ headerShown: false }} />;
}
