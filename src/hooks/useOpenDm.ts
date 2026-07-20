import { router } from 'expo-router';
import { useState } from 'react';

import { getOrCreateDm } from '@/lib/chat';

/** DM entry points (P3 D7): resolve-or-create the conversation, then open it. */
export function useOpenDm() {
  const [openingFor, setOpeningFor] = useState<string | null>(null);

  const openDm = async (userId: string) => {
    if (openingFor) return;
    setOpeningFor(userId);
    try {
      const conversationId = await getOrCreateDm(userId);
      router.push(`/chat/${conversationId}`);
    } finally {
      setOpeningFor(null);
    }
  };

  return { openDm, openingFor };
}
