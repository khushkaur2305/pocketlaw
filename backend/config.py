"""Central configuration for the PocketLaw backend."""
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
PDF_DIR = os.path.join(DATA_DIR, "pdfs")
TEMPLATE_DIR = os.path.join(DATA_DIR, "templates")
INDEX_DIR = os.path.join(BASE_DIR, "index")

# RAG / TF-IDF settings
MAX_FEATURES = 15000
CHUNK_WORDS = 200          # words per chunk for long PDF text
CHUNK_OVERLAP = 50         # overlapping words between consecutive chunks
TOP_K = 6                  # provisions returned to the user
MIN_SCORE = 0.05           # below this cosine score a hit is treated as noise
STRONG_SCORE = 0.20        # at or above this the match is "high confidence"
MEDIUM_SCORE = 0.10
RELATIVE_CUTOFF = 0.3      # provisions below 30% of the top score are dropped

DISCLAIMER = (
    "PocketLaw provides general legal information for educational and reference "
    "purposes only. It is not a substitute for advice from a qualified advocate. "
    "Laws change and their application depends on the facts of each case."
)

PORT = int(os.environ.get("POCKETLAW_PORT", "5000"))

# Comma-separated list of frontend origins allowed to call the API, e.g. "https://pocketlaw.vercel.app".
_origins = os.environ.get("ALLOWED_ORIGINS", "*").strip()
ALLOWED_ORIGINS = "*" if _origins in ("", "*") else [o.strip() for o in _origins.split(",") if o.strip()]
