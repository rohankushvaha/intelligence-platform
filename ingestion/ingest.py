"""
LIP v2 — Leela Intelligence Platform
Core Ingestion Pipeline (Crawl4AI edition)
─────────────────────────────────────────────────────────────────────────────
What this script does (in order):
  1. Loads every source defined in config.py
  2. Crawls each source URL using Crawl4AI — 100% free, no API key needed
  3. Chunks the markdown into overlapping text windows
  4. Embeds each chunk using HuggingFace all-MiniLM-L6-v2 (same model as v1)
  5. Upserts into Supabase pgvector — idempotent, safe to re-run
  6. Logs every step to LangSmith for observability

Why Crawl4AI over Firecrawl:
  - Completely free forever — no credits, no API key, no limits
  - Outputs clean LLM-ready Markdown natively (same as Firecrawl)
  - Handles JavaScript rendering via Playwright (built-in)
  - 50k+ GitHub stars, actively maintained, RAG-native
  - Runs perfectly inside GitHub Actions

Run:
  python ingest.py                              # all sources
  python ingest.py --source-type official       # only Tier 1
  python ingest.py --source-type competitive    # only competitor intel
  python ingest.py --dry-run                    # crawl + chunk, no DB write
  python ingest.py --source "The Leela — Dining"  # single source by name
  python ingest.py --list-sources               # show all configured sources

First-time setup (GitHub Actions handles this automatically):
  pip install crawl4ai langchain langchain-community \
              sentence-transformers supabase python-dotenv \
              langsmith tiktoken
  crawl4ai-setup   ← installs Playwright browser (run once)

Copy .env.example to .env and fill in:
  SUPABASE_URL, SUPABASE_SERVICE_KEY, LANGCHAIN_API_KEY
  (No FIRECRAWL_API_KEY needed — Crawl4AI is keyless)
─────────────────────────────────────────────────────────────────────────────
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import logging
import sys
import time
from datetime import datetime, timezone
from typing import Iterator

from dotenv import load_dotenv
import os

# Load .env first — credentials must be available before importing clients
load_dotenv()

# ── LangSmith observability setup ─────────────────────────────────────────
# Must be set before importing langsmith
os.environ.setdefault("LANGCHAIN_TRACING_V2", "true")
os.environ.setdefault("LANGCHAIN_PROJECT", "lip-v2-ingestion")

from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode
from crawl4ai.deep_crawling import BFSDeepCrawlStrategy
from crawl4ai.content_filter_strategy import PruningContentFilter
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langsmith import traceable
from sentence_transformers import SentenceTransformer
from supabase import create_client, Client as SupabaseClient

from config import (
    SOURCES,
    IngestionSource,
    SUPABASE_TABLE,
    CHUNK_SIZE,
    CHUNK_OVERLAP,
    LANGSMITH_PROJECT,
)

# ── Logging setup ──────────────────────────────────────────────────────────
logging.basicConfig(
    level   = logging.INFO,
    format  = "%(asctime)s | %(levelname)-8s | %(message)s",
    datefmt = "%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("ingestion.log"),
    ],
)
log = logging.getLogger("lip.ingest")


# ══════════════════════════════════════════════════════════════════════════
#  CLIENT INITIALISATION
# ══════════════════════════════════════════════════════════════════════════

def _require_env(key: str) -> str:
    """Fail fast with a clear message if a required env var is missing."""
    value = os.getenv(key)
    if not value:
        log.error(f"Missing required environment variable: {key}")
        sys.exit(1)
    return value


def init_clients() -> tuple[SupabaseClient, SentenceTransformer]:
    """
    Initialise Supabase and the embedding model.
    Crawl4AI needs no client — it's a local library, not an API.
    Returns (supabase, embed_model).
    """
    log.info("Initialising clients…")

    # Supabase — existing v1 project, extended with v2 columns
    supabase = create_client(
        _require_env("SUPABASE_URL"),
        _require_env("SUPABASE_SERVICE_KEY"),  # service key for writes
    )

    # HuggingFace embedding model — same as v1 for vector dimension parity
    # ~90MB download on first run, cached in ~/.cache/huggingface afterwards
    log.info("Loading embedding model (all-MiniLM-L6-v2)…")
    embed_model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

    log.info("Clients ready. (Crawl4AI is keyless — no API client needed)")
    return supabase, embed_model


# ══════════════════════════════════════════════════════════════════════════
#  CRAWL4AI BROWSER CONFIG
#  One shared config for all crawls — headless, polite, LLM-optimised
# ══════════════════════════════════════════════════════════════════════════

def get_browser_config() -> BrowserConfig:
    """
    Browser configuration for Crawl4AI.

    headless=True     — no visible browser window (required for GitHub Actions)
    verbose=False     — suppress Playwright debug noise in logs
    sleep_on_close    — graceful shutdown avoids zombie processes in CI
    """
    return BrowserConfig(
        headless        = True,
        verbose         = False,
        sleep_on_close  = True,
    )


def get_crawl_config(source: IngestionSource) -> CrawlerRunConfig:
    """
    Per-source crawl configuration.

    PruningContentFilter removes boilerplate (nav, footer, ads) before
    the text reaches our chunker — cleaner chunks = sharper embeddings.

    CacheMode.BYPASS ensures we always get fresh content on each run,
    not a cached version from a previous crawl.
    """
    return CrawlerRunConfig(
        # Content cleaning — strip navigation, footers, cookie banners
        content_filter          = PruningContentFilter(
            threshold           = 0.45,     # aggressiveness of pruning (0-1)
            threshold_type      = "fixed",
            min_word_threshold  = 20,       # drop blocks with fewer than 20 words
        ),
        # Output format — clean markdown ready for LLM ingestion
        markdown_generator      = None,     # use default markdown generator
        # Cache — always fetch fresh (important for weekly scheduled runs)
        cache_mode              = CacheMode.BYPASS,
        # Politeness — wait between page loads to avoid overwhelming servers
        mean_delay              = 1.5,      # average seconds between requests
        max_range               = 1.0,      # random ±1s added to mean_delay
        # Page load — wait for content to fully render
        page_timeout            = 30000,    # 30 seconds max per page (ms)
        wait_until              = "domcontentloaded",
        # Content filters
        word_count_threshold    = 20,       # skip near-empty pages
        exclude_external_links  = True,     # stay within the source domain
        remove_overlay_elements = True,     # dismiss cookie popups, modals
        process_iframes         = False,    # skip iframes (usually nav/ads)
    )


# ══════════════════════════════════════════════════════════════════════════
#  STEP 1 — CRAWL (async, using Crawl4AI deep crawl)
# ══════════════════════════════════════════════════════════════════════════

async def _crawl_source_async(source: IngestionSource) -> list[dict]:
    """
    Internal async crawl function.
    Uses BFS (breadth-first search) to crawl from the root URL outward,
    respecting the max_pages limit and url_patterns filter.

    Returns a list of page dicts:
      { url, markdown, title }
    """
    log.info(f"[CRAWL] Starting: {source.name} → {source.url}")

    browser_config = get_browser_config()
    crawl_config   = get_crawl_config(source)

    # BFS strategy: explore all links at current depth before going deeper.
    # This gives us the most important/linked pages first — ideal for RAG
    # where we want the primary content, not deeply nested pages.
    crawl_strategy = BFSDeepCrawlStrategy(
        max_depth        = 3,               # root + 2 levels deep
        max_pages        = source.max_pages,
        include_external = False,           # stay on same domain
        # Filter URLs to only crawl matching patterns if defined
        url_pattern      = "|".join(source.url_patterns) if source.url_patterns else None,
    )

    pages = []

    async with AsyncWebCrawler(config=browser_config) as crawler:
        results = await crawler.arun(
            url            = source.url,
            config         = crawl_config,
            deep_crawl_strategy = crawl_strategy,
        )

        # arun() with deep crawl returns a list of CrawlResult objects
        result_list = results if isinstance(results, list) else [results]

        for result in result_list:
            if not result.success:
                log.warning(f"[CRAWL] Failed page: {result.url} — {result.error_message}")
                continue

            markdown = (result.markdown or "").strip()
            if len(markdown) < 50:
                log.debug(f"[CRAWL] Skipping near-empty page: {result.url}")
                continue

            pages.append({
                "url"     : result.url,
                "markdown": markdown,
                "title"   : result.metadata.get("title", source.name) if result.metadata else source.name,
            })

    log.info(f"[CRAWL] ✓ {len(pages)} usable pages from {source.name}")
    return pages


@traceable(name="crawl_source")
def crawl_source(source: IngestionSource, dry_run: bool = False) -> list[dict]:
    """
    Synchronous wrapper around the async crawl function.
    @traceable sends this call to LangSmith for observability.
    """
    if dry_run:
        log.info(f"[DRY RUN] Skipping crawl for {source.name}")
        return [{"url": source.url, "markdown": "# Dry run placeholder content", "title": "Dry Run"}]

    try:
        # asyncio.run() creates a fresh event loop for each source.
        # This is intentional — it prevents state leaking between crawls
        # and keeps memory usage flat across many sources.
        return asyncio.run(_crawl_source_async(source))
    except Exception as exc:
        log.error(f"[CRAWL] ✗ Failed for {source.name}: {exc}")
        return []


# ══════════════════════════════════════════════════════════════════════════
#  STEP 2 — CHUNK
# ══════════════════════════════════════════════════════════════════════════

# Build the splitter once — stateless, safe to reuse across all sources
_splitter = RecursiveCharacterTextSplitter(
    chunk_size      = CHUNK_SIZE,       # 512 characters (~350-400 words)
    chunk_overlap   = CHUNK_OVERLAP,    # 64 character overlap between chunks
    length_function = len,
    # Split hierarchy: paragraphs → sentences → words → characters
    # Tries each separator in order, only moves to next if chunk is still too large
    separators      = ["\n\n", "\n", ". ", " ", ""],
)


def _stable_id(url: str, chunk_index: int) -> str:
    """
    Deterministic chunk ID from URL + position.
    Same URL + same position always = same ID → upsert is idempotent.
    Re-ingesting the same page updates content, never creates duplicates.
    """
    raw = f"{url}::{chunk_index}"
    return hashlib.sha256(raw.encode()).hexdigest()[:36]


def chunk_pages(pages: list[dict], source: IngestionSource) -> Iterator[dict]:
    """
    Split page markdown into overlapping chunks.
    Yields one record per chunk, ready to embed and upsert.

    Why this chunk size (512)?
    ──────────────────────────
    Vector search finds the most similar chunk to a user's query.
    A chunk covering one focused idea (e.g. "Leela Udaipur spa treatments")
    produces a sharp, precise embedding. A chunk mixing 10 ideas produces
    a blurry average. 512 chars ≈ one focused paragraph — the sweet spot
    for hospitality content which tends to be dense and specific.
    """
    for page in pages:
        raw_text = page.get("markdown", "").strip()
        page_url = page.get("url", source.url)
        title    = page.get("title", source.name)

        if not raw_text or len(raw_text) < 50:
            log.debug(f"[CHUNK] Skipping near-empty page: {page_url}")
            continue

        text_chunks = _splitter.split_text(raw_text)
        log.debug(f"[CHUNK] {page_url} → {len(text_chunks)} chunks")

        for idx, chunk_text in enumerate(text_chunks):
            yield {
                "id"           : _stable_id(page_url, idx),
                "content"      : chunk_text,
                "source_name"  : source.name,
                "source_url"   : page_url,
                "source_type"  : source.source_type,
                "mode"         : source.mode,
                "property_name": source.property_name,
                "chunk_index"  : idx,
                "page_title"   : title,
            }


# ══════════════════════════════════════════════════════════════════════════
#  STEP 3 — EMBED
# ══════════════════════════════════════════════════════════════════════════

def embed_chunks(
    chunks    : list[dict],
    embed_model: SentenceTransformer,
    batch_size : int = 32,
) -> list[dict]:
    """
    Add 384-dimensional embedding vectors to each chunk.

    Batching (32 at a time) keeps memory usage flat even for large crawls.
    The all-MiniLM-L6-v2 model runs on CPU — no GPU needed, works on
    any GitHub Actions runner or local machine.
    """
    texts = [c["content"] for c in chunks]
    log.info(f"[EMBED] Encoding {len(texts)} chunks (batch size {batch_size})…")

    all_vectors = []
    for i in range(0, len(texts), batch_size):
        batch   = texts[i : i + batch_size]
        vectors = embed_model.encode(batch, show_progress_bar=False).tolist()
        all_vectors.extend(vectors)
        log.debug(f"[EMBED] Batch {i // batch_size + 1}/{-(-len(texts) // batch_size)} done")

    for chunk, vector in zip(chunks, all_vectors):
        chunk["embedding"] = vector  # list[float], length 384

    log.info(f"[EMBED] ✓ {len(chunks)} chunks embedded")
    return chunks


# ══════════════════════════════════════════════════════════════════════════
#  STEP 4 — UPSERT TO SUPABASE
# ══════════════════════════════════════════════════════════════════════════

@traceable(name="upsert_to_supabase")
def upsert_chunks(
    supabase  : SupabaseClient,
    chunks    : list[dict],
    batch_size: int = 50,
) -> int:
    """
    Upsert chunks into Supabase documents table.
    ON CONFLICT (id) → updates existing row with fresh content + embedding.
    Safe to re-run — will never create duplicate chunks for the same URL.
    Returns count of successfully upserted rows.
    """
    if not chunks:
        log.warning("[UPSERT] No chunks to upsert — skipping.")
        return 0

    now      = datetime.now(timezone.utc).isoformat()
    upserted = 0

    for i in range(0, len(chunks), batch_size):
        batch = chunks[i : i + batch_size]
        rows  = [
            {
                "id"             : c["id"],
                "content"        : c["content"],
                "embedding"      : c["embedding"],
                "source_name"    : c["source_name"],
                "source_url"     : c["source_url"],
                "source_type"    : c["source_type"],
                "mode"           : c["mode"],
                "property_name"  : c.get("property_name"),
                "chunk_index"    : c["chunk_index"],
                "sentiment_score": c.get("sentiment_score"),
                "updated_at"     : now,
            }
            for c in batch
        ]

        try:
            supabase.table(SUPABASE_TABLE).upsert(rows, on_conflict="id").execute()
            upserted += len(batch)
            log.info(f"[UPSERT] ✓ Batch {i // batch_size + 1}: {len(batch)} rows")
        except Exception as exc:
            log.error(f"[UPSERT] ✗ Batch {i // batch_size + 1} failed: {exc}")
            # Don't abort — partial success is better than full failure

    return upserted


# ══════════════════════════════════════════════════════════════════════════
#  ORCHESTRATOR
# ══════════════════════════════════════════════════════════════════════════

@traceable(name="run_ingestion_pipeline")
def run_pipeline(
    sources    : list[IngestionSource],
    supabase   : SupabaseClient,
    embed_model: SentenceTransformer,
    dry_run    : bool = False,
) -> dict:
    """
    Full pipeline: crawl → chunk → embed → upsert, for all sources.
    Returns a summary dict logged to stdout and LangSmith.
    """
    start_time = time.time()
    summary    = {
        "total_sources"  : len(sources),
        "total_pages"    : 0,
        "total_chunks"   : 0,
        "total_upserted" : 0,
        "failed_sources" : [],
        "crawler"        : "crawl4ai (free, keyless)",
    }

    for source in sources:
        log.info(f"\n{'─' * 60}")
        log.info(f"Source : {source.name}")
        log.info(f"Type   : {source.source_type} | Mode: {source.mode}")
        log.info(f"URL    : {source.url}")

        # Step 1 — Crawl
        pages = crawl_source(source, dry_run=dry_run)
        summary["total_pages"] += len(pages)

        if not pages:
            log.warning(f"[PIPELINE] No pages returned for {source.name}")
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

    elapsed            = round(time.time() - start_time, 1)
    summary["elapsed_seconds"] = elapsed
    summary["run_at"]  = datetime.now(timezone.utc).isoformat()

    log.info(f"\n{'═' * 60}")
    log.info("INGESTION COMPLETE")
    log.info(json.dumps(summary, indent=2))
    log.info(f"{'═' * 60}\n")

    return summary


# ══════════════════════════════════════════════════════════════════════════
#  CLI
# ══════════════════════════════════════════════════════════════════════════

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="LIP v2 — Leela Intelligence Platform ingestion pipeline (Crawl4AI)"
    )
    p.add_argument(
        "--source-type",
        choices=["official", "press", "competitive", "ugc"],
        help="Run only sources of this type",
    )
    p.add_argument(
        "--source",
        type=str,
        help='Run only the source with this exact name (e.g. "The Leela — Dining")',
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="Crawl and chunk but skip embedding and Supabase upsert",
    )
    p.add_argument(
        "--list-sources",
        action="store_true",
        help="Print all configured sources and exit",
    )
    return p.parse_args()


def main() -> None:
    args = parse_args()

    # ── List mode ──────────────────────────────────────────────────────────
    if args.list_sources:
        print(f"\n{'─' * 60}")
        print(f"{'LIP v2 — Configured Sources':^60}")
        print(f"{'─' * 60}")
        for s in SOURCES:
            icon = "✓" if s.source_type == "official" else "○"
            print(f"  {icon} [{s.source_type:>12}]  {s.name}")
        print(f"\n  Total: {len(SOURCES)} sources")
        print(f"  Crawler: Crawl4AI (free, no API key)")
        print(f"{'─' * 60}\n")
        sys.exit(0)

    # ── Filter sources ─────────────────────────────────────────────────────
    sources = list(SOURCES)

    if args.source_type:
        sources = [s for s in sources if s.source_type == args.source_type]
        log.info(f"Filtered to source_type='{args.source_type}': {len(sources)} sources")

    if args.source:
        sources = [s for s in sources if s.name == args.source]
        if not sources:
            log.error(f"No source found with name: '{args.source}'")
            log.error("Run with --list-sources to see all available source names.")
            sys.exit(1)

    if not sources:
        log.error("No sources matched the given filters.")
        sys.exit(1)

    if args.dry_run:
        log.info("DRY RUN mode — no data will be written to Supabase.")

    # ── Run ────────────────────────────────────────────────────────────────
    supabase, embed_model = init_clients()

    run_pipeline(
        sources     = sources,
        supabase    = supabase,
        embed_model = embed_model,
        dry_run     = args.dry_run,
    )


if __name__ == "__main__":
    main()
