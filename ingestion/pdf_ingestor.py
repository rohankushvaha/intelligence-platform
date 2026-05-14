"""
LIP v2 — PDF Ingestor
─────────────────────────────────────────────────────────────────────────────
Ingests local PDF files (annual reports, press kits, investor decks) into
the same Supabase documents table as the web crawler pipeline.

Usage:
  python pdf_ingestor.py --path ./pdfs/
  python pdf_ingestor.py --path ./reports/leela_annual_2024.pdf \
    --source-type official --mode investor --source-name "Leela Annual Report 2024"

Requirements: pip install pypdf sentence-transformers supabase python-dotenv langsmith
─────────────────────────────────────────────────────────────────────────────
"""

from __future__ import annotations

import argparse
import hashlib
import logging
import sys
from pathlib import Path
from datetime import datetime, timezone

from dotenv import load_dotenv
load_dotenv()

import os
from langsmith import traceable
from pypdf import PdfReader
from sentence_transformers import SentenceTransformer
from supabase import create_client
from langchain.text_splitter import RecursiveCharacterTextSplitter

from config import (
    SUPABASE_TABLE, CHUNK_SIZE, CHUNK_OVERLAP,
    LANGSMITH_PROJECT, SourceType, Mode
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(message)s",
    handlers=[logging.StreamHandler(sys.stdout), logging.FileHandler("ingestion.log")],
)
log = logging.getLogger("lip.pdf")

os.environ.setdefault("LANGCHAIN_TRACING_V2", "true")
os.environ.setdefault("LANGCHAIN_PROJECT", LANGSMITH_PROJECT)

_splitter = RecursiveCharacterTextSplitter(
    chunk_size=CHUNK_SIZE,
    chunk_overlap=CHUNK_OVERLAP,
    separators=["\n\n", "\n", ". ", " ", ""],
)


def _stable_id(file_path: str, page: int, chunk_idx: int) -> str:
    raw = f"pdf::{file_path}::p{page}::c{chunk_idx}"
    return hashlib.sha256(raw.encode()).hexdigest()[:36]


@traceable(name="extract_pdf")
def extract_pdf(path: Path) -> list[dict]:
    """
    Extract text from each page of a PDF.
    Returns list of {page_number, text} dicts.
    Multi-column layouts are handled by extracting page-by-page —
    pypdf reads the raw content stream which is column-agnostic.
    """
    log.info(f"[PDF] Reading: {path.name}")
    reader = PdfReader(str(path))
    pages = []
    for i, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        text = text.strip()
        if len(text) > 50:          # skip near-empty/image-only pages
            pages.append({"page_number": i + 1, "text": text})
        else:
            log.debug(f"[PDF] Page {i+1} skipped (too short)")
    log.info(f"[PDF] {path.name} → {len(pages)} usable pages")
    return pages


def chunk_pdf_pages(
    pages: list[dict],
    path: Path,
    source_name: str,
    source_type: SourceType,
    mode: Mode,
    property_name: str | None,
) -> list[dict]:
    """
    Chunk extracted PDF text.
    chunk_index encoding: page_number * 100 + chunk_within_page
    This preserves page provenance when inspecting chunks in Supabase.
    """
    chunks = []
    for page in pages:
        page_chunks = _splitter.split_text(page["text"])
        for idx, text in enumerate(page_chunks):
            chunk_index = page["page_number"] * 100 + idx
            chunks.append({
                "id"           : _stable_id(str(path), page["page_number"], idx),
                "content"      : text,
                "source_name"  : source_name,
                "source_url"   : f"file://{path.resolve()}#page={page['page_number']}",
                "source_type"  : source_type,
                "mode"         : mode,
                "property_name": property_name,
                "chunk_index"  : chunk_index,
            })
    return chunks


def embed_chunks(chunks: list[dict], model: SentenceTransformer) -> list[dict]:
    texts = [c["content"] for c in chunks]
    vectors = model.encode(texts, batch_size=32, show_progress_bar=True).tolist()
    for chunk, vec in zip(chunks, vectors):
        chunk["embedding"] = vec
    return chunks


@traceable(name="upsert_pdf_chunks")
def upsert_chunks(supabase, chunks: list[dict]) -> int:
    now = datetime.now(timezone.utc).isoformat()
    upserted = 0
    for i in range(0, len(chunks), 50):
        batch = chunks[i:i + 50]
        rows = [{
            "id"            : c["id"],
            "content"       : c["content"],
            "embedding"     : c["embedding"],
            "source_name"   : c["source_name"],
            "source_url"    : c["source_url"],
            "source_type"   : c["source_type"],
            "mode"          : c["mode"],
            "property_name" : c.get("property_name"),
            "chunk_index"   : c["chunk_index"],
            "updated_at"    : now,
        } for c in batch]
        try:
            supabase.table(SUPABASE_TABLE).upsert(rows, on_conflict="id").execute()
            upserted += len(batch)
            log.info(f"[UPSERT] Batch {i // 50 + 1}: {len(batch)} rows")
        except Exception as e:
            log.error(f"[UPSERT] Batch failed: {e}")
    return upserted


@traceable(name="ingest_pdf_pipeline")
def ingest_pdf(
    path: Path,
    source_name: str,
    source_type: SourceType,
    mode: Mode,
    property_name: str | None,
    model: SentenceTransformer,
    supabase,
    dry_run: bool = False,
) -> dict:
    pages = extract_pdf(path)
    chunks = chunk_pdf_pages(pages, path, source_name, source_type, mode, property_name)
    log.info(f"[PDF] {path.name} → {len(chunks)} chunks from {len(pages)} pages")

    if dry_run:
        log.info("[DRY RUN] Skipping embed + upsert")
        return {"file": path.name, "pages": len(pages), "chunks": len(chunks), "upserted": 0}

    chunks = embed_chunks(chunks, model)
    upserted = upsert_chunks(supabase, chunks)
    return {"file": path.name, "pages": len(pages), "chunks": len(chunks), "upserted": upserted}


def parse_args():
    p = argparse.ArgumentParser(description="LIP v2 — PDF Ingestor")
    p.add_argument("--path", required=True, help="Path to a PDF file or folder of PDFs")
    p.add_argument("--source-type", default="official",
                   choices=["official", "press", "competitive", "ugc"])
    p.add_argument("--mode", default="investor",
                   choices=["concierge", "investor", "internal"])
    p.add_argument("--source-name", default=None,
                   help="Override source_name (defaults to filename)")
    p.add_argument("--property-name", default=None)
    p.add_argument("--dry-run", action="store_true")
    return p.parse_args()


def main():
    args = parse_args()
    target = Path(args.path)

    pdf_files = [target] if target.is_file() else sorted(target.glob("**/*.pdf"))
    if not pdf_files:
        log.error(f"No PDFs found at: {target}")
        sys.exit(1)

    log.info(f"Found {len(pdf_files)} PDF(s) to ingest")

    supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
    model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

    results = []
    for pdf in pdf_files:
        name = args.source_name or pdf.stem.replace("_", " ").replace("-", " ").title()
        result = ingest_pdf(
            path=pdf, source_name=name,
            source_type=args.source_type, mode=args.mode,
            property_name=args.property_name,
            model=model, supabase=supabase, dry_run=args.dry_run,
        )
        results.append(result)
        print(f"\n  ✓ {result['file']}: {result['pages']} pages → {result['chunks']} chunks → {result['upserted']} upserted")

    total_upserted = sum(r["upserted"] for r in results)
    print(f"\n{'─'*50}")
    print(f"  Total files : {len(results)}")
    print(f"  Total chunks: {sum(r['chunks'] for r in results)}")
    print(f"  Total upserted: {total_upserted}")
    print(f"{'─'*50}\n")


if __name__ == "__main__":
    main()
