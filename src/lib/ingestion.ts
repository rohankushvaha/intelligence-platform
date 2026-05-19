// ============================================================
// Leela Intelligence Platform — Document Ingestion Pipeline
// ============================================================

import { embedText } from './gemini';
import { upsertDocumentChunks } from './supabase';
import type { Mode } from '../types';

/** Target chunk size in characters (~500 words) */
const CHUNK_SIZE = 1200;
/** Overlap between consecutive chunks to preserve context */
const CHUNK_OVERLAP = 200;

/**
 * Split a document into overlapping chunks for embedding.
 * Uses paragraph-aware splitting: prefers splitting at paragraph boundaries.
 */
export function chunkText(text: string): string[] {
  const cleaned = text.trim().replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n');

  if (cleaned.length <= CHUNK_SIZE) {
    return [cleaned];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < cleaned.length) {
    let end = start + CHUNK_SIZE;

    if (end < cleaned.length) {
      // Try to break at a paragraph boundary
      const paragraphBreak = cleaned.lastIndexOf('\n\n', end);
      const sentenceBreak = cleaned.lastIndexOf('. ', end);

      if (paragraphBreak > start + CHUNK_SIZE * 0.5) {
        end = paragraphBreak;
      } else if (sentenceBreak > start + CHUNK_SIZE * 0.5) {
        end = sentenceBreak + 1;
      }
    }

    const chunk = cleaned.slice(start, end).trim();
    if (chunk.length > 50) {
      chunks.push(chunk);
    }

    start = end - CHUNK_OVERLAP;
    if (start >= cleaned.length) break;
  }

  return chunks;
}

/**
 * Full ingestion pipeline: chunk text → embed each chunk → upsert to Supabase.
 * Returns the number of chunks ingested.
 *
 * @param content     Raw document text
 * @param sourceName  Display name for citations
 * @param sourceUrl   Optional URL reference
 * @param mode        Which assistant mode can access this content
 * @param sourceType  Knowledge tier: 'official' | 'press' | 'competitive' | 'ugc'
 * @param onProgress  Optional callback called after each chunk is embedded
 */
export async function ingestDocument(
  content: string,
  sourceName: string,
  sourceUrl: string,
  mode: Mode | 'all',
  onProgress?: (current: number, total: number) => void,
  sourceType: string = 'official'   // v2: knowledge tier, defaults to 'official'
): Promise<number> {
  const chunks = chunkText(content);

  if (chunks.length === 0) {
    throw new Error('No valid content chunks generated from the provided text');
  }

  const embeddedChunks: Array<{
    content     : string;
    embedding   : number[];
    source_name : string;
    source_url  : string;
    source_type : string;
    mode        : Mode | 'all';
    chunk_index : number;
  }> = [];

  // Embed chunks sequentially to avoid rate limiting
  for (let i = 0; i < chunks.length; i++) {
    const embedding = await embedText(chunks[i]);

    embeddedChunks.push({
      content     : chunks[i],
      embedding,
      source_name : sourceName,
      source_url  : sourceUrl,
      source_type : sourceType,   // v2: propagate knowledge tier to Supabase
      mode,
      chunk_index : i,
    });

    onProgress?.(i + 1, chunks.length);
  }

  // Batch upsert all chunks
  await upsertDocumentChunks(embeddedChunks);

  return chunks.length;
}
