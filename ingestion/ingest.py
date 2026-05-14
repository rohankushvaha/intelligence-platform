"""
LIP v2 — Leela Intelligence Platform
Core Ingestion Pipeline (Crawl4AI edition)
─────────────────────────────────────────────────────────────────────────────
Fixed: crawl4ai.deep_crawling import path updated for crawl4ai v0.4.x
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

load_dotenv()

os.environ.setdefault("LANGCHAIN_TRACING_V2", "true")
os.environ.setdefault("LANGCHAIN_PROJECT", "lip-v2-ingestion")

from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode
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


def init_clients() -> tuple[SupabaseClient, SentenceTransformer]:
    log.info("Initialising clients…")
    supabase = create_client(
        _require_env("SUPABASE_URL"),
        _require_env("SUPABASE_SERVICE_KEY"),
    )
    log.info("Loading embedding model (all-MiniLM-L6-v2)…")
    embed_model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
    log.info("Clients ready.")
    return supabase, embed_model


# ══════════════════════════════════════════════════════════════════════════
#  CRAWL4AI CONFIG
# ══════════════════════════════════════════════════════════════════════════

def get_browser_config() -> BrowserConfig:
    return BrowserConfig(
        headless       = True,
        verbose        = False,
        sleep_on_close = True,
    )


def get_crawl_config() -> CrawlerRunConfig:
    return CrawlerRunConfig(
        cache_mode              = CacheMode.BYPASS,
        page_timeout            = 30000,
        wait_until              = "domcontentloaded",
        word_count_threshold    = 20,
        exclude_external_links  = True,
        remove_overlay_elements = True,
        process_iframes         = False,
        mean_delay              = 1.5,
        max_range               = 1.0,
    )


# ══════════════════════════════════════════════════════════════════════════
#  STEP 1 — CRAWL
#  Uses simple multi-page crawl compatible with all crawl4ai versions.
#  Deep crawl strategy imports vary by version — we use arun_many() instead
#  which is stable across all v0.4.x releases.
# ══════════════════════════════════════════════════════════════════════════

async def _crawl_source_async(source: IngestionSource) -> list[dict]:
    """
    Crawl a source using Crawl4AI.
    Strategy: fetch the root URL, extract all internal links, then
    crawl each link up to max_pages. This avoids version-specific
    deep crawl strategy imports entirely.
    """
    log.info(f"[CRAWL] Starting: {source.name} → {source.url}")

    browser_config = get_browser_config()
    crawl_config   = get_crawl_config()
    pages          = []

    async with AsyncWebCrawler(config=browser_config) as crawler:

        # Step 1: Crawl the root URL and collect internal links
        root_result = await crawler.arun(
            url    = source.url,
            config = crawl_config,
        )

        if not root_result.success:
            log.warning(f"[CRAWL] Root page failed: {source.url}")
            return []

        # Add root page if it has content
        root_markdown = (root_result.markdown or "").strip()
        if len(root_markdown) > 50:
            pages.append({
                "url"     : source.url,
                "markdown": root_markdown,
                "title"   : root_result.metadata.get("title", source.name) if root_result.metadata else source.name,
            })

        # Step 2: Extract internal links from root page
        internal_links = []
        if root_result.links:
            for link in root_result.links.get("internal", []):
                href = link.get("href", "")
                if not href or href == source.url:
                    continue
                # Apply url_patterns filter if defined
                if source.url_patterns:
                    if any(p in href for p in source.url_patterns):
                        internal_links.append(href)
                else:
                    internal_links.append(href)

        # Deduplicate and limit to max_pages - 1 (root already counted)
        seen = {source.url}
        filtered_links = []
        for link in internal_links:
            if link not in seen:
                seen.add(link)
                filtered_links.append(link)
            if len(filtered_links) >= source.max_pages - 1:
                break

        log.info(f"[CRAWL] Found {len(filtered_links)} links to crawl from {source.name}")

        # Step 3: Crawl each link
        if filtered_links:
            results = await crawler.arun_many(
                urls   = filtered_links,
                config = crawl_config,
            )

            for result in results:
                if not result.success:
                    log.warning(f"[CRAWL] Failed: {result.url}")
                    continue
                markdown = (result.markdown or "").strip()
                if len(markdown) < 50:
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
    if dry_run:
        log.info(f"[DRY RUN] Skipping crawl for {source.name}")
        return [{"url": source.url, "markdown": "# Dry run placeholder", "title": "Dry Run"}]
    try:
        return asyncio.run(_crawl_source_async(source))
    except Exception as exc:
        log.error(f"[CRAWL] ✗ Failed for {source.name}: {exc}")
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
    raw = f"{url}::{chunk_index}"
    return hashlib.sha256(raw.encode()).hexdigest()[:36]


def chunk_pages(pages: list[dict], source: IngestionSource) -> Iterator[dict]:
    for page in pages:
        raw_text = page.get("markdown", "").strip()
        page_url = page.get("url", source.url)
        title    = page.get("title", source.name)

        if not raw_text or len(raw_text) < 50:
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
    texts = [c["content"] for c in chunks]
    log.info(f"[EMBED] Encoding {len(texts)} chunks…")

    all_vectors = []
    for i in range(0, len(texts), batch_size):
        batch   = texts[i : i + batch_size]
        vectors = embed_model.encode(batch, show_progress_bar=False).tolist()
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
        log.warning("[UPSERT] No chunks to upsert.")
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

        pages = crawl_source(source, dry_run=dry_run)
        summary["total_pages"] += len(pages)

        if not pages:
            summary["failed_sources"].append(source.name)
            continue

        chunks = list(chunk_pages(pages, source))
        summary["total_chunks"] += len(chunks)
        log.info(f"[CHUNK] {source.name} → {len(chunks)} total chunks")

        if dry_run:
            log.info("[DRY RUN] Skipping embed + upsert.")
            continue

        chunks = embed_chunks(chunks, embed_model)
        n      = upsert_chunks(supabase, chunks)
        summary["total_upserted"] += n

    summary["elapsed_seconds"] = round(time.time() - start_time, 1)
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

    supabase, embed_model = init_clients()
    run_pipeline(sources=sources, supabase=supabase, embed_model=embed_model, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
