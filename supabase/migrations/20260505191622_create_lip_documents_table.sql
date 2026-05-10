/*
  # Leela Intelligence Platform — Documents Table

  1. New Tables
    - `documents`
      - `id` (uuid, primary key)
      - `content` (text, the chunk text)
      - `embedding` (vector(768), text-embedding-004 output)
      - `source_name` (text, display name of source document)
      - `source_url` (text, optional URL)
      - `mode` (text, which assistant mode can access this chunk)
      - `chunk_index` (int, position within parent document)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Indexes
    - IVFFlat cosine index on embedding for fast ANN search

  3. Security
    - Enable RLS on documents table
    - Anon users can SELECT (read) documents (needed for RAG queries from frontend)
    - Authenticated users can INSERT, UPDATE, DELETE (admin operations)

  4. Functions
    - `match_documents` — vector similarity search function used by RAG pipeline
*/

-- Enable pgvector extension
create extension if not exists vector;

-- Create documents table
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  embedding vector(768),
  source_name text not null default '',
  source_url text default '',
  mode text not null default 'all' check (mode in ('guest', 'investor', 'internal', 'all')),
  chunk_index int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- IVFFlat index for fast cosine similarity search
create index if not exists documents_embedding_idx
  on documents
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Index on mode for filtered searches
create index if not exists documents_mode_idx on documents (mode);

-- RLS
alter table documents enable row level security;

-- Anon read (needed so the frontend RAG pipeline can query without auth)
create policy "Anon can read documents"
  on documents for select
  to anon
  using (true);

-- Anon insert (needed for admin panel which uses anon key)
create policy "Anon can insert documents"
  on documents for insert
  to anon
  with check (true);

-- Anon delete (needed for admin panel document management)
create policy "Anon can delete documents"
  on documents for delete
  to anon
  using (true);

-- Vector similarity search function
create or replace function match_documents(
  query_embedding vector(768),
  match_mode text,
  match_count int default 8,
  match_threshold float default 0.3
)
returns table (
  id uuid,
  content text,
  source_name text,
  source_url text,
  mode text,
  chunk_index int,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    d.id,
    d.content,
    d.source_name,
    d.source_url,
    d.mode,
    d.chunk_index,
    1 - (d.embedding <=> query_embedding) as similarity
  from documents d
  where
    (match_mode = 'all' or d.mode = match_mode or d.mode = 'all')
    and 1 - (d.embedding <=> query_embedding) > match_threshold
  order by d.embedding <=> query_embedding
  limit match_count;
end;
$$;
