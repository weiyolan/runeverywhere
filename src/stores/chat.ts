import { create } from 'zustand';

/**
 * The whole foreground-suppression mechanism (P3 D4): the chat screen writes
 * its conversation id on focus, clears on blur; the push foreground handler
 * reads it to swallow banners for the visible conversation.
 */
interface ChatState {
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  activeConversationId: null,
  setActiveConversationId: (id) => set({ activeConversationId: id }),
}));
