"""
LIP v2 — Sentiment Scorer
─────────────────────────────────────────────────────────────────────────────
Backfills the sentiment_score column for chunks where it is NULL.
Uses cardiffnlp/twitter-roberta-base-sentiment-latest — runs fully locally,
no API cost. Maps: positive=1.0, neutral=0.0, negative=-1.0

Usage:
  python sentiment_scorer.py                        # score everything NULL
  python sentiment_scorer.py --source-type competitive   # competitors first
  python sentiment_scorer.py --dry-run              # preview without writing

Why sentiment on hospitality content?
  Competitive chunks with negative sentiment (bad reviews, controversies)
  are surfaced differently in the Internal Copilot — useful signal for
  sales teams preparing competitive positioning.
─────────────────────────────────────────────────────────────────────────────
"""

from __future__ import annotations

import argparse
import logging
import sys
from collections import Counter

from dotenv import load_dotenv
load_dotenv()

import os
from langsmith import traceable
from supabase import create_client
from transformers import pipeline

from config import SUPABASE_TABLE, LANGSMITH_PROJECT

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(message)s",
    handlers=[logging.StreamHandler(sys.stdout), logging.FileHandler("ingestion.log")],
)
log = logging.getLogger("lip.sentiment")

os.environ.setdefault("LANGCHAIN_TRACING_V2", "true")
os.environ.setdefault("LANGCHAIN_PROJECT", LANGSMITH_PROJECT)

# Sentiment label → float mapping
LABEL_MAP = {
    "positive": 1.0,
    "neutral" : 0.0,
    "negative": -1.0,
    # cardiffnlp uses these label names
    "LABEL_2" : 1.0,   # positive
    "LABEL_1" : 0.0,   # neutral
    "LABEL_0" : -1.0,  # negative
}


def load_model():
    """
    Load cardiffnlp sentiment model locally.
    ~480MB download on first run, cached in ~/.cache/huggingface afterwards.
    truncation=True handles chunks longer than the model's 514-token limit.
    """
    log.info("Loading sentiment model (cardiffnlp/twitter-roberta-base-sentiment-latest)…")
    classifier = pipeline(
        task="sentiment-analysis",
        model="cardiffnlp/twitter-roberta-base-sentiment-latest",
        truncation=True,
        max_length=512,
        device=-1,          # CPU — no GPU needed for inference at this scale
    )
    log.info("Model loaded.")
    return classifier


@traceable(name="fetch_unscored_chunks")
def fetch_unscored(supabase, source_type: str | None, batch_size: int = 500) -> list[dict]:
    """Fetch rows where sentiment_score IS NULL, optionally filtered by source_type."""
    query = (
        supabase.table(SUPABASE_TABLE)
        .select("id, content, source_type")
        .is_("sentiment_score", "null")
        .limit(batch_size)
    )
    if source_type:
        query = query.eq("source_type", source_type)

    result = query.execute()
    return result.data or []


@traceable(name="score_and_update")
def score_batch(
    supabase,
    classifier,
    chunks: list[dict],
    dry_run: bool = False,
) -> Counter:
    """Score a batch of chunks and update Supabase. Returns label distribution."""
    texts = [c["content"][:1000] for c in chunks]  # truncate for speed
    distribution: Counter = Counter()

    try:
        predictions = classifier(texts, batch_size=32)
    except Exception as e:
        log.error(f"[SCORE] Model inference failed: {e}")
        return distribution

    updates = []
    for chunk, pred in zip(chunks, predictions):
        label = pred["label"].lower()
        score = LABEL_MAP.get(label, LABEL_MAP.get(pred["label"], 0.0))
        distribution[label] += 1
        updates.append({"id": chunk["id"], "sentiment_score": score})

    if dry_run:
        log.info(f"[DRY RUN] Would update {len(updates)} rows")
        return distribution

    # Update in sub-batches of 50
    for i in range(0, len(updates), 50):
        sub = updates[i:i + 50]
        try:
            supabase.table(SUPABASE_TABLE).upsert(sub, on_conflict="id").execute()
            log.info(f"[SCORE] Updated {len(sub)} rows")
        except Exception as e:
            log.error(f"[SCORE] Update failed: {e}")

    return distribution


@traceable(name="run_sentiment_pipeline")
def run(source_type: str | None, dry_run: bool, fetch_batch: int = 500):
    supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
    classifier = load_model()

    total_scored = 0
    total_distribution: Counter = Counter()
    round_num = 0

    while True:
        round_num += 1
        log.info(f"\n[SCORE] Fetching batch {round_num} (up to {fetch_batch} unscored rows)…")
        chunks = fetch_unscored(supabase, source_type, batch_size=fetch_batch)

        if not chunks:
            log.info("[SCORE] No more unscored chunks. Done.")
            break

        log.info(f"[SCORE] Scoring {len(chunks)} chunks…")
        dist = score_batch(supabase, classifier, chunks, dry_run=dry_run)
        total_distribution.update(dist)
        total_scored += len(chunks)

        if len(chunks) < fetch_batch:
            break   # last page

    # ── Final distribution report ─────────────────────────────────────────
    print(f"\n{'═' * 50}")
    print(f"  Sentiment Scoring Complete")
    print(f"{'─' * 50}")
    print(f"  Total chunks scored : {total_scored}")
    if total_scored > 0:
        for label, count in sorted(total_distribution.items()):
            pct = round(count / total_scored * 100, 1)
            bar = "█" * int(pct / 2)
            print(f"  {label:<12}: {count:>5} ({pct:>5}%) {bar}")
    print(f"{'═' * 50}\n")


def parse_args():
    p = argparse.ArgumentParser(description="LIP v2 — Sentiment Scorer")
    p.add_argument("--source-type", default=None,
                   choices=["official", "press", "competitive", "ugc"],
                   help="Score only this source type (default: all NULL rows)")
    p.add_argument("--dry-run", action="store_true",
                   help="Score but do not write to Supabase")
    p.add_argument("--batch-size", type=int, default=500,
                   help="Rows to fetch per round (default: 500)")
    return p.parse_args()


if __name__ == "__main__":
    args = parse_args()
    run(source_type=args.source_type, dry_run=args.dry_run, fetch_batch=args.batch_size)
