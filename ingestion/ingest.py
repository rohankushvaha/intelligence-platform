"""
LIP v2 — Leela Intelligence Platform
Core Ingestion Pipeline (Firecrawl edition)
─────────────────────────────────────────────────────────────────────────────
Firecrawl handles JS rendering, bot protection, and proxy rotation
automatically — this is why it works on theleela.com where Crawl4AI failed.

Free tier: 500 credits (1 credit = 1 page). ~100 credits per full run.
Upgrade to Hobby ($16/month) for 3,000 credits/month for weekly automation.

Run:
  python ingest.py --source-type official    # Tier 1 — Leela official
  python ingest.py --source-type competitive # Tier 3 — competitor intel
  python ingest.py --dry-run                 # test without writing to DB
  python ingest.py --list-sources            # see all sources
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

load_dotenv()

os.environ.setdefault("LANGCHAIN_TRACING_V2", "true")
os.environ.setdefault("LANGCHAIN_PROJECT", "lip-v2-ingestion")

from firecrawl import FirecrawlApp
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
    value = os.getenv(key)
    if not value:
        log.error(f"Missing required environment variable: {key}")
        sys.exit(1)
    return value


def init_clients() -> tuple[FirecrawlApp, SupabaseClient, SentenceTransformer]:
    log.info("Initialising clients…")

    # Firecrawl — handles JS, proxies, bot protection automatically
    firecrawl = FirecrawlApp(api_key=_require_env("FIRECRAWL_API_KEY"))

    # Supabase — pgvector database
    supabase = create_client(
        _require_env("SUPABASE_URL"),
        _require_env("SUPABASE_SERVICE_KEY"),
    )

    # Embedding model — same as v1, 384 dims
    log.info("Loading embedding model…")
    embed_model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

    log.info("All clients ready.")
    return firecrawl, supabase, embed_model


# ══════════════════════════════════════════════════════════════════════════
#  STEP 1 — CRAWL
# ══════════════════════════════════════════════════════════════════════════

@traceable(name="crawl_source")
def crawl_source(
    firecrawl: FirecrawlApp,
    source   : IngestionSource,
    dry_run  : bool = False,
) -> list[dict]:
    """
    Crawl a source URL using Firecrawl.
    Firecrawl handles everything: JS rendering, bot detection,
    proxy rotation, clean markdown output. One API call per source.
    """
    if dry_run:
        log.info(f"[DRY RUN] Skipping crawl for {source.name}")
        return [{"url": source.url, "markdown": "# Dry run placeholder", "title": "Dry Run"}]

    log.info(f"[CRAWL] {source.name} → {source.url}")

    params: dict = {
        "limit"        : source.max_pages,
        "scrapeOptions": {
            "formats": ["markdown"],
        },
    }

    # Restrict crawl to matching URL patterns — saves credits
    if source.url_patterns:
        params["includePaths"] = source.url_patterns

    try:
        result = firecrawl.crawl_url(source.url, params=params)

        # Handle both dict and object response formats
        if isinstance(result, dict):
            pages = result.get("data", [])
        else:
            pages = getattr(result, "data", []) or []

        # Normalise page format
        normalised = []
        for page in pages:
            if isinstance(page, dict):
                markdown = page.get("markdown", "") or ""
                url      = page.get("metadata", {}).get("sourceURL", source.url)
                title    = page.get("metadata", {}).get("title", source.name)
            else:
                markdown = getattr(page, "markdown", "") or ""
                metadata = getattr(page, "metadata", {}) or {}
                url      = metadata.get("sourceURL", source.url)
                title    = metadata.get("title", source.name)

            if len(markdown.strip()) > 50:
                normalised.append({
                    "url"     : url,
                    "markdown": markdown.strip(),
                    "title"   : title,
                })

        log.info(f"[CRAWL] ✓ {len(normalised)} pages from {source.name}")

        # Polite delay — Firecrawl free tier allows 3 req/min
        time.sleep(25)
        return normalised

    except Exception as exc:
        log.error(f"[CRAWL] ✗ {source.name} failed: {exc}")
        return []


# ══════════════════════════════════════════════════════════════════════════
#  STEP 2 — CHUNK
# ══════════════════════════════════════════════════════════════════════════

_splitter = RecursiveCharacterTextSplitter(
    chunk_size      = CHUNK_SIZE,
    chunk_overlap   = CHUNK_OVERLAP,
    length_function = len,
    separators      = ["\n\n", "\n", ". ", " ", ""],
)


def _stable_id(url: str, chunk_index: int) -> str:
    """
    Deterministic UUID from URL + chunk position.
    UUID5 always produces a valid UUID format (with dashes).
    Same input always = same UUID = safe idempotent upsert.
    """
    import uuid
    name = f"{url}::{chunk_index}"
    return str(uuid.uuid5(uuid.NAMESPACE_URL, name))


def chunk_pages(pages: list[dict], source: IngestionSource) -> Iterator[dict]:
    for page in pages:
        raw_text = page.get("markdown", "").strip()
        page_url = page.get("url", source.url)
        title    = page.get("title", source.name)

        if not raw_text or len(raw_text) < 50:
            continue

        for idx, chunk_text in enumerate(_splitter.split_text(raw_text)):
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
    texts = [c["content"] for c in chunks]
    log.info(f"[EMBED] Encoding {len(texts)} chunks…")

    all_vectors = []
    for i in range(0, len(texts), batch_size):
        vectors = embed_model.encode(
            texts[i : i + batch_size],
            show_progress_bar=False,
        ).tolist()
        all_vectors.extend(vectors)

    for chunk, vector in zip(chunks, all_vectors):
        chunk["embedding"] = vector

    log.info(f"[EMBED] ✓ {len(chunks)} chunks embedded")
    return chunks


# ══════════════════════════════════════════════════════════════════════════
#  STEP 4 — UPSERT
# ══════════════════════════════════════════════════════════════════════════

@traceable(name="upsert_to_supabase")
def upsert_chunks(
    supabase  : SupabaseClient,
    chunks    : list[dict],
    batch_size: int = 50,
) -> int:
    if not chunks:
        return 0

    now      = datetime.now(timezone.utc).isoformat()
    upserted = 0

    for i in range(0, len(chunks), batch_size):
        batch = chunks[i : i + batch_size]
        rows  = [{
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
        } for c in batch]

        try:
            supabase.table(SUPABASE_TABLE).upsert(rows, on_conflict="id").execute()
            upserted += len(batch)
            log.info(f"[UPSERT] ✓ Batch {i // batch_size + 1}: {len(batch)} rows")
        except Exception as exc:
            log.error(f"[UPSERT] ✗ Batch failed: {exc}")

    return upserted


# ══════════════════════════════════════════════════════════════════════════
#  ORCHESTRATOR
# ══════════════════════════════════════════════════════════════════════════

@traceable(name="run_ingestion_pipeline")
def run_pipeline(
    sources    : list[IngestionSource],
    firecrawl  : FirecrawlApp,
    supabase   : SupabaseClient,
    embed_model: SentenceTransformer,
    dry_run    : bool = False,
) -> dict:
    start   = time.time()
    summary = {
        "total_sources"  : len(sources),
        "total_pages"    : 0,
        "total_chunks"   : 0,
        "total_upserted" : 0,
        "failed_sources" : [],
        "crawler"        : "firecrawl",
    }

    for source in sources:
        log.info(f"\n{'─' * 60}")
        log.info(f"Source: {source.name} [{source.source_type}]")

        pages = crawl_source(firecrawl, source, dry_run=dry_run)
        summary["total_pages"] += len(pages)

        if not pages:
            summary["failed_sources"].append(source.name)
            continue

        chunks = list(chunk_pages(pages, source))
        summary["total_chunks"] += len(chunks)
        log.info(f"[CHUNK] {len(chunks)} chunks from {len(pages)} pages")

        if dry_run:
            continue

        chunks = embed_chunks(chunks, embed_model)
        summary["total_upserted"] += upsert_chunks(supabase, chunks)

    summary["elapsed_seconds"] = round(time.time() - start, 1)
    summary["run_at"]          = datetime.now(timezone.utc).isoformat()

    log.info(f"\n{'═' * 60}")
    log.info("INGESTION COMPLETE")
    log.info(json.dumps(summary, indent=2))
    log.info(f"{'═' * 60}\n")

    return summary


# ══════════════════════════════════════════════════════════════════════════
#  CLI
# ══════════════════════════════════════════════════════════════════════════

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="LIP v2 ingestion pipeline")
    p.add_argument("--source-type", choices=["official", "press", "competitive", "ugc"])
    p.add_argument("--source", type=str)
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--list-sources", action="store_true")
    return p.parse_args()


def main() -> None:
    args = parse_args()

    if args.list_sources:
        for s in SOURCES:
            print(f"  [{s.source_type:>12}] {s.name}")
        sys.exit(0)

    sources = list(SOURCES)
    if args.source_type:
        sources = [s for s in sources if s.source_type == args.source_type]
    if args.source:
        sources = [s for s in sources if s.name == args.source]
    if not sources:
        log.error("No sources matched.")
        sys.exit(1)

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
