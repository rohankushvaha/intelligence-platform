// ============================================================
// Leela Intelligence Platform v2 — Shared TypeScript Interfaces
// ============================================================

/** The three operational modes of the LIP assistant */
export type Mode = 'guest' | 'investor' | 'internal';

/** Knowledge source tiers — v2 addition */
export type SourceType = 'official' | 'press' | 'competitive' | 'ugc';

/** Source filter for UI knowledge tier chips — v2 addition */
export type SourceFilter = 'all' | SourceType;

/** A single chat message in a conversation */
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
  sourceTypes?: SourceType[];   // v2 — per-source type for badges
  timestamp: Date;
  isStreaming?: boolean;
}

/** A document chunk stored in Supabase with its vector embedding */
export interface DocumentChunk {
  id: string;
  content: string;
  source_name: string;
  source_url: string;
  source_type: SourceType;      // v2 — knowledge tier
  mode: Mode | 'all';
  chunk_index: number;
  property_name: string | null; // v2 — property attribution
  sentiment_score: number | null; // v2 — sentiment scoring
  similarity?: number;
}

/** A document chunk row including the embedding vector */
export interface DocumentChunkWithEmbedding extends DocumentChunk {
  embedding: number[];
  created_at: string;
  updated_at: string;
}

/** Result returned by the RAG pipeline */
export interface RetrievalResult {
  response: string;
  sources: string[];
  sourceTypes?: SourceType[];
}

/** Chat state managed per mode by Zustand */
export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
}

/** Shape of the global Zustand chat store */
export interface ChatStore {
  guest: ChatState;
  investor: ChatState;
  internal: ChatState;
  addMessage: (mode: Mode, message: Message) => void;
  setLoading: (mode: Mode, loading: boolean) => void;
  setError: (mode: Mode, error: string | null) => void;
  updateLastMessage: (mode: Mode, content: string, sources?: string[], sourceTypes?: SourceType[]) => void;
  clearMessages: (mode: Mode) => void;
  markStreamingDone: (mode: Mode) => void;
}

/** Document record for the admin panel list view */
export interface DocumentRecord {
  id: string;
  source_name: string;
  source_url: string;
  source_type: SourceType;
  mode: Mode | 'all';
  chunk_index: number;
  created_at: string;
  content: string;
}

/** Admin ingestion form state */
export interface IngestionForm {
  content: string;
  sourceName: string;
  sourceUrl: string;
  sourceType: SourceType;
  mode: Mode | 'all';
}

/** Mode metadata for UI rendering */
export interface ModeConfig {
  id: Mode;
  label: string;
  description: string;
  systemPrompt: string;
  suggestions: string[];
  pinProtected: boolean;
}

/** KB health stats for admin dashboard — v2 addition */
export interface KBStats {
  totalChunks: number;
  bySourceType: Array<{
    source_type: SourceType;
    count: number;
    last_updated: string | null;
  }>;
  bySources: Array<{
    source_name: string;
    source_type: SourceType;
    mode: string;
    count: number;
    last_updated: string | null;
  }>;
}
