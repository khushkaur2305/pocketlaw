"""Rebuild the TF-IDF index from data/*.json and any PDFs in data/pdfs/.

Usage:  python scripts/build_index.py
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from rag.indexer import build_index  # noqa: E402

if __name__ == "__main__":
    manifest = build_index()
    print(json.dumps(manifest, indent=2))
