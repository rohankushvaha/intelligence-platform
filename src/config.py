"""
LIP v2 — Leela Intelligence Platform
Ingestion Pipeline Configuration
─────────────────────────────────────────────────────────────────────────────
VERIFIED: May 2026 — sourced directly from theleela.com navigation
14 live operational properties as of May 2026.

KEY ARCHITECTURE CHANGE vs v1:
  OLD: crawl entire sitemaps with generic url_patterns → 5,000 junk chunks
  NEW: explicit targeted URLs per property per content type → ~400 clean chunks

  Why explicit URLs?
  Firecrawl's auto-crawl follows every nav link it finds — booking widgets,
  date pickers, image galleries, filter pages — none of which has concierge
  value. By specifying exact URLs, we guarantee every ingested page is
  high-quality prose content a guest or investor would actually read.

PIPELINE TUNING:
  CHUNK_SIZE increased 512 → 800 chars: more context per retrieval chunk
  CHUNK_OVERLAP increased 64 → 100 chars: better sentence continuity
  MIN_CHUNK_QUALITY_SCORE = 0.35: quality gate filters residual boilerplate

PIPELINE — coming soon (not yet live on theleela.com, do not ingest):
  - The Leela Mumbai Waterstone (BKC mixed-use, under development)
  - The Leela Jaisalmer (signed Nov 2025, opening 2026)
  - The Leela Dubai Palm Jumeirah (25% stake, rebranding ~2027)
  - The Leela Sikkim (pipeline)
─────────────────────────────────────────────────────────────────────────────
"""

import os
from dataclasses import dataclass, field
from typing import Literal

SourceType = Literal["official", "press", "competitive", "ugc"]
Mode       = Literal["guest", "investor", "internal"]

# ── Pipeline tuning ───────────────────────────────────────────────────────
SUPABASE_TABLE          = "documents"
EMBEDDING_DIM           = 384
CHUNK_SIZE              = 800
CHUNK_OVERLAP           = 100
LANGSMITH_PROJECT       = "lip-v2-ingestion"
MIN_CHUNK_QUALITY_SCORE = 0.35


@dataclass
class IngestionSource:
    name          : str
    url           : str
    source_type   : SourceType
    mode          : Mode
    property_name : str | None  = None
    max_pages     : int         = 20
    url_patterns  : list[str]   = field(default_factory=list)
    explicit_urls : list[str]   = field(default_factory=list)


# ══════════════════════════════════════════════════════════════════════════
#  URL PATTERN CONVENTION
#  For each property, we target these page types:
#    /                      → property overview & headline copy
#    /rooms-suites          → room categories, sq footage, views
#    /dining                → restaurant names, cuisine types, ambience
#    /spa-wellness          → spa brand (ESPA/Aujasya), treatments, facilities
#    /weddings              → venues, capacity, signature packages
#    /meetings-events       → MICE venues, AV, capacity
#    /location              → neighbourhood, distances, transport
#
#  Not targeted (low signal-to-noise):
#    /special-offers        → dynamic pricing pages, not concierge content
#    /gallery               → image-only pages
#    /book                  → booking engine, pure UI
# ══════════════════════════════════════════════════════════════════════════

SOURCES: list[IngestionSource] = [

    # ══════════════════════════════════════════════════════════════════════
    #  TIER 1A — BRAND LEVEL
    # ══════════════════════════════════════════════════════════════════════

    IngestionSource(
        name          = "The Leela — Brand & Philosophy",
        url           = "https://www.theleela.com/about-us",
        source_type   = "official",
        mode          = "guest",
        property_name = None,
        explicit_urls = [
            "https://www.theleela.com/about-us",
            "https://www.theleela.com/awards-and-accolades",
            "https://www.theleela.com/sustainability",
            "https://www.theleela.com/aujasya-by-the-leela",
            "https://www.theleela.com/the-leela-palace-service",
            "https://www.theleela.com/culinary-artistry-at-the-leela",
            "https://www.theleela.com/tishya-by-the-leela",
            "https://www.theleela.com/leela-discovery-loyalty-programme",
            "https://www.theleela.com/icons-of-india",
        ],
    ),

    # ══════════════════════════════════════════════════════════════════════
    #  TIER 1B — PALACES (Udaipur, New Delhi, Jaipur, Bengaluru, Chennai)
    #  These are the flagship Palace properties — highest search intent
    # ══════════════════════════════════════════════════════════════════════

    IngestionSource(
        name          = "The Leela Palace Udaipur",
        url           = "https://www.theleela.com/the-leela-palace-udaipur",
        source_type   = "official",
        mode          = "guest",
        property_name = "Udaipur",
        explicit_urls = [
            "https://www.theleela.com/the-leela-palace-udaipur",
            "https://www.theleela.com/the-leela-palace-udaipur/rooms-suites",
            "https://www.theleela.com/the-leela-palace-udaipur/dining",
            "https://www.theleela.com/the-leela-palace-udaipur/spa-wellness",
            "https://www.theleela.com/the-leela-palace-udaipur/weddings",
            "https://www.theleela.com/the-leela-palace-udaipur/meetings-events",
            "https://www.theleela.com/the-leela-palace-udaipur/location",
        ],
    ),

    IngestionSource(
        name          = "The Leela Palace New Delhi",
        url           = "https://www.theleela.com/the-leela-palace-new-delhi",
        source_type   = "official",
        mode          = "guest",
        property_name = "New Delhi",
        explicit_urls = [
            "https://www.theleela.com/the-leela-palace-new-delhi",
            "https://www.theleela.com/the-leela-palace-new-delhi/rooms-suites",
            "https://www.theleela.com/the-leela-palace-new-delhi/dining",
            "https://www.theleela.com/the-leela-palace-new-delhi/spa-wellness",
            "https://www.theleela.com/the-leela-palace-new-delhi/weddings",
            "https://www.theleela.com/the-leela-palace-new-delhi/meetings-events",
            "https://www.theleela.com/the-leela-palace-new-delhi/location",
        ],
    ),

    IngestionSource(
        name          = "The Leela Palace Jaipur",
        url           = "https://www.theleela.com/the-leela-palace-jaipur",
        source_type   = "official",
        mode          = "guest",
        property_name = "Jaipur",
        explicit_urls = [
            "https://www.theleela.com/the-leela-palace-jaipur",
            "https://www.theleela.com/the-leela-palace-jaipur/rooms-suites",
            "https://www.theleela.com/the-leela-palace-jaipur/dining",
            "https://www.theleela.com/the-leela-palace-jaipur/spa-wellness",
            "https://www.theleela.com/the-leela-palace-jaipur/weddings",
            "https://www.theleela.com/the-leela-palace-jaipur/meetings-events",
            "https://www.theleela.com/the-leela-palace-jaipur/location",
        ],
    ),

    IngestionSource(
        name          = "The Leela Palace Bengaluru",
        url           = "https://www.theleela.com/the-leela-palace-bengaluru",
        source_type   = "official",
        mode          = "guest",
        property_name = "Bengaluru",
        explicit_urls = [
            "https://www.theleela.com/the-leela-palace-bengaluru",
            "https://www.theleela.com/the-leela-palace-bengaluru/rooms-suites",
            "https://www.theleela.com/the-leela-palace-bengaluru/dining",
            "https://www.theleela.com/the-leela-palace-bengaluru/spa-wellness",
            "https://www.theleela.com/the-leela-palace-bengaluru/weddings",
            "https://www.theleela.com/the-leela-palace-bengaluru/meetings-events",
            "https://www.theleela.com/the-leela-palace-bengaluru/location",
        ],
    ),

    IngestionSource(
        name          = "The Leela Palace Chennai",
        url           = "https://www.theleela.com/the-leela-palace-chennai",
        source_type   = "official",
        mode          = "guest",
        property_name = "Chennai",
        explicit_urls = [
            "https://www.theleela.com/the-leela-palace-chennai",
            "https://www.theleela.com/the-leela-palace-chennai/rooms-suites",
            "https://www.theleela.com/the-leela-palace-chennai/dining",
            "https://www.theleela.com/the-leela-palace-chennai/spa-wellness",
            "https://www.theleela.com/the-leela-palace-chennai/weddings",
            "https://www.theleela.com/the-leela-palace-chennai/meetings-events",
            "https://www.theleela.com/the-leela-palace-chennai/location",
        ],
    ),

    # ══════════════════════════════════════════════════════════════════════
    #  TIER 1C — CITY HOTELS
    #  (Mumbai, Hyderabad, Gurugram, Gandhinagar, Ambience Delhi)
    # ══════════════════════════════════════════════════════════════════════

    IngestionSource(
        name          = "The Leela Mumbai",
        url           = "https://www.theleela.com/the-leela-mumbai",
        source_type   = "official",
        mode          = "guest",
        property_name = "Mumbai",
        explicit_urls = [
            "https://www.theleela.com/the-leela-mumbai",
            "https://www.theleela.com/the-leela-mumbai/rooms-suites",
            "https://www.theleela.com/the-leela-mumbai/dining",
            "https://www.theleela.com/the-leela-mumbai/spa-wellness",
            "https://www.theleela.com/the-leela-mumbai/weddings",
            "https://www.theleela.com/the-leela-mumbai/meetings-events",
            "https://www.theleela.com/the-leela-mumbai/location",
            "https://www.theleela.com/the-leela-mumbai/experience/leisure",
        ],
    ),

    IngestionSource(
        name          = "The Leela Hyderabad",
        url           = "https://www.theleela.com/the-leela-hyderabad",
        source_type   = "official",
        mode          = "guest",
        property_name = "Hyderabad",
        explicit_urls = [
            "https://www.theleela.com/the-leela-hyderabad",
            "https://www.theleela.com/the-leela-hyderabad/rooms-suites",
            "https://www.theleela.com/the-leela-hyderabad/dining",
            "https://www.theleela.com/the-leela-hyderabad/spa-wellness",
            "https://www.theleela.com/the-leela-hyderabad/weddings",
            "https://www.theleela.com/the-leela-hyderabad/meetings-events",
            "https://www.theleela.com/the-leela-hyderabad/location",
        ],
    ),

    IngestionSource(
        name          = "The Leela Ambience Gurugram Hotel & Residences",
        url           = "https://www.theleela.com/the-leela-ambience-gurugram-hotel-residences",
        source_type   = "official",
        mode          = "guest",
        property_name = "Gurugram",
        explicit_urls = [
            "https://www.theleela.com/the-leela-ambience-gurugram-hotel-residences",
            "https://www.theleela.com/the-leela-ambience-gurugram-hotel-residences/rooms-suites",
            "https://www.theleela.com/the-leela-ambience-gurugram-hotel-residences/dining",
            "https://www.theleela.com/the-leela-ambience-gurugram-hotel-residences/spa-wellness",
            "https://www.theleela.com/the-leela-ambience-gurugram-hotel-residences/weddings",
            "https://www.theleela.com/the-leela-ambience-gurugram-hotel-residences/meetings-events",
            "https://www.theleela.com/the-leela-ambience-gurugram-hotel-residences/location",
        ],
    ),

    IngestionSource(
        name          = "The Leela Gandhinagar",
        url           = "https://www.theleela.com/the-leela-gandhinagar",
        source_type   = "official",
        mode          = "guest",
        property_name = "Gandhinagar",
        explicit_urls = [
            "https://www.theleela.com/the-leela-gandhinagar",
            "https://www.theleela.com/the-leela-gandhinagar/rooms-suites",
            "https://www.theleela.com/the-leela-gandhinagar/dining",
            "https://www.theleela.com/the-leela-gandhinagar/spa-wellness",
            "https://www.theleela.com/the-leela-gandhinagar/weddings",
            "https://www.theleela.com/the-leela-gandhinagar/meetings-events",
            "https://www.theleela.com/the-leela-gandhinagar/location",
            "https://www.theleela.com/mahatma-mandir-convention-exhibition-centre",
        ],
    ),

    IngestionSource(
        name          = "The Leela Ambience Convention Hotel Delhi",
        url           = "https://www.theleela.com/the-leela-ambience-convention-hotel-delhi",
        source_type   = "official",
        mode          = "guest",
        property_name = "East Delhi",
        explicit_urls = [
            "https://www.theleela.com/the-leela-ambience-convention-hotel-delhi",
            "https://www.theleela.com/the-leela-ambience-convention-hotel-delhi/rooms-suites",
            "https://www.theleela.com/the-leela-ambience-convention-hotel-delhi/dining",
            "https://www.theleela.com/the-leela-ambience-convention-hotel-delhi/spa-wellness",
            "https://www.theleela.com/the-leela-ambience-convention-hotel-delhi/weddings",
            "https://www.theleela.com/the-leela-ambience-convention-hotel-delhi/meetings-events",
            "https://www.theleela.com/the-leela-ambience-convention-hotel-delhi/location",
        ],
    ),

    # ══════════════════════════════════════════════════════════════════════
    #  TIER 1D — RESORTS (Kerala backwaters + Coorg)
    # ══════════════════════════════════════════════════════════════════════

    IngestionSource(
        name          = "The Leela Bhartiya City Bengaluru",
        url           = "https://www.theleela.com/the-leela-bhartiya-city-bengaluru",
        source_type   = "official",
        mode          = "guest",
        property_name = "Bhartiya City Bengaluru",
        explicit_urls = [
            "https://www.theleela.com/the-leela-bhartiya-city-bengaluru",
            "https://www.theleela.com/the-leela-bhartiya-city-bengaluru/rooms-suites",
            "https://www.theleela.com/the-leela-bhartiya-city-bengaluru/dining",
            "https://www.theleela.com/the-leela-bhartiya-city-bengaluru/spa-wellness",
            "https://www.theleela.com/the-leela-bhartiya-city-bengaluru/weddings",
            "https://www.theleela.com/the-leela-bhartiya-city-bengaluru/meetings-events",
            "https://www.theleela.com/the-leela-bhartiya-city-bengaluru/location",
            "https://www.theleela.com/the-leela-bhartiya-city-bengaluru-convention-centre",
        ],
    ),

    IngestionSource(
        name          = "The Leela Kovalam, A Raviz Hotel",
        url           = "https://www.theleela.com/the-leela-kovalam-a-raviz-hotel",
        source_type   = "official",
        mode          = "guest",
        property_name = "Kovalam",
        explicit_urls = [
            "https://www.theleela.com/the-leela-kovalam-a-raviz-hotel",
            "https://www.theleela.com/the-leela-kovalam-a-raviz-hotel/rooms-suites",
            "https://www.theleela.com/the-leela-kovalam-a-raviz-hotel/dining",
            "https://www.theleela.com/the-leela-kovalam-a-raviz-hotel/spa-wellness",
            "https://www.theleela.com/the-leela-kovalam-a-raviz-hotel/weddings",
            "https://www.theleela.com/the-leela-kovalam-a-raviz-hotel/meetings-events",
            "https://www.theleela.com/the-leela-kovalam-a-raviz-hotel/location",
        ],
    ),

    IngestionSource(
        name          = "The Leela Ashtamudi, A Raviz Hotel",
        url           = "https://www.theleela.com/the-leela-ashtamudi-a-raviz-hotel",
        source_type   = "official",
        mode          = "guest",
        property_name = "Ashtamudi",
        explicit_urls = [
            "https://www.theleela.com/the-leela-ashtamudi-a-raviz-hotel",
            "https://www.theleela.com/the-leela-ashtamudi-a-raviz-hotel/rooms-suites",
            "https://www.theleela.com/the-leela-ashtamudi-a-raviz-hotel/dining",
            "https://www.theleela.com/the-leela-ashtamudi-a-raviz-hotel/spa-wellness",
            "https://www.theleela.com/the-leela-ashtamudi-a-raviz-hotel/weddings",
            "https://www.theleela.com/the-leela-ashtamudi-a-raviz-hotel/meetings-events",
            "https://www.theleela.com/the-leela-ashtamudi-a-raviz-hotel/location",
        ],
    ),

    IngestionSource(
        name          = "The Leela Coorg Forest Sanctuary",
        url           = "https://www.theleela.com/the-leela-coorg-forest-sanctuary",
        source_type   = "official",
        mode          = "guest",
        property_name = "Coorg",
        explicit_urls = [
            # Newly acquired March 2026 — 71 all-villa, 76 acres near Madikeri
            "https://www.theleela.com/the-leela-coorg-forest-sanctuary",
            "https://www.theleela.com/the-leela-coorg-forest-sanctuary/rooms-suites",
            "https://www.theleela.com/the-leela-coorg-forest-sanctuary/dining",
            "https://www.theleela.com/the-leela-coorg-forest-sanctuary/spa-wellness",
            "https://www.theleela.com/the-leela-coorg-forest-sanctuary/weddings",
            "https://www.theleela.com/the-leela-coorg-forest-sanctuary/location",
        ],
    ),

    # ══════════════════════════════════════════════════════════════════════
    #  TIER 1E — INVESTOR & PRESS
    # ══════════════════════════════════════════════════════════════════════

    IngestionSource(
        name          = "The Leela — Investor Relations",
        url           = "https://www.theleela.com/investors",
        source_type   = "official",
        mode          = "investor",
        property_name = None,
        explicit_urls = [
            "https://www.theleela.com/investors",
            "https://www.theleela.com/about-us",
            "https://www.theleela.com/awards-and-accolades",
            "https://www.theleela.com/sustainability",
            "https://www.theleela.com/environmental-stewardship",
            "https://www.theleela.com/heritage-and-communities",
        ],
    ),

    IngestionSource(
        name          = "The Leela — Press Room",
        url           = "https://www.theleela.com/press-room",
        source_type   = "official",
        mode          = "investor",
        property_name = None,
        max_pages     = 15,
        explicit_urls = [
            "https://www.theleela.com/press-room",
            # Key 2025–26 press releases confirmed from search
            "https://www.theleela.com/press-room/the-leela-palaces-hotels-and-resorts-acquires-ultra-luxury-resort-coorg-karnataka",
            "https://www.theleela.com/press-room/the-leela-palaces-hotels-and-resorts-expands-its-footprint-rajasthan-the-signing-of-the",
        ],
    ),

    # ══════════════════════════════════════════════════════════════════════
    #  TIER 2 — PRESS & PUBLICATIONS
    # ══════════════════════════════════════════════════════════════════════

    IngestionSource(
        name         = "Condé Nast Traveller India — Leela Coverage",
        url          = "https://www.cntraveller.in",
        source_type  = "press",
        mode         = "guest",
        max_pages    = 8,
        url_patterns = ["leela"],
    ),

    IngestionSource(
        name         = "Travel + Leisure India — Leela Coverage",
        url          = "https://www.tlindia.com",
        source_type  = "press",
        mode         = "guest",
        max_pages    = 8,
        url_patterns = ["leela"],
    ),

    # ══════════════════════════════════════════════════════════════════════
    #  TIER 3 — COMPETITIVE INTELLIGENCE
    #  source_type = "competitive" | mode = "internal"
    #  These chunks are ONLY shown in Internal Copilot mode — never to guests
    # ══════════════════════════════════════════════════════════════════════

    IngestionSource(
        name         = "Taj Hotels — Luxury Properties",
        url          = "https://www.tajhotels.com/en-in/",
        source_type  = "competitive",
        mode         = "internal",
        max_pages    = 12,
        url_patterns = ["palace", "hotel", "resort", "rooms", "dining", "spa"],
    ),

    IngestionSource(
        name         = "Oberoi Hotels — India Properties",
        url          = "https://www.oberoihotels.com/hotels-in-india/",
        source_type  = "competitive",
        mode         = "internal",
        max_pages    = 10,
        url_patterns = ["hotel", "rooms", "dining", "spa"],
    ),

    IngestionSource(
        name         = "ITC Hotels — Luxury Collection",
        url          = "https://www.itchotels.com/in/en",
        source_type  = "competitive",
        mode         = "internal",
        max_pages    = 10,
        url_patterns = ["luxury", "hotel", "rooms", "dining"],
    ),

    IngestionSource(
        name         = "Four Seasons India — Properties",
        url          = "https://www.fourseasons.com/india/",
        source_type  = "competitive",
        mode         = "internal",
        max_pages    = 8,
        url_patterns = ["hotel", "resort", "rooms", "dining", "spa"],
    ),

    IngestionSource(
        name         = "Aman India — Resorts",
        url          = "https://www.aman.com/destinations/india",
        source_type  = "competitive",
        mode         = "internal",
        max_pages    = 8,
        url_patterns = ["resort", "suite", "villa", "dining", "wellness"],
    ),
]


# ══════════════════════════════════════════════════════════════════════════
#  CONVENIENCE GROUPINGS — used by CLI and n8n automation
# ══════════════════════════════════════════════════════════════════════════

def get_sources_by_type(source_type: str) -> list[IngestionSource]:
    return [s for s in SOURCES if s.source_type == source_type]

def get_sources_by_property(property_name: str) -> list[IngestionSource]:
    return [s for s in SOURCES if s.property_name == property_name]

# Run order for a full ingestion pass:
# 1. official (brand + all 14 properties + press/IR) — ~120 URLs
# 2. press     (CNT + T+L)                           — ~16 URLs
# 3. competitive (Taj + Oberoi + ITC + FS + Aman)    — ~50 URLs
#
# Estimated clean chunks after quality filtering:
#   official:    ~280 chunks
#   press:       ~60 chunks
#   competitive: ~100 chunks
#   TOTAL:       ~440 high-quality chunks
#
# vs 4,973 junk chunks before — but answering 10x better.
