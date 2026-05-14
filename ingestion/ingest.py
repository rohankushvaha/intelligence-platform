"""
LIP v2 — Leela Intelligence Platform
Core Ingestion Pipeline (Crawl4AI — JS rendering fix)
─────────────────────────────────────────────────────────────────────────────
Fix: theleela.com is heavily JavaScript-rendered. Links and content only
appear after JS executes. Changed wait strategy to 'networkidle' and added
explicit page delay. Also added a MANUAL_URLS fallback — if crawling finds
zero links, we scrape a predefined list of known Leela URLs directly.
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
#  MANUAL URL LIST — fallback for JS-heavy sites
#  These are the known, stable Leela URLs we always want ingested.
#  If the crawler finds zero links (JS rendering issue), we scrape these
#  directly. Add more URLs here as the site grows.
# ══════════════════════════════════════════════════════════════════════════

MANUAL_URLS: dict[str, list[str]] = {
    "The Leela — Properties Overview": [
        "https://www.theleela.com/en_US/hotels-resorts.html",
        "https://www.theleela.com/en_US/the-leela-palace-new-delhi.html",
        "https://www.theleela.com/en_US/the-leela-palace-bengaluru.html",
        "https://www.theleela.com/en_US/the-leela-palace-chennai.html",
        "https://www.theleela.com/en_US/the-leela-palace-udaipur.html",
        "https://www.theleela.com/en_US/the-leela-palace-jaipur.html",
        "https://www.theleela.com/en_US/the-leela-goa.html",
        "https://www.theleela.com/en_US/the-leela-kovalam.html",
        "https://www.theleela.com/en_US/the-leela-ambience-gurugram.html",
        "https://www.theleela.com/en_US/the-leela-bhartiya-city-bengaluru.html",
    ],
    "The Leela — Dining": [
        "https://www.theleela.com/en_US/dining.html",
        "https://www.theleela.com/en_US/jamavar-restaurant.html",
        "https://www.theleela.com/en_US/le-cirque-signature.html",
    ],
    "The Leela — Spa & Wellness": [
        "https://www.theleela.com/en_US/spa-wellness.html",
        "https://www.theleela.com/en_US/spa.html",
    ],
    "The Leela — Weddings & Events": [
        "https://www.theleela.com/en_US/weddings-and-events.html",
        "https://www.theleela.com/en_US/meetings-and-events.html",
    ],
    "The Leela — Investor / Corporate": [
        "https://www.theleela.com/en_US/investor-relations.html",
        "https://www.theleela.com/en_US/about-us.html",
        "https://www.theleela.com/en_US/sustainability.html",
    ],
}


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
#  CRAWL4AI CONFIG — JS rendering fix
# ══════════════════════════════════════════════════════════════════════════

def get_browser_config() -> BrowserConfig:
    return BrowserConfig(
        headless       = True,
        verbose        = False,
        sleep_on_close = True,
    )


def get_crawl_config() -> CrawlerRunConfig:
    return CrawlerRunConfig(
        cache_mode = CacheMode.BYPASS,

        # KEY FIX: wait for network to go idle (all JS/AJAX done)
        # 'networkidle' waits until no network requests for 500ms
        # This is much more reliable than 'domcontentloaded' for JS sites
        wait_until = "networkidle",

        # Additional wait after networkidle — some sites have delayed renders
        # 3 seconds gives JS frameworks time to paint content into the DOM
        page_timeout            = 60000,    # 60s total timeout (up from 30s)
        word_count_threshold    = 10,       # lower threshold — capture more
        exclude_external_links  = True,
        remove_overlay_elements = True,
        process_iframes         = False,
        mean_delay              = 2.0,      # polite delay between requests
        max_range               = 1.0,
    )


# ══════════════════════════════════════════════════════════════════════════
#  STEP 1 — CRAWL
# ══════════════════════════════════════════════════════════════════════════

async def _scrape_urls_async(urls: list[str], source_name: str) -> list[dict]:
    """
    Scrape a known list of URLs directly.
    Used as primary strategy for JS-heavy sites where link discovery fails.
    """
    log.info(f"[CRAWL] Scraping {len(urls)} known URLs for {source_name}")

    browser_config = get_browser_config()
    crawl_config   = get_crawl_config()
    pages          = []

    async with AsyncWebCrawler(config=browser_config) as crawler:
        results = await crawler.arun_many(
            urls   = urls,
            config = crawl_config,
        )

        for result in (results if isinstance(results, list) else [results]):
            if not result.success:
                log.warning(f"[CRAWL] Failed: {getattr(result, 'url', '?')} — {getattr(result, 'error_message', '')}")
                continue

            markdown = (result.markdown or "").strip()
            if len(markdown) < 50:
                log.debug(f"[CRAWL] Near-empty page skipped: {result.url}")
                continue

            title = ""
            if result.metadata:
                title = result.metadata.get("title", source_name)

            pages.append({
                "url"     : result.url,
                "markdown": markdown,
                "title"   : title or source_name,
            })
            log.info(f"[CRAWL] ✓ {result.url} ({len(markdown)} chars)")

    log.info(f"[CRAWL] {source_name} → {len(pages)} usable pages")
    return pages


async def _crawl_source_async(source: IngestionSource) -> list[dict]:
    """
    Two-strategy crawl:
    1. Try to discover links from root URL (works on simple HTML sites)
    2. If zero links found, fall back to MANUAL_URLS for this source
    This handles both JS-heavy sites (theleela.com) and simpler sites.
    """
    log.info(f"[CRAWL] Starting: {source.name} → {source.url}")

    browser_config = get_browser_config()
    crawl_config   = get_crawl_config()
    pages          = []

    async with AsyncWebCrawler(config=browser_config) as crawler:

        # Strategy 1: Crawl root URL
        root_result = await crawler.arun(url=source.url, config=crawl_config)

        if root_result.success:
            markdown = (root_result.markdown or "").strip()
            if len(markdown) > 50:
                title = ""
                if root_result.metadata:
                    title = root_result.metadata.get("title", source.name)
                pages.append({
                    "url"     : source.url,
                    "markdown": markdown,
                    "title"   : title or source.name,
                })

            # Try to discover internal links
            internal_links = []
            if root_result.links:
                for link in root_result.links.get("internal", []):
                    href = link.get("href", "")
                    if not href or href == source.url:
                        continue
                    if source.url_patterns:
                        if any(p in href for p in source.url_patterns):
                            internal_links.append(href)
                    else:
                        internal_links.append(href)

            # Deduplicate
            seen = {source.url}
            filtered = []
            for link in internal_links:
                if link not in seen:
                    seen.add(link)
                    filtered.append(link)
                if len(filtered) >= source.max_pages - 1:
                    break

            log.info(f"[CRAWL] Discovered {len(filtered)} links from {source.name}")

            # Crawl discovered links
            if filtered:
                results = await crawler.arun_many(urls=filtered, config=crawl_config)
                for result in (results if isinstance(results, list) else [results]):
                    if not result.success:
                        continue
                    md = (result.markdown or "").strip()
                    if len(md) < 50:
                        continue
                    title = ""
                    if result.metadata:
                        title = result.metadata.get("title", source.name)
                    pages.append({"url": result.url, "markdown": md, "title": title or source.name})

    # Strategy 2: If still no pages, use manual URL list
    if len(pages) == 0 and source.name in MANUAL_URLS:
        log.warning(f"[CRAWL] Zero pages from auto-crawl. Falling back to manual URLs for {source.name}")
        pages = await _scrape_urls_async(MANUAL_URLS[source.name], source.name)
    elif len(pages) <= 1 and source.name in MANUAL_URLS:
        # Only got root page — supplement with manual URLs
        log.info(f"[CRAWL] Only root page found. Supplementing with manual URLs for {source.name}")
        manual_pages = await _scrape_urls_async(MANUAL_URLS[source.name], source.name)
        # Add manual pages not already in pages
        existing_urls = {p["url"] for p in pages}
        for p in manual_pages:
            if p["url"] not in existing_urls:
                pages.append(p)

    log.info(f"[CRAWL] ✓ {len(pages)} total usable pages from {source.name}")
    return pages


@traceable(name="crawl_source")
def crawl_source(source: IngestionSource, dry_run: bool = False) -> list[dict]:
    if dry_run:
        log.info(f"[DRY RUN] Skipping crawl for {source.name}")
        return [{"url": source.url, "markdown": "# Dry run placeholder content for testing", "title": "Dry Run"}]
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

def embed_chunks(chunks: list[dict], embed_model: SentenceTransformer, batch_size: int = 32) -> list[dict]:
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
def upsert_chunks(supabase: SupabaseClient, chunks: list[dict], batch_size: int = 50) -> int:
    if not chunks:
        log.warning("[UPSERT] No chunks to upsert.")
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
        "crawler"        : "crawl4ai (free, keyless) + manual URL fallback",
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
        log.info(f"[CHUNK] {len(chunks)} chunks from {len(pages)} pages")

        if dry_run:
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
