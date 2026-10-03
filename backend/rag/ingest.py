"""Load the knowledge base (seed JSON + optional PDFs) and split it into chunks.

Every chunk is a dict:
    {"id": str, "type": "law" | "judgment" | "pdf", "ref_id": str, "text": str, ...}
"""
import json
import logging
import os
import re

import config

log = logging.getLogger(__name__)


def load_json(name: str):
    with open(os.path.join(config.DATA_DIR, name), encoding="utf-8") as fh:
        return json.load(fh)


def chunk_words(text: str, size: int = config.CHUNK_WORDS, overlap: int = config.CHUNK_OVERLAP):
    """Split text into overlapping windows of `size` words."""
    words = text.split()
    if not words:
        return []
    if len(words) <= size:
        return [" ".join(words)]
    step = max(1, size - overlap)
    chunks = []
    for start in range(0, len(words), step):
        window = words[start:start + size]
        if len(window) < overlap and chunks:
            break  # tail already covered by the previous window's overlap
        chunks.append(" ".join(window))
    return chunks


def law_text(law: dict) -> str:
    # Title and keywords are repeated so they weigh more than the explanatory text.
    keywords = " ".join(law.get("keywords", []))
    parts = [
        law["act"],
        law.get("short_act", ""),
        law["ref"],
        law["title"], law["title"],
        law["text"],
        law.get("punishment", ""),
        keywords, keywords,
        law.get("old_equivalent", ""),
    ]
    return " ".join(p for p in parts if p)


def judgment_text(j: dict) -> str:
    keywords = " ".join(j.get("keywords", []))
    return " ".join([j["name"], j["summary"], keywords, keywords])


def law_chunks(laws):
    return [
        {"id": f"law:{law['id']}", "type": "law", "ref_id": law["id"], "text": law_text(law)}
        for law in laws
    ]


def judgment_chunks(judgments):
    return [
        {"id": f"judgment:{j['id']}", "type": "judgment", "ref_id": j["id"], "text": judgment_text(j)}
        for j in judgments
    ]


def extract_pdf_text(path: str) -> str:
    """Extract text with pdfplumber, falling back to pypdf if that fails or finds nothing."""
    text = ""
    try:
        import pdfplumber

        with pdfplumber.open(path) as pdf:
            text = "\n".join((page.extract_text() or "") for page in pdf.pages)
    except Exception as exc:  # pragma: no cover - depends on the PDF
        log.warning("pdfplumber failed on %s: %s", path, exc)
    if not text.strip():
        try:
            from pypdf import PdfReader

            reader = PdfReader(path)
            text = "\n".join((page.extract_text() or "") for page in reader.pages)
        except Exception as exc:  # pragma: no cover
            log.warning("pypdf failed on %s: %s", path, exc)
    return re.sub(r"\s+", " ", text).strip()


def pdf_files(pdf_dir: str = config.PDF_DIR):
    if not os.path.isdir(pdf_dir):
        return []
    return sorted(
        os.path.join(pdf_dir, f) for f in os.listdir(pdf_dir) if f.lower().endswith(".pdf")
    )


def pdf_chunks(pdf_dir: str = config.PDF_DIR):
    chunks = []
    for path in pdf_files(pdf_dir):
        name = os.path.basename(path)
        text = extract_pdf_text(path)
        if not text:
            log.warning("No extractable text in %s (scanned PDF?) - skipped", name)
            continue
        for i, piece in enumerate(chunk_words(text)):
            chunks.append({
                "id": f"pdf:{name}:{i}",
                "type": "pdf",
                "ref_id": name,
                "source": os.path.splitext(name)[0].replace("_", " "),
                "chunk_no": i,
                "text": piece,
            })
    return chunks


def collect_chunks():
    return (
        law_chunks(load_json("laws.json"))
        + judgment_chunks(load_json("judgments.json"))
        + pdf_chunks()
    )
