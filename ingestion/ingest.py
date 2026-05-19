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
import re
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
    MIN_CHUNK_QUALITY_SCORE,
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

    firecrawl   = FirecrawlApp(api_key=_require_env("FIRECRAWL_API_KEY"))
    supabase    = create_client(
        _require_env("SUPABASE_URL"),
        _require_env("SUPABASE_SERVICE_KEY"),
    )

    log.info("Loading embedding model…")
    embed_model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

    log.info("All clients ready.")
    return firecrawl, supabase, embed_model


# ══════════════════════════════════════════════════════════════════════════
#  STEP 1 — CRAWL
# ══════════════════════════════════════════════════════════════════════════

@traceable(name="crawl_source")
def crawl_source(
    firecrawl : FirecrawlApp,
    source    : IngestionSource,
    dry_run   : bool = False,
) -> list[dict]:
    if dry_run:
        log.info(f"[DRY RUN] Skipping crawl for {source.name}")
        return [{"url": source.url, "markdown": "# Dry run placeholder content for testing the pipeline.", "title": "Dry Run"}]

    log.info(f"[CRAWL] {source.name} → {source.url}")

    params: dict = {
        "limit"        : source.max_pages,
        "scrapeOptions": {"formats": ["markdown"]},
    }

    if source.url_patterns:
        params["includePaths"] = source.url_patterns

    try:
        result = firecrawl.crawl_url(source.url, params=params)

        pages = result.get("data", []) if isinstance(result, dict) else (getattr(result, "data", []) or [])

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

            # Clean the markdown BEFORE checking length
            # Raw Firecrawl markdown contains image CDN URLs, date pickers,
            # booking widgets, and nav chrome — clean it first
            cleaned = clean_markdown(markdown)

            if len(cleaned.strip()) > 100:
                normalised.append({
                    "url"     : url,
                    "markdown": cleaned,
                    "title"   : title,
                })
            else:
                log.debug(f"[CRAWL] Skipped page with insufficient content after cleaning: {url}")

        log.info(f"[CRAWL] ✓ {len(normalised)} usable pages from {source.name}")
        time.sleep(25)  # Polite delay — Firecrawl free tier: 3 req/min
        return normalised

    except Exception as exc:
        log.error(f"[CRAWL] ✗ {source.name} failed: {exc}")
        return []


# ══════════════════════════════════════════════════════════════════════════
#  CONTENT CLEANING  ← THE KEY FIX
# ══════════════════════════════════════════════════════════════════════════

def clean_markdown(text: str) -> str:
    """
    Strip UI chrome from Firecrawl markdown output before chunking.

    Firecrawl returns clean markdown but hotel/travel websites are full of:
    - Image CDN URLs embedded as markdown images
    - Date picker widgets (S M T W T F S / 1 2 3 4 5 6 7 ...)
    - Booking widgets (1 Guest / 1 Room / Check-in Check-out)
    - Navigation breadcrumbs and skip links
    - Social share buttons
    - Cookie consent banners
    - Repetitive footer links

    After cleaning, only human-readable prose content remains — which is
    what the LLM actually needs to answer questions.
    """

    # 1. Remove markdown images entirely — ![alt](url)
    #    These are CDN image URLs that add zero semantic value
    text = re.sub(r'!\[.*?\]\(https?://[^\)]+\)', '', text)

    # 2. Remove bare CDN/image URLs on their own lines
    text = re.sub(r'^https?://(?:cdn\.|images\.|static\.|assets\.).*$', '', text, flags=re.MULTILINE)

    # 3. Remove markdown links but KEEP the link text — [text](url) → text
    #    Exception: keep links that are clearly navigation (skip to content etc)
    text = re.sub(r'\[([^\]]+)\]\(https?://[^\)]+\)', r'\1', text)

    # 4. Remove "Skip to main content" and similar accessibility nav lines
    text = re.sub(r'^Skip to.*$', '', text, flags=re.MULTILINE | re.IGNORECASE)

    # 5. Remove date picker widgets — lines that are just calendar headers/numbers
    #    Pattern: lines containing only S M T W T F S or sequences of numbers
    text = re.sub(r'^[SMTWF\s\d]+$', '', text, flags=re.MULTILINE)

    # 6. Remove booking widget lines
    booking_patterns = [
        r'^\d+\s*Guest[s]?\s*$',
        r'^\d+\s*Room[s]?\s*$',
        r'^Check[- ]?in\s*$',
        r'^Check[- ]?out\s*$',
        r'^Check Availability\s*$',
        r'^Book Now\s*$',
        r'^SELECT DATES\s*$',
        r'^\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\s*$',
    ]
    for pattern in booking_patterns:
        text = re.sub(pattern, '', text, flags=re.MULTILINE | re.IGNORECASE)

    # 7. Remove social share / utility button lines
    social_patterns = [
        r'^SHARE\s*$',
        r'^SHARE\s+[\w\s]+$',
        r'^Follow\s+(?:us|on)\s*$',
        r'^Subscribe\s*$',
        r'^Newsletter\s*$',
        r'^Cookie\s+(?:Policy|Settings|Consent)\s*$',
        r'^Accept\s+(?:All\s+)?Cookies\s*$',
    ]
    for pattern in social_patterns:
        text = re.sub(pattern, '', text, flags=re.MULTILINE | re.IGNORECASE)

    # 8. Remove lines that are just separators or horizontal rules
    text = re.sub(r'^[\s\*\-_=]{3,}\s*$', '', text, flags=re.MULTILINE)

    # 9. Remove lines that are pure punctuation or symbols
    text = re.sub(r'^[^\w\s]{1,5}\s*$', '', text, flags=re.MULTILINE)

    # 10. Collapse 3+ consecutive blank lines into 2
    text = re.sub(r'\n{3,}', '\n\n', text)

    # 11. Strip leading/trailing whitespace per line
    lines = [line.strip() for line in text.split('\n')]

    # 12. Final filter — remove lines that are too short to be meaningful
    #     (less than 20 chars and not a heading) — catches nav remnants
    cleaned_lines = []
    for line in lines:
        is_heading   = line.startswith('#')
        is_long      = len(line) >= 20
        is_empty     = len(line) == 0
        if is_heading or is_long or is_empty:
            cleaned_lines.append(line)

    return '\n'.join(cleaned_lines).strip()


def quality_score(text: str) -> float:
    """
    Score a chunk 0.0–1.0 based on content quality signals.

    High score = dense prose with real hospitality information.
    Low score  = nav chrome, image URLs, repetitive boilerplate.

    Used to filter out chunks that slipped through cleaning.
    """
    if not text or len(text) < 50:
        return 0.0

    words        = text.split()
    total_words  = len(words)

    if total_words < 10:
        return 0.0

    # Signal 1: ratio of alphabetic words to total words
    alpha_words  = sum(1 for w in words if re.match(r'^[a-zA-Z]{2,}', w))
    alpha_ratio  = alpha_words / total_words

    # Signal 2: average word length (URLs and nav chrome have short tokens)
    avg_word_len = sum(len(w) for w in words) / total_words

    # Signal 3: sentence-like structure (contains periods or commas)
    has_sentences = bool(re.search(r'[.,;:!?]', text))

    # Signal 4: hospitality keyword density — these words = good content
    hospitality_keywords = {
        'hotel', 'palace', 'resort', 'suite', 'room', 'spa', 'dining',
        'restaurant', 'pool', 'gym', 'wedding', 'banquet', 'conference',
        'leela', 'luxury', 'guest', 'service', 'amenity', 'amenities',
        'breakfast', 'check', 'property', 'location', 'view', 'garden',
        'award', 'heritage', 'culture', 'experience', 'stay', 'offer',
        'revenue', 'investor', 'financial', 'annual', 'report', 'growth',
        'taj', 'oberoi', 'itc', 'competitive', 'market', 'brand',
    }
    text_lower   = text.lower()
    kw_hits      = sum(1 for kw in hospitality_keywords if kw in text_lower)
    kw_score     = min(kw_hits / 5, 1.0)  # cap at 1.0 after 5 keyword hits

    # Combine signals
    score = (
        alpha_ratio  * 0.4 +
        min(avg_word_len / 8, 1.0) * 0.2 +
        (0.2 if has_sentences else 0.0) +
        kw_score     * 0.2
    )

    return round(score, 3)


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
    import uuid
    name = f"{url}::{chunk_index}"
    return str(uuid.uuid5(uuid.NAMESPACE_URL, name))


def chunk_pages(pages: list[dict], source: IngestionSource) -> Iterator[dict]:
    skipped_quality = 0
    total_chunks    = 0

    for page in pages:
        raw_text = page.get("markdown", "").strip()
        page_url = page.get("url", source.url)
        title    = page.get("title", source.name)

        if not raw_text or len(raw_text) < 100:
            continue

        for idx, chunk_text in enumerate(_splitter.split_text(raw_text)):
            total_chunks += 1

            # Quality gate — skip junk chunks that slipped through cleaning
            score = quality_score(chunk_text)
            if score < MIN_CHUNK_QUALITY_SCORE:
                skipped_quality += 1
                log.debug(f"[CHUNK] Skipped low-quality chunk (score={score:.2f}): {chunk_text[:80]!r}")
                continue

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
                "quality_score": score,
            }

    if total_chunks:
        kept = total_chunks - skipped_quality
        log.info(f"[CHUNK] Quality filter: kept {kept}/{total_chunks} chunks ({skipped_quality} skipped)")


# ══════════════════════════════════════════════════════════════════════════
#  STEP 3 — EMBED
# ══════════════════════════════════════════════════════════════════════════

def embed_chunks(
    chunks     : list[dict],
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
        log.info(f"[CHUNK] {len(chunks)} quality chunks from {len(pages)} pages")

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
            print(f"  [{s.source_type:>12}] {s.name} — {s.url}")
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
