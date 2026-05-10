// ============================================================
// Leela Intelligence Platform — Supabase Client & Vector Search
// ============================================================

import { createClient } from '@supabase/supabase-js';
import type { DocumentChunk, Mode } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Perform a vector similarity search against the documents table.
 * Calls the match_documents RPC function defined in the migration.
 */
export async function vectorSearch(
  queryEmbedding: number[],
  mode: Mode,
  matchCount = 8,
  matchThreshold = 0.3
): Promise<DocumentChunk[]> {
  const { data, error } = await supabase.rpc('match_documents', {
    query_embedding: queryEmbedding,
    match_mode: mode,
    match_count: matchCount,
    match_threshold: matchThreshold,
  });

  if (error) {
    console.error('Vector search error:', error);
    throw new Error(`Vector search failed: ${error.message}`);
  }

  return (data ?? []) as DocumentChunk[];
}

/**
 * Insert document chunks with their embeddings into the documents table.
 */
export async function upsertDocumentChunks(
  chunks: Array<{
    content: string;
    embedding: number[];
    source_name: string;
    source_url: string;
    mode: Mode | 'all';
    chunk_index: number;
  }>
): Promise<void> {
  const { error } = await supabase.from('documents').insert(chunks);

  if (error) {
    throw new Error(`Failed to insert document chunks: ${error.message}`);
  }
}

/**
 * Fetch all document records for the admin panel (without embeddings for performance).
 */
export async function fetchAllDocuments() {
  const { data, error } = await supabase
    .from('documents')
    .select('id, source_name, source_url, mode, chunk_index, created_at, content')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch documents: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Delete all chunks belonging to a given source document.
 */
export async function deleteDocumentBySource(sourceName: string): Promise<void> {
  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('source_name', sourceName);

  if (error) {
    throw new Error(`Failed to delete document: ${error.message}`);
  }
}

/**
 * Delete a single chunk by its ID.
 */
export async function deleteDocumentById(id: string): Promise<void> {
  const { error } = await supabase.from('documents').delete().eq('id', id);

  if (error) {
    throw new Error(`Failed to delete chunk: ${error.message}`);
  }
}
