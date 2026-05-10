// ============================================================
// Leela Intelligence Platform — RAG Pipeline
// ============================================================

import { embedText, streamWithContext, generateWithContext } from './gemini';
import { vectorSearch } from './supabase';
import type { DocumentChunk, Mode, RetrievalResult } from '../types';

/**
 * Full RAG pipeline: embed query → vector search → build context → stream response.
 * Yields text chunks as they stream in from Gemini.
 */
export async function* retrieveAndStream(
  query: string,
  mode: Mode,
  history: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = []
): AsyncGenerator<{ chunk?: string; sources?: string[]; done?: boolean }> {
  // Step 1: Embed the user query
  let queryEmbedding: number[];
  try {
    queryEmbedding = await embedText(query);
  } catch (err) {
    throw new Error(`Embedding failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }

  // Step 2: Vector similarity search — retrieve top 8 chunks
  let chunks: DocumentChunk[] = [];
  try {
    chunks = await vectorSearch(queryEmbedding, mode, 8, 0.25);
  } catch (err) {
    // Non-fatal: proceed with empty context if search fails
    console.warn('Vector search failed, proceeding without context:', err);
  }

  // Step 3: Build context string from retrieved chunks
  const context = chunks.length > 0
    ? chunks
        .map(c => `[Source: ${c.source_name}]\n${c.content}`)
        .join('\n\n---\n\n')
    : '';

  // Step 4: Emit sources metadata before streaming starts
  const uniqueSources = [...new Set(chunks.map(c => c.source_name).filter(Boolean))];
  yield { sources: uniqueSources };

  // Step 5: Stream response from Gemini grounded in context
  for await (const textChunk of streamWithContext(query, context, mode, history)) {
    yield { chunk: textChunk };
  }

  yield { done: true };
}

/**
 * Non-streaming variant for use cases requiring complete response at once.
 */
export async function retrieveAndGenerate(
  query: string,
  mode: Mode
): Promise<RetrievalResult> {
  const queryEmbedding = await embedText(query);
  const chunks = await vectorSearch(queryEmbedding, mode, 8, 0.25);

  const context = chunks.length > 0
    ? chunks.map(c => `[Source: ${c.source_name}]\n${c.content}`).join('\n\n---\n\n')
    : '';

  const response = await generateWithContext(query, context, mode);

  return {
    response,
    sources: [...new Set(chunks.map(c => c.source_name).filter(Boolean))],
  };
}
