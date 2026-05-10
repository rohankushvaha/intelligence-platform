// ============================================================
// Leela Intelligence Platform — Chat State Store (Zustand)
// ============================================================

import { create } from 'zustand';
import type { Message, ChatStore, ChatState } from '../types';

const initialChatState = (): ChatState => ({
  messages: [],
  isLoading: false,
  error: null,
});

export const useChatStore = create<ChatStore>((set) => ({
  guest: initialChatState(),
  investor: initialChatState(),
  internal: initialChatState(),

  addMessage: (mode, message) =>
    set((state) => ({
      [mode]: {
        ...state[mode],
        messages: [...state[mode].messages, message],
      },
    })),

  setLoading: (mode, loading) =>
    set((state) => ({
      [mode]: { ...state[mode], isLoading: loading },
    })),

  setError: (mode, error) =>
    set((state) => ({
      [mode]: { ...state[mode], error },
    })),

  updateLastMessage: (mode, content, sources) =>
    set((state) => {
      const messages = [...state[mode].messages];
      const lastIndex = messages.length - 1;
      if (lastIndex >= 0 && messages[lastIndex].role === 'assistant') {
        messages[lastIndex] = {
          ...messages[lastIndex],
          content,
          sources: sources ?? messages[lastIndex].sources,
        };
      }
      return { [mode]: { ...state[mode], messages } };
    }),

  clearMessages: (mode) =>
    set(() => ({
      [mode]: { ...initialChatState() },
    })),

  markStreamingDone: (mode) =>
    set((state) => {
      const messages = [...state[mode].messages];
      const lastIndex = messages.length - 1;
      if (lastIndex >= 0) {
        messages[lastIndex] = { ...messages[lastIndex], isStreaming: false };
      }
      return { [mode]: { ...state[mode], messages, isLoading: false } };
    }),
}));

/**
 * Build Gemini-compatible history from message array.
 * Excludes the last user message (which will be the new query).
 */
export function buildGeminiHistory(
  messages: Message[]
): Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> {
  // Take up to last 10 messages for context, excluding any streaming messages
  const completed = messages
    .filter((m) => !m.isStreaming && m.content.trim().length > 0)
    .slice(-10);

  return completed.map((m) => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }));
}

/**
 * Generate a unique message ID.
 */
export function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
