"""
LIP v2 — Leela Intelligence Platform
Core Ingestion Pipeline
─────────────────────────────────────────────────────────────────────────────
What this script does (in order):
  1. Loads every source defined in config.py
  2. Crawls each source URL using the Firecrawl API (markdown output)
  3. Chunks the markdown into overlapping text windows
  4. Embeds each chunk using HuggingFace all-MiniLM-L6-v2 (same model as v1)
  5. Upserts into Supabase pgvector — skips chunks already in the DB
  6. Logs every step to LangSmith for observability

Run:
  python ingest.py                  # all sources
  python ingest.py --source-type official   # only Tier 1
  python ingest.py --dry-run        # scrape + chunk, skip embed + upsert
  python ingest.py --source "The Leela — Dining"  # one source by name

Prerequisites:
  pip install firecrawl-py langchain langchain-community \
              sentence-transformers supabase python-dotenv \
              langsmith tiktoken

  Copy .env.example to .env and fill in all values.
─────────────────────────────────────────────────────────────────────────────
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import sys
import time
from datetime import datetime, timezone
from typing import Iterator

from dotenv import load_dotenv
import os

# Load .env first — all env vars must be available before importing clients
load_dotenv()

from firecrawl import FirecrawlApp
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langsmith import traceable
from sentence_transformers import SentenceTransformer
from supabase import create_client, Client as SupabaseClient

from config import (
    SOURCES,
    IngestionSource,
    SUPABASE_TABLE,
    EMBEDDING_DIM,
    CHUNK_SIZE,
    CHUNK_OVERLAP,
    FIRECRAWL_DELAY_SECONDS,
    LANGSMITH_PROJECT,
)

# ── Logging setup ──────────────────────────────────────────────────────────
logging.basicConfig(
    level   = logging.INFO,
    format  = "%(asctime)s | %(levelname)-8s | %(message)s",
    datefmt = "%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("ingestion.log"),   # always keep a local log
    ],
)
log = logging.getLogger("lip.ingest")


# ══════════════════════════════════════════════════════════════════════════
#  CLIENT INITIALISATION
# ══════════════════════════════════════════════════════════════════════════

def _require_env(key: str) -> str:
    """Fail fast if a required environment variable is missing."""
    value = os.getenv(key)
    if not value:
        log.error(f"Missing required environment variable: {key}")
        sys.exit(1)
    return value


def init_clients() -> tuple[FirecrawlApp, SupabaseClient, SentenceTransformer]:
    """
    Initialise all external service clients.
    Returns (firecrawl, supabase, embedding_model).
    """
    log.info("Initialising clients…")

    # Firecrawl — Free tier: 1,000 credits/month (1 credit per page scrape)
    firecrawl = FirecrawlApp(api_key=_require_env("FIRECRAWL_API_KEY"))

    # Supabase — existing v1 project
    supabase = create_client(
        _require_env("SUPABASE_URL"),
        _require_env("SUPABASE_SERVICE_KEY"),   # use service key for writes
    )

    # HuggingFace embedding model — same as v1 for vector dimension parity
    # Downloads ~90MB on first run, cached locally afterwards.
    log.info("Loading embedding model (all-MiniLM-L6-v2)…")
    embed_model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

    # LangSmith — set env vars so @traceable decorator auto-connects
    # Free Developer tier: 5,000 traces/month, 14-day retention
    os.environ.setdefault("LANGCHAIN_TRACING_V2", "true")
    os.environ.setdefault("LANGCHAIN_PROJECT", LANGSMITH_PROJECT)
    # LANGCHAIN_API_KEY must be in .env

    log.info("All clients ready.")
    return firecrawl, supabase, embed_model


# ══════════════════════════════════════════════════════════════════════════
#  STEP 1 — CRAWL
# ══════════════════════════════════════════════════════════════════════════

@traceable(name="crawl_source")
def crawl_source(
    firecrawl: FirecrawlApp,
    source: IngestionSource,
    dry_run: bool = False,
) -> list[dict]:
    """
    Crawl a single source URL and return a list of page dicts.

    Each page dict contains:
      - url      : str
      - markdown : str   (Firecrawl converts HTML → clean markdown)
      - title    : str

    Firecrawl handles JS rendering, bot detection, and robots.txt respect
    automatically — critical for The Leela's Drupal/PHP site.
    """
    log.info(f"[CRAWL] {source.name} → {source.url}")

    if dry_run:
        log.info("[DRY RUN] Skipping actual crawl — returning mock data.")
        return [{"url": source.url, "markdown": "# Dry run placeholder", "title": "Dry Run"}]

    crawl_params: dict = {
        "limit"        : source.max_pages,
        "scrapeOptions": {"formats": ["markdown"]},
    }

    # If url_patterns are specified, restrict the crawl to matching paths.
    # This is the primary way we control credit spend — never crawl the
    # entire site if only subsections are relevant.
    if source.url_patterns:
        crawl_params["includePaths"] = source.url_patterns

    try:
        # crawl() blocks until complete and returns all pages.
        # For large sites this could take minutes — that's expected.
        result = firecrawl.crawl_url(source.url, params=crawl_params)
        pages  = result.get("data", [])
        log.info(f"[CRAWL] ✓ {len(pages)} pages scraped from {source.name}")

        # Polite delay — respect Firecrawl's free-tier rate limit
        time.sleep(FIRECRAWL_DELAY_SECONDS)
        return pages

    except Exception as exc:
        # Log but don't crash — a single bad source shouldn't abort the run
        log.error(f"[CRAWL] ✗ Failed for {source.name}: {exc}")
        return []


# ══════════════════════════════════════════════════════════════════════════
#  STEP 2 — CHUNK
# ══════════════════════════════════════════════════════════════════════════

# Build the splitter once — it's stateless, safe to reuse.
_splitter = RecursiveCharacterTextSplitter(
    chunk_size        = CHUNK_SIZE,
    chunk_overlap     = CHUNK_OVERLAP,
    length_function   = len,
    # Split on paragraph breaks first, then sentences, then words.
    # This keeps semantically coherent ideas together.
    separators        = ["\n\n", "\n", ". ", " ", ""],
)


def chunk_pages(
    pages : list[dict],
    source: IngestionSource,
) -> Iterator[dict]:
    """
    Split raw page markdown into overlapping chunks.
    Yields one chunk record per chunk, ready to embed and upsert.

    Why chunking matters for RAG:
    ─────────────────────────────
    Vector similarity works best when chunks are focused on one topic.
    A 10,000-word property page has many distinct ideas: rooms, dining, spa,
    location, history. If we embed the whole page, the vector is an average
    of all those ideas — too diluted to surface in a targeted search.
    Smaller chunks (≈512 tokens) keep each vector semantically sharp.
    """
    for page in pages:
        raw_text = page.get("markdown", "").strip()
        page_url = page.get("url", source.url)
        title    = page.get("metadata", {}).get("title", source.name)

        if not raw_text or len(raw_text) < 50:
            log.debug(f"[CHUNK] Skipping near-empty page: {page_url}")
            continue

        chunks = _splitter.split_text(raw_text)
        log.debug(f"[CHUNK] {page_url} → {len(chunks)} chunks")

        for idx, chunk_text in enumerate(chunks):
            # Deterministic ID: if we re-ingest the same URL the same chunk
            # always gets the same ID → Supabase upsert is idempotent.
            chunk_id = _stable_id(page_url, idx)

            yield {
                "id"           : chunk_id,
                "content"      : chunk_text,
                "source_name"  : source.name,
                "source_url"   : page_url,
                "source_type"  : source.source_type,
                "mode"         : source.mode,
                "property_name": source.property_name,
                "chunk_index"  : idx,
                "page_title"   : title,
                # embedding and sentiment_score filled in later steps
            }


def _stable_id(url: str, chunk_index: int) -> str:
    """
    Generate a deterministic UUID-like string from URL + chunk index.
    Ensures that re-ingesting the same page updates existing rows (upsert)
    rather than creating duplicates.
    """
    raw = f"{url}::{chunk_index}"
    return hashlib.sha256(raw.encode()).hexdigest()[:36]


# ══════════════════════════════════════════════════════════════════════════
#  STEP 3 — EMBED
# ══════════════════════════════════════════════════════════════════════════

def embed_chunks(
    chunks     : list[dict],
    embed_model: SentenceTransformer,
    batch_size : int = 32,
) -> list[dict]:
    """
    Add embedding vectors to chunk records.

    We batch the encoding calls for efficiency. SentenceTransformer
    handles batching internally but explicit batches let us log progress.

    The all-MiniLM-L6-v2 model produces 384-dimensional vectors — the same
    dimension as v1, so the existing Supabase column works without migration.
    """
    texts = [c["content"] for c in chunks]
    log.info(f"[EMBED] Encoding {len(texts)} chunks in batches of {batch_size}…")

    all_vectors = []
    for i in range(0, len(texts), batch_size):
        batch   = texts[i : i + batch_size]
        vectors = embed_model.encode(batch, show_progress_bar=False).tolist()
        all_vectors.extend(vectors)
        log.debug(f"[EMBED] Batch {i // batch_size + 1} done")

    for chunk, vector in zip(chunks, all_vectors):
        chunk["embedding"] = vector  # list[float], length 384

    log.info(f"[EMBED] ✓ {len(chunks)} chunks embedded")
    return chunks


# ══════════════════════════════════════════════════════════════════════════
#  STEP 4 — UPSERT TO SUPABASE
# ══════════════════════════════════════════════════════════════════════════

@traceable(name="upsert_to_supabase")
def upsert_chunks(
    supabase: SupabaseClient,
    chunks  : list[dict],
    batch_size: int = 50,
) -> int:
    """
    Upsert chunk records into the Supabase documents table.

    Uses ON CONFLICT (id) DO UPDATE so re-ingesting the same content
    refreshes text and embedding without creating duplicates.

    Returns the count of successfully upserted rows.
    """
    if not chunks:
        log.warning("[UPSERT] No chunks to upsert — skipping.")
        return 0

    now     = datetime.now(timezone.utc).isoformat()
    upserted = 0

    for i in range(0, len(chunks), batch_size):
        batch = chunks[i : i + batch_size]

        # Build rows matching the Supabase schema (v1 + v2 new columns)
        rows = [
            {
                "id"            : c["id"],
                "content"       : c["content"],
                "embedding"     : c["embedding"],        # vector(384)
                "source_name"   : c["source_name"],
                "source_url"    : c["source_url"],
                "source_type"   : c["source_type"],      # NEW in v2
                "mode"          : c["mode"],
                "property_name" : c.get("property_name"), # NEW in v2
                "chunk_index"   : c["chunk_index"],
                "sentiment_score": c.get("sentiment_score"),  # NEW in v2 (optional)
                "updated_at"    : now,
                # created_at is set by Supabase default on INSERT
            }
            for c in batch
        ]

        try:
            response = (
                supabase
                .table(SUPABASE_TABLE)
                .upsert(rows, on_conflict="id")
                .execute()
            )
            upserted += len(batch)
            log.info(f"[UPSERT] ✓ Batch {i // batch_size + 1}: {len(batch)} rows")

        except Exception as exc:
            log.error(f"[UPSERT] ✗ Batch {i // batch_size + 1} failed: {exc}")
            # Continue — partial success is better than a full abort

    return upserted


# ══════════════════════════════════════════════════════════════════════════
#  ORCHESTRATOR — ties all steps together
# ══════════════════════════════════════════════════════════════════════════

@traceable(name="run_ingestion_pipeline")
def run_pipeline(
    sources    : list[IngestionSource],
    firecrawl  : FirecrawlApp,
    supabase   : SupabaseClient,
    embed_model: SentenceTransformer,
    dry_run    : bool = False,
) -> dict:
    """
    Full ingestion pipeline for a list of sources.
    Returns a summary dict for logging and downstream reporting.
    """
    start_time = time.time()
    summary    = {
        "total_sources"  : len(sources),
        "total_pages"    : 0,
        "total_chunks"   : 0,
        "total_upserted" : 0,
        "failed_sources" : [],
    }

    for source in sources:
        log.info(f"\n{'─' * 60}")
        log.info(f"Source: {source.name} [{source.source_type}]")

        # Step 1 — Crawl
        pages = crawl_source(firecrawl, source, dry_run=dry_run)
        summary["total_pages"] += len(pages)

        if not pages:
            summary["failed_sources"].append(source.name)
            continue

        # Step 2 — Chunk
        chunks = list(chunk_pages(pages, source))
        summary["total_chunks"] += len(chunks)
        log.info(f"[CHUNK] {source.name} → {len(chunks)} total chunks")

        if dry_run:
            log.info("[DRY RUN] Skipping embed + upsert.")
            continue

        # Step 3 — Embed
        chunks = embed_chunks(chunks, embed_model)

        # Step 4 — Upsert
        n = upsert_chunks(supabase, chunks)
        summary["total_upserted"] += n

    elapsed = round(time.time() - start_time, 1)
    summary["elapsed_seconds"] = elapsed
    summary["run_at"] = datetime.now(timezone.utc).isoformat()

    log.info(f"\n{'═' * 60}")
    log.info("INGESTION COMPLETE")
    log.info(json.dumps(summary, indent=2))
    log.info(f"{'═' * 60}\n")

    return summary


# ══════════════════════════════════════════════════════════════════════════
#  CLI ENTRYPOINT
# ══════════════════════════════════════════════════════════════════════════

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="LIP v2 — Leela Intelligence Platform ingestion pipeline"
    )
    parser.add_argument(
        "--source-type",
        choices=["official", "press", "competitive", "ugc"],
        help="Run only sources of this type (e.g. official)",
    )
    parser.add_argument(
        "--source",
        type=str,
        help="Run only the source with this exact name",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Crawl and chunk but skip embedding and Supabase upsert",
    )
    parser.add_argument(
        "--list-sources",
        action="store_true",
        help="Print all configured sources and exit",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    # ── List mode ──────────────────────────────────────────────────────────
    if args.list_sources:
        print(f"\n{'─' * 60}")
        print(f"{'LIP v2 — Configured Sources':^60}")
        print(f"{'─' * 60}")
        for s in SOURCES:
            flag = "✓" if s.source_type == "official" else "○"
            print(f"  {flag} [{s.source_type:>12}] {s.name}")
        print(f"{'─' * 60}\n")
        sys.exit(0)

    # ── Filter sources ─────────────────────────────────────────────────────
    sources = SOURCES

    if args.source_type:
        sources = [s for s in sources if s.source_type == args.source_type]
        log.info(f"Filtered to source_type='{args.source_type}': {len(sources)} sources")

    if args.source:
        sources = [s for s in sources if s.name == args.source]
        if not sources:
            log.error(f"No source found with name: '{args.source}'")
            sys.exit(1)

    if not sources:
        log.error("No sources matched the given filters. Exiting.")
        sys.exit(1)

    if args.dry_run:
        log.info("DRY RUN mode — no data will be written to Supabase.")

    # ── Initialise and run ─────────────────────────────────────────────────
    firecrawl, supabase, embed_model = init_clients()

    run_pipeline(
        sources     = sources,
        firecrawl   = firecrawl,
        supabase    = supabase,
        embed_model = embed_model,
        dry_run     = args.dry_run,
    )


if __name__ == "__main__":
    main()
