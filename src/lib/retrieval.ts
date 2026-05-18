// ============================================================
// Leela Intelligence Platform v2 — RAG Pipeline
// ============================================================
// Changes from v1:
//   - Hybrid search: passes query_text alongside embedding
//   - Source type filter: pass sourceFilter to vectorSearch
//   - Context builder uses buildContext() for source_type labels
//   - Yields sourceTypes alongside sources for UI badges
//   - retrieve top 10 instead of 8 (reranking filters down)
// ============================================================

import { embedText, streamWithContext, generateWithContext, buildContext } from './gemini';
import { vectorSearch, competitorSearch } from './supabase';
import type { DocumentChunk, Mode, RetrievalResult, SourceFilter, SourceType } from '../types';

/**
 * Full RAG pipeline: embed → hybrid search → build context → stream.
 *
 * v2 upgrades:
 *   - query_text passed for BM25 hybrid scoring
 *   - sourceFilter passed for knowledge tier filtering
 *   - sourceTypes emitted for UI source badges
 *   - buildContext() includes source_type labels in LLM context
 */
export async function* retrieveAndStream(
  query       : string,
  mode        : Mode,
  history     : Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [],
  sourceFilter: SourceFilter = 'all',
): AsyncGenerator<{
  chunk?      : string;
  sources?    : string[];
  sourceTypes?: SourceType[];
  done?       : boolean;
}> {
  // Step 1 — Embed the query
  let queryEmbedding: number[];
  try {
    queryEmbedding = await embedText(query);
  } catch (err) {
    throw new Error(`Embedding failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }

  // Step 2 — Hybrid search (vector + BM25)
  let chunks: DocumentChunk[] = [];
  try {
    chunks = await vectorSearch(
      queryEmbedding,
      mode,
      10,                                               // retrieve top 10
      0.25,                                             // similarity threshold
      query,                                            // NEW — enables BM25 hybrid scoring
      sourceFilter === 'all' ? null : sourceFilter,     // NEW — knowledge tier filter
    );
  } catch (err) {
    console.warn('[LIP] Vector search failed, proceeding without context:', err);
  }

  // Step 3 — Build context with source type labels
  // buildContext() prefixes each chunk with [OFFICIAL SOURCE: ...] etc.
  // This lets the LLM know which tier the information comes from.
  const context = buildContext(chunks);

  // Step 4 — Emit source metadata before streaming starts
  const uniqueSources   = [...new Set(chunks.map(c => c.source_name).filter(Boolean))];
  const uniqueSourceTypes = [...new Set(chunks.map(c => c.source_type).filter(Boolean))] as SourceType[];
  yield { sources: uniqueSources, sourceTypes: uniqueSourceTypes };

  // Step 5 — Stream response from Groq
  for await (const textChunk of streamWithContext(query, context, mode, history)) {
    yield { chunk: textChunk };
  }

  yield { done: true };
}

/**
 * Competitor comparison — runs two parallel searches:
 * one against official Leela content, one against competitive content.
 * Used by the Internal Copilot competitor intelligence panel.
 */
export async function retrieveCompetitorComparison(
  query: string,
): Promise<{
  leelaChunks      : DocumentChunk[];
  competitorChunks : DocumentChunk[];
}> {
  const queryEmbedding = await embedText(query);

  const [leelaChunks, competitorChunks] = await Promise.all([
    vectorSearch(queryEmbedding, 'internal', 5, 0.25, query, 'official'),
    competitorSearch(queryEmbedding, 5),
  ]);

  return { leelaChunks, competitorChunks };
}

/**
 * Non-streaming variant for use cases requiring complete response at once.
 */
export async function retrieveAndGenerate(
  query       : string,
  mode        : Mode,
  sourceFilter: SourceFilter = 'all',
): Promise<RetrievalResult> {
  const queryEmbedding = await embedText(query);

  const chunks = await vectorSearch(
    queryEmbedding,
    mode,
    10,
    0.25,
    query,
    sourceFilter === 'all' ? null : sourceFilter,
  );

  const context = buildContext(chunks);

  const response = await generateWithContext(query, context, mode);

  return {
    response,
    sources     : [...new Set(chunks.map(c => c.source_name).filter(Boolean))],
    sourceTypes : [...new Set(chunks.map(c => c.source_type).filter(Boolean))] as SourceType[],
  };
}
