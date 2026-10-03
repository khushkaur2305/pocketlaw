Drop Supreme Court judgment or Act PDFs (text-based, not scanned images) into this folder.

They are extracted with pdfplumber (falling back to pypdf), split into overlapping
200-word chunks, and added to the TF-IDF index automatically the next time the
backend starts. To rebuild manually:

    python scripts/build_index.py
