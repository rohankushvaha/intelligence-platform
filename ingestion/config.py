"""
LIP v2 — Leela Intelligence Platform
Ingestion Pipeline Configuration
─────────────────────────────────────────────────────────────────────────────
IMPORTANT: theleela.com migrated from /en_US/ URLs to clean URLs.
Old: theleela.com/en_US/spa-wellness.html
New: theleela.com/the-leela-palace-udaipur/experience/wellness

All URLs updated to reflect current site structure (May 2026).
─────────────────────────────────────────────────────────────────────────────
"""

import os
from dataclasses import dataclass, field
from typing import Literal

SourceType = Literal["official", "press", "competitive", "ugc"]
Mode       = Literal["concierge", "investor", "internal"]

SUPABASE_TABLE  = "documents"
EMBEDDING_DIM   = 384
CHUNK_SIZE      = 512
CHUNK_OVERLAP   = 64
LANGSMITH_PROJECT = "lip-v2-ingestion"


@dataclass
class IngestionSource:
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
        url          = "https://www.theleela.com",
        source_type  = "official",
        mode         = "concierge",
        max_pages    = 30,
        url_patterns = ["hotel", "palace", "resort", "property"],
    ),
    IngestionSource(
        name         = "The Leela — Dining",
        url          = "https://www.theleela.com",
        source_type  = "official",
        mode         = "concierge",
        max_pages    = 20,
        url_patterns = ["dining", "restaurant", "dine"],
    ),
    IngestionSource(
        name         = "The Leela — Spa & Wellness",
        url          = "https://www.theleela.com",
        source_type  = "official",
        mode         = "concierge",
        max_pages    = 15,
        url_patterns = ["wellness", "spa"],
    ),
    IngestionSource(
        name         = "The Leela — Weddings & Events",
        url          = "https://www.theleela.com",
        source_type  = "official",
        mode         = "concierge",
        max_pages    = 15,
        url_patterns = ["wedding", "celebration", "meeting"],
    ),
    IngestionSource(
        name         = "The Leela — Investor / Corporate",
        url          = "https://www.theleela.com",
        source_type  = "official",
        mode         = "investor",
        max_pages    = 20,
        url_patterns = ["investor", "annual", "corporate", "sustainability", "press-room"],
    ),

    # ── TIER 2 — PRESS ────────────────────────────────────────────────────
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

    # ── TIER 3 — COMPETITIVE ──────────────────────────────────────────────
    IngestionSource(
        name         = "Taj Hotels — Property Pages",
        url          = "https://www.tajhotels.com/en-in/",
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
        url_patterns = ["luxury", "hotel"],
    ),
]


# ══════════════════════════════════════════════════════════════════════════
#  MANUAL URL LIST
#  Updated with correct theleela.com URL structure (May 2026)
#  Used as fallback when auto-crawl returns 0 pages (JS blocking).
# ══════════════════════════════════════════════════════════════════════════

MANUAL_URLS: dict[str, list[str]] = {

    "The Leela — Properties Overview": [
        "https://www.theleela.com",
        "https://www.theleela.com/the-leela-palace-new-delhi",
        "https://www.theleela.com/the-leela-palace-bengaluru",
        "https://www.theleela.com/the-leela-palace-chennai",
        "https://www.theleela.com/the-leela-palace-udaipur",
        "https://www.theleela.com/the-leela-palace-jaipur",
        "https://www.theleela.com/the-leela-goa",
        "https://www.theleela.com/the-leela-kovalam-a-raviz-hotel",
        "https://www.theleela.com/the-leela-ambience-gurugram-hotel-residences",
        "https://www.theleela.com/the-leela-bhartiya-city-bengaluru",
        "https://www.theleela.com/the-leela-hyderabad",
        "https://www.theleela.com/the-leela-ambience-convention-hotel-delhi",
    ],

    "The Leela — Dining": [
        "https://www.theleela.com/the-leela-palace-new-delhi/dine",
        "https://www.theleela.com/the-leela-palace-bengaluru/dine",
        "https://www.theleela.com/the-leela-palace-udaipur/dine",
        "https://www.theleela.com/the-leela-palace-jaipur/dine",
        "https://www.theleela.com/the-leela-palace-chennai/dine",
        "https://www.theleela.com/the-leela-ambience-gurugram-hotel-residences/dine",
    ],

    "The Leela — Spa & Wellness": [
        "https://www.theleela.com/wellness",
        "https://www.theleela.com/the-leela-palace-udaipur/experience/wellness",
        "https://www.theleela.com/the-leela-palace-new-delhi/experience/wellness",
        "https://www.theleela.com/the-leela-palace-bengaluru/experience/wellness",
        "https://www.theleela.com/the-leela-ambience-gurugram-hotel-residences/experience/wellness",
        "https://www.theleela.com/the-leela-ambience-convention-hotel-delhi/experience/wellness",
    ],

    "The Leela — Weddings & Events": [
        "https://www.theleela.com/the-leela-palace-new-delhi/celebrations",
        "https://www.theleela.com/the-leela-palace-udaipur/celebrations",
        "https://www.theleela.com/the-leela-palace-jaipur/celebrations",
        "https://www.theleela.com/the-leela-palace-bengaluru/celebrations",
        "https://www.theleela.com/the-leela-ambience-gurugram-hotel-residences/celebrations",
    ],

    "The Leela — Investor / Corporate": [
        "https://www.theleela.com/leela-discovery-loyalty-programme",
        "https://www.theleela.com/special-offers/the-leela-palace-trail",
        "https://www.theleela.com/press-room/the-leela-voted-one-top-15-hotel-brands-the-world-travelleisure-usa-2017-worlds-best",
    ],
}
