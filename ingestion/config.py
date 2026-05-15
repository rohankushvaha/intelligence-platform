"""
LIP v2 — Leela Intelligence Platform
Ingestion Pipeline Configuration
─────────────────────────────────────────────────────────────────────────────
All URLs verified working May 2026 from live search results.
Mode values match v1 Supabase schema: guest / investor / internal
─────────────────────────────────────────────────────────────────────────────
"""

import os
from dataclasses import dataclass, field
from typing import Literal

SourceType = Literal["official", "press", "competitive", "ugc"]
Mode       = Literal["guest", "investor", "internal"]

SUPABASE_TABLE    = "documents"
EMBEDDING_DIM     = 384
CHUNK_SIZE        = 512
CHUNK_OVERLAP     = 64
LANGSMITH_PROJECT = "lip-v2-ingestion"


@dataclass
class IngestionSource:
    name          : str
    url           : str
    source_type   : SourceType
    mode          : Mode
    property_name : str | None  = None
    max_pages     : int         = 20
    url_patterns  : list[str]   = field(default_factory=list)


SOURCES: list[IngestionSource] = [

    # ── TIER 1 — OFFICIAL ─────────────────────────────────────────────────

    IngestionSource(
        name         = "The Leela — Brand & Properties",
        url          = "https://www.theleela.com",
        source_type  = "official",
        mode         = "guest",
        max_pages    = 25,
        url_patterns = [
            "about-us",
            "special-offers",
            "travel-diaries",
            "leela-palace-trail",
        ],
    ),

    IngestionSource(
        name        = "The Leela — Press Room",
        url         = "https://www.theleela.com/press-room",
        source_type = "official",
        mode        = "investor",
        max_pages   = 20,
    ),

    IngestionSource(
        name        = "The Leela — Investor Relations",
        url         = "https://www.theleela.com/investors",
        source_type = "official",
        mode        = "investor",
        max_pages   = 15,
    ),

    # ── TIER 2 — PRESS ────────────────────────────────────────────────────

    IngestionSource(
        name         = "Condé Nast Traveller India — Leela",
        url          = "https://www.cntraveller.in",
        source_type  = "press",
        mode         = "guest",
        max_pages    = 10,
        url_patterns = ["leela"],
    ),

    IngestionSource(
        name         = "Travel + Leisure India — Leela",
        url          = "https://www.tlindia.com",
        source_type  = "press",
        mode         = "guest",
        max_pages    = 10,
        url_patterns = ["leela"],
    ),

    # ── TIER 3 — COMPETITIVE ──────────────────────────────────────────────

    IngestionSource(
        name         = "Taj Hotels — Properties",
        url          = "https://www.tajhotels.com/en-in/",
        source_type  = "competitive",
        mode         = "internal",
        max_pages    = 15,
        url_patterns = ["hotel", "palace", "resort"],
    ),

    IngestionSource(
        name        = "Oberoi Hotels — Properties",
        url         = "https://www.oberoihotels.com/hotels-in-india/",
        source_type = "competitive",
        mode        = "internal",
        max_pages   = 10,
    ),

    IngestionSource(
        name         = "ITC Hotels — Luxury",
        url          = "https://www.itchotels.com/in/en",
        source_type  = "competitive",
        mode         = "internal",
        max_pages    = 10,
        url_patterns = ["luxury", "hotel"],
    ),
]


# ══════════════════════════════════════════════════════════════════════════
#  VERIFIED MANUAL URLS — May 2026
#  Fallback if Firecrawl auto-discovery returns zero links
# ══════════════════════════════════════════════════════════════════════════

MANUAL_URLS: dict[str, list[str]] = {

    "The Leela — Brand & Properties": [
        "https://www.theleela.com/about-us",
        "https://www.theleela.com/special-offers/the-leela-palace-trail",
        "https://www.theleela.com/special-offers",
        "https://www.theleela.com/travel-diaries/holi-2026-at-the-leela-palaces-hotels-resorts",
    ],

    "The Leela — Press Room": [
        "https://www.theleela.com/press-room",
        "https://www.theleela.com/press-room/the-leela-palaces-hotels-and-resorts-acquires-ultra-luxury-resort-coorg-karnataka",
        "https://www.theleela.com/press-room/the-leela-palaces-hotels-and-resorts-expands-its-footprint-rajasthan-the-signing-of-the",
    ],

    "The Leela — Investor Relations": [
        "https://www.theleela.com/investors",
        "https://www.theleela.com/about-us",
    ],
}
