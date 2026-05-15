// ============================================================
// Leela Intelligence Platform v2 — Supabase Client & Hybrid Search
// ============================================================
// Changes from v1:
//   - vectorSearch now passes query_text for hybrid search (vector + BM25)
//   - Added source_type_filter parameter for knowledge tier filtering
//   - DocumentChunk type extended with v2 fields
//   - match_documents RPC params aligned with v2 migration
// ============================================================

import { createClient } from '@supabase/supabase-js';
import type { DocumentChunk, Mode } from '../types';

const supabaseUrl    = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ── Source type filter union ───────────────────────────────────────────────
export type SourceTypeFilter = 'official' | 'press' | 'competitive' | 'ugc' | null;

/**
 * Hybrid vector + keyword search against the documents table.
 *
 * v2 upgrade: passes query_text alongside the embedding vector so the
 * match_documents RPC can combine vector similarity (70%) with BM25
 * full-text search (30%) via Reciprocal Rank Fusion.
 *
 * This significantly improves precision for named-entity queries like
 * "Jamavar New Delhi", "ESPA Udaipur", "RevPAR FY2024" where keyword
 * matching catches what embedding similarity misses.
 */
export async function vectorSearch(
  queryEmbedding    : number[],
  mode              : Mode,
  matchCount        : number = 8,
  matchThreshold    : number = 0.3,
  queryText         : string | null = null,
  sourceTypeFilter  : SourceTypeFilter = null,
): Promise<DocumentChunk[]> {
  const { data, error } = await supabase.rpc('match_documents', {
    query_embedding    : queryEmbedding,
    query_text         : queryText,          // NEW — enables BM25 hybrid scoring
    match_count        : matchCount,
    filter             : { mode },           // v2 RPC uses filter jsonb, not match_mode
    source_type_filter : sourceTypeFilter,   // NEW — filter by knowledge tier
  });

  if (error) {
    console.error('[LIP] Vector search error:', error);
    throw new Error(`Vector search failed: ${error.message}`);
  }

  return (data ?? []) as DocumentChunk[];
}

/**
 * Competitor-specific search — only returns source_type='competitive' rows.
 * Used by the Internal Copilot competitor intelligence panel.
 */
export async function competitorSearch(
  queryEmbedding : number[],
  matchCount     : number = 5,
): Promise<DocumentChunk[]> {
  const { data, error } = await supabase.rpc('match_documents_competitive', {
    query_embedding : queryEmbedding,
    match_count     : matchCount,
  });

  if (error) {
    console.error('[LIP] Competitor search error:', error);
    throw new Error(`Competitor search failed: ${error.message}`);
  }

  return (data ?? []) as DocumentChunk[];
}

/**
 * Fetch knowledge base health stats for the Admin Dashboard.
 * Returns chunk counts grouped by source_type and mode.
 */
export async function fetchKBStats() {
  const { data, error } = await supabase
    .from('documents')
    .select('source_name, source_type, mode, updated_at');

  if (error) throw new Error(`KB stats failed: ${error.message}`);

  const rows = data ?? [];

  // Total count
  const totalChunks = rows.length;

  // By source_type
  const bySourceType = ['official', 'press', 'competitive', 'ugc'].map(st => ({
    source_type  : st,
    count        : rows.filter(r => r.source_type === st).length,
    last_updated : rows
      .filter(r => r.source_type === st)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0]
      ?.updated_at ?? null,
  }));

  // By source name
  const sourceMap = new Map<string, { count: number; last_updated: string | null; source_type: string; mode: string }>();
  rows.forEach(row => {
    const existing = sourceMap.get(row.source_name);
    sourceMap.set(row.source_name, {
      count        : (existing?.count ?? 0) + 1,
      last_updated : !existing?.last_updated || row.updated_at > existing.last_updated
        ? row.updated_at
        : existing.last_updated,
      source_type  : row.source_type,
      mode         : row.mode,
    });
  });

  return {
    totalChunks,
    bySourceType,
    bySources: Array.from(sourceMap.entries()).map(([name, v]) => ({ source_name: name, ...v })),
  };
}

/**
 * Fetch all document records for the admin panel (no embeddings for performance).
 */
export async function fetchAllDocuments() {
  const { data, error } = await supabase
    .from('documents')
    .select('id, source_name, source_url, source_type, mode, chunk_index, created_at, content')
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch documents: ${error.message}`);
  return data ?? [];
}

/**
 * Delete all chunks for a given source name.
 */
export async function deleteDocumentBySource(sourceName: string): Promise<void> {
  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('source_name', sourceName);

  if (error) throw new Error(`Failed to delete document: ${error.message}`);
}

/**
 * Upsert document chunks — used by the BulkIngest admin panel.
 */
export async function upsertDocumentChunks(
  chunks: Array<{
    content     : string;
    embedding   : number[];
    source_name : string;
    source_url  : string;
    source_type : string;
    mode        : Mode | 'all';
    chunk_index : number;
  }>
): Promise<void> {
  const { error } = await supabase.from('documents').upsert(chunks, { onConflict: 'id' });
  if (error) throw new Error(`Failed to upsert document chunks: ${error.message}`);
}
