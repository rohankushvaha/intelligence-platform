// ============================================================
// Leela Intelligence Platform — RAG Query Hook
// ============================================================

import { useCallback } from 'react';
import { retrieveAndStream } from '../lib/retrieval';
import { useChatStore, buildGeminiHistory, generateMessageId } from './useChat';
import type { Mode, Message } from '../types';

/**
 * Hook that wires the RAG retrieval pipeline into the Zustand chat store.
 * Returns a `sendMessage` function that:
 *   1. Adds the user message to the store
 *   2. Adds a streaming placeholder for the assistant
 *   3. Runs the RAG pipeline and streams token-by-token into the store
 *   4. Finalises the message with sources on completion
 */
export function useRetrieval(mode: Mode) {
  const { addMessage, setLoading, setError, updateLastMessage, markStreamingDone } =
    useChatStore();
  const modeState = useChatStore((state) => state[mode]);

  const sendMessage = useCallback(
    async (query: string) => {
      if (!query.trim() || modeState.isLoading) return;

      setError(mode, null);
      setLoading(mode, true);

      // Add user message
      const userMessage: Message = {
        id: generateMessageId(),
        role: 'user',
        content: query.trim(),
        timestamp: new Date(),
      };
      addMessage(mode, userMessage);

      // Add streaming assistant placeholder
      const assistantMessage: Message = {
        id: generateMessageId(),
        role: 'assistant',
        content: '',
        sources: [],
        timestamp: new Date(),
        isStreaming: true,
      };
      addMessage(mode, assistantMessage);

      // Build conversation history (exclude the messages we just added)
      const history = buildGeminiHistory(
        modeState.messages.filter((m) => !m.isStreaming)
      );

      let accumulatedContent = '';
      let sources: string[] = [];

      try {
        for await (const event of retrieveAndStream(query, mode, history)) {
          if (event.sources !== undefined) {
            sources = event.sources;
          }
          if (event.chunk) {
            accumulatedContent += event.chunk;
            updateLastMessage(mode, accumulatedContent, sources);
          }
          if (event.done) {
            break;
          }
        }
      } catch (err) {
        const errorMsg =
          err instanceof Error
            ? err.message
            : 'An unexpected error occurred. Please try again.';

        // Replace the streaming placeholder with an error message
        updateLastMessage(
          mode,
          `I apologise, but I encountered an error while processing your request. ${errorMsg} Please try again or contact our team directly.`,
          []
        );
        setError(mode, errorMsg);
      } finally {
        markStreamingDone(mode);
      }
    },
    [mode, modeState, addMessage, setLoading, setError, updateLastMessage, markStreamingDone]
  );

  return {
    messages: modeState.messages,
    isLoading: modeState.isLoading,
    error: modeState.error,
    sendMessage,
  };
}
