"""Build and persist the TF-IDF index (SciPy sparse matrix + fitted vectorizer)."""
import hashlib
import json
import os
import time

import joblib
from scipy import sparse
from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS, TfidfVectorizer

import config
from rag import ingest

# Words that appear in nearly every provision and carry no signal for matching.
LEGAL_STOPWORDS = {
    "section", "act", "shall", "may", "whoever", "provided", "said", "thereof",
    "herein", "hereby", "wherein", "therein", "such", "person", "persons",
}
STOP_WORDS = sorted(ENGLISH_STOP_WORDS.union(LEGAL_STOPWORDS) - {"not", "no"})

MATRIX_FILE = "tfidf_matrix.npz"
VECTORIZER_FILE = "vectorizer.joblib"
CHUNKS_FILE = "chunks.json"
MANIFEST_FILE = "manifest.json"


def data_signature() -> str:
    """Fingerprint of every source file, so the index rebuilds when data changes."""
    paths = [os.path.join(config.DATA_DIR, n) for n in ("laws.json", "judgments.json")]
    paths += ingest.pdf_files()
    h = hashlib.sha1()
    for p in paths:
        st = os.stat(p)
        h.update(f"{os.path.basename(p)}:{st.st_size}:{int(st.st_mtime)}".encode())
    return h.hexdigest()


def make_vectorizer() -> TfidfVectorizer:
    return TfidfVectorizer(
        lowercase=True,
        strip_accents="unicode",
        stop_words=STOP_WORDS,
        ngram_range=(1, 2),
        sublinear_tf=True,
        max_features=config.MAX_FEATURES,
        min_df=1,
    )


def build_index(index_dir: str = config.INDEX_DIR) -> dict:
    started = time.time()
    chunks = ingest.collect_chunks()
    vectorizer = make_vectorizer()
    matrix = vectorizer.fit_transform([c["text"] for c in chunks])

    os.makedirs(index_dir, exist_ok=True)
    sparse.save_npz(os.path.join(index_dir, MATRIX_FILE), matrix.tocsr())
    joblib.dump(vectorizer, os.path.join(index_dir, VECTORIZER_FILE))
    with open(os.path.join(index_dir, CHUNKS_FILE), "w", encoding="utf-8") as fh:
        json.dump(chunks, fh, ensure_ascii=False)

    counts = {}
    for c in chunks:
        counts[c["type"]] = counts.get(c["type"], 0) + 1
    manifest = {
        "built_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "signature": data_signature(),
        "num_chunks": matrix.shape[0],
        "num_features": matrix.shape[1],
        "chunks_by_type": counts,
        "pdf_files": len(ingest.pdf_files()),
        "build_seconds": round(time.time() - started, 2),
    }
    with open(os.path.join(index_dir, MANIFEST_FILE), "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=2)
    return manifest


def read_manifest(index_dir: str = config.INDEX_DIR):
    path = os.path.join(index_dir, MANIFEST_FILE)
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def index_is_fresh(index_dir: str = config.INDEX_DIR) -> bool:
    manifest = read_manifest(index_dir)
    if not manifest:
        return False
    needed = (MATRIX_FILE, VECTORIZER_FILE, CHUNKS_FILE)
    if not all(os.path.exists(os.path.join(index_dir, f)) for f in needed):
        return False
    return manifest.get("signature") == data_signature()
