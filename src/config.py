"""
LIP v2 — Leela Intelligence Platform
Ingestion Pipeline Configuration
─────────────────────────────────────────────────────────────────────────────
All environment variables, source definitions, and constants live here.
Never hard-code credentials. Load them from a .env file (see .env.example).
─────────────────────────────────────────────────────────────────────────────
"""

import os
from dataclasses import dataclass, field
from typing import Literal

# ── Source type union ──────────────────────────────────────────────────────
SourceType = Literal["official", "press", "competitive", "ugc"]
Mode       = Literal["concierge", "investor", "internal"]

# ── Supabase schema constants ──────────────────────────────────────────────
SUPABASE_TABLE  = "documents"
EMBEDDING_DIM   = 384           # all-MiniLM-L6-v2 output dimension (v1 parity)

# ── Chunking parameters ────────────────────────────────────────────────────
# Chosen to balance context richness vs. vector search precision.
# 512 tokens ≈ 350-400 words — enough for one coherent idea about a property.
CHUNK_SIZE      = 512
CHUNK_OVERLAP   = 64            # small overlap preserves sentence continuity

# ── Firecrawl rate limiting ────────────────────────────────────────────────
# Free tier: 500 credits one-time; refreshes 1,000/month on current free plan.
# Scrape = 1 credit, AI extract = 5 credits.
# We use plain scrape (markdown) only → 1 credit per page.
# Set a conservative delay to avoid 429s on the free concurrency limit.
FIRECRAWL_DELAY_SECONDS = 2.0   # pause between page scrapes

# ── LangSmith observability ────────────────────────────────────────────────
# Free Developer tier: 5,000 traces/month, 14-day retention, 1 seat.
# Each ingest run counts as one trace. Well within limits for prototype use.
LANGSMITH_PROJECT = "lip-v2-ingestion"


# ══════════════════════════════════════════════════════════════════════════
#  SOURCE REGISTRY
#  Add or comment out sources here — the pipeline reads this list at runtime.
# ══════════════════════════════════════════════════════════════════════════

@dataclass
class IngestionSource:
    """
    Defines one knowledge source to crawl and embed.

    Fields
    ------
    name         : human-readable label stored in source_name column
    url          : root URL to crawl
    source_type  : tier classification (official / press / competitive / ugc)
    mode         : which chat mode this content surfaces in
    property_name: leave None for brand-wide content
    max_pages    : hard cap to protect Firecrawl credits
    url_patterns : if set, only crawl URLs matching these substrings
    """
    name          : str
    url           : str
    source_type   : SourceType
    mode          : Mode
    property_name : str | None       = None
    max_pages     : int              = 20
    url_patterns  : list[str]        = field(default_factory=list)


SOURCES: list[IngestionSource] = [

    # ── TIER 1 — OFFICIAL ─────────────────────────────────────────────────
    IngestionSource(
        name         = "The Leela — Properties Overview",
        url          = "https://www.theleela.com/en_US/hotels-resorts.html",
        source_type  = "official",
        mode         = "concierge",
        max_pages    = 30,
        url_patterns = ["hotels-resorts", "property", "palace", "resort"],
    ),
    IngestionSource(
        name         = "The Leela — Dining",
        url          = "https://www.theleela.com/en_US/dining.html",
        source_type  = "official",
        mode         = "concierge",
        max_pages    = 20,
        url_patterns = ["dining", "restaurant", "bar", "lounge"],
    ),
    IngestionSource(
        name         = "The Leela — Spa & Wellness",
        url          = "https://www.theleela.com/en_US/spa-wellness.html",
        source_type  = "official",
        mode         = "concierge",
        max_pages    = 15,
        url_patterns = ["spa", "wellness", "ayurveda"],
    ),
    IngestionSource(
        name         = "The Leela — Weddings & Events",
        url          = "https://www.theleela.com/en_US/weddings-and-events.html",
        source_type  = "official",
        mode         = "concierge",
        max_pages    = 15,
        url_patterns = ["wedding", "event", "banquet", "mice"],
    ),
    IngestionSource(
        name         = "The Leela — Investor / Corporate",
        url          = "https://www.theleela.com/en_US/investor-relations.html",
        source_type  = "official",
        mode         = "investor",
        max_pages    = 20,
        url_patterns = ["investor", "annual", "report", "corporate", "esg"],
    ),

    # ── TIER 2 — PRESS ────────────────────────────────────────────────────
    # NOTE: Press sites often block bots. Firecrawl's anti-bot layer helps.
    # If a source returns empty content, flag it — do not waste credits retrying.
    IngestionSource(
        name         = "Condé Nast Traveller India — Leela coverage",
        url          = "https://www.cntraveller.in",
        source_type  = "press",
        mode         = "concierge",
        max_pages    = 10,
        url_patterns = ["leela"],
    ),
    IngestionSource(
        name         = "Travel + Leisure India — Leela coverage",
        url          = "https://www.tlindia.com",
        source_type  = "press",
        mode         = "concierge",
        max_pages    = 10,
        url_patterns = ["leela"],
    ),

    # ── TIER 3 — COMPETITIVE INTELLIGENCE ────────────────────────────────
    # Stored with source_type="competitive" so the frontend can optionally
    # surface or suppress competitor content depending on the mode.
    IngestionSource(
        name         = "Taj Hotels — Property Pages",
        url          = "https://www.tajhotels.com/en-in/hotels/",
        source_type  = "competitive",
        mode         = "internal",
        max_pages    = 15,
        url_patterns = ["hotel", "palace", "resort"],
    ),
    IngestionSource(
        name         = "Oberoi Hotels — Property Pages",
        url          = "https://www.oberoihotels.com/hotels-in-india/",
        source_type  = "competitive",
        mode         = "internal",
        max_pages    = 10,
    ),
    IngestionSource(
        name         = "ITC Hotels — Luxury Collection",
        url          = "https://www.itchotels.com/in/en",
        source_type  = "competitive",
        mode         = "internal",
        max_pages    = 10,
        url_patterns = ["luxury", "welcome", "hotel"],
    ),

    # ── TIER 4 — UGC (stub — implement after Tiers 1-3 are stable) ────────
    # TripAdvisor's ToS prohibits bulk scraping. Use their public API or
    # manually curate representative reviews and load them as PDFs.
    # Uncomment and implement when you have a compliant data source.
    #
    # IngestionSource(
    #     name        = "TripAdvisor — Leela Reviews Summary",
    #     url         = "https://www.tripadvisor.in/...",
    #     source_type = "ugc",
    #     mode        = "concierge",
    #     max_pages   = 5,
    # ),
]
