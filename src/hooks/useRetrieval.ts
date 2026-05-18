// ============================================================
// Leela Intelligence Platform v2 — RAG Query Hook
// ============================================================
// Changes from v1:
//   - Accepts sourceFilter prop for knowledge tier filtering
//   - Passes sourceTypes through to message store for UI badges
//   - Passes query_text to retrieval for hybrid BM25 search
// ============================================================

import { useCallback, useState } from 'react';
import { retrieveAndStream } from '../lib/retrieval';
import { useChatStore, buildGeminiHistory, generateMessageId } from './useChat';
import type { Mode, Message, SourceFilter, SourceType } from '../types';

/**
 * Hook that wires the v2 RAG retrieval pipeline into the Zustand chat store.
 *
 * v2 additions:
 *   - sourceFilter: knowledge tier filter ('all' | 'official' | 'press' | 'competitive')
 *   - sourceTypes: emitted per message for SourceBadge UI components
 */
export function useRetrieval(mode: Mode, sourceFilter: SourceFilter = 'all') {
  const {
    addMessage,
    setLoading,
    setError,
    updateLastMessage,
    markStreamingDone,
  } = useChatStore();

  const modeState = useChatStore((state) => state[mode]);

  const sendMessage = useCallback(
    async (query: string) => {
      if (!query.trim() || modeState.isLoading) return;

      setError(mode, null);
      setLoading(mode, true);

      // Add user message
      const userMessage: Message = {
        id        : generateMessageId(),
        role      : 'user',
        content   : query.trim(),
        timestamp : new Date(),
      };
      addMessage(mode, userMessage);

      // Add streaming assistant placeholder
      const assistantMessage: Message = {
        id          : generateMessageId(),
        role        : 'assistant',
        content     : '',
        sources     : [],
        sourceTypes : [],
        timestamp   : new Date(),
        isStreaming : true,
      };
      addMessage(mode, assistantMessage);

      // Build conversation history
      const history = buildGeminiHistory(
        modeState.messages.filter((m) => !m.isStreaming)
      );

      let accumulatedContent = '';
      let sources     : string[]     = [];
      let sourceTypes : SourceType[] = [];

      try {
        for await (const event of retrieveAndStream(query, mode, history, sourceFilter)) {
          if (event.sources !== undefined) {
            sources = event.sources;
          }
          if (event.sourceTypes !== undefined) {
            sourceTypes = event.sourceTypes;
          }
          if (event.chunk) {
            accumulatedContent += event.chunk;
            updateLastMessage(mode, accumulatedContent, sources, sourceTypes);
          }
          if (event.done) break;
        }
      } catch (err) {
        const errorMsg = err instanceof Error
          ? err.message
          : 'An unexpected error occurred. Please try again.';

        updateLastMessage(
          mode,
          `I apologise, but I encountered an error while processing your request. ${errorMsg} Please try again or contact our team directly.`,
          [],
          [],
        );
        setError(mode, errorMsg);
      } finally {
        markStreamingDone(mode);
      }
    },
    [mode, modeState, sourceFilter, addMessage, setLoading, setError, updateLastMessage, markStreamingDone]
  );

  return {
    messages  : modeState.messages,
    isLoading : modeState.isLoading,
    error     : modeState.error,
    sendMessage,
  };
}
