"""Query-time retrieval: expand the query, vectorise it, rank chunks by cosine similarity."""
import json
import logging
import os
import threading

import joblib
import numpy as np
from scipy import sparse
from sklearn.metrics.pairwise import cosine_similarity

import config
from rag import indexer
from rag.synonyms import expand_query

log = logging.getLogger(__name__)


class Retriever:
    def __init__(self, index_dir: str = config.INDEX_DIR):
        self.index_dir = index_dir
        if not indexer.index_is_fresh(index_dir):
            log.info("Index missing or stale - rebuilding")
            indexer.build_index(index_dir)
        self.matrix = sparse.load_npz(os.path.join(index_dir, indexer.MATRIX_FILE))
        self.vectorizer = joblib.load(os.path.join(index_dir, indexer.VECTORIZER_FILE))
        with open(os.path.join(index_dir, indexer.CHUNKS_FILE), encoding="utf-8") as fh:
            self.chunks = json.load(fh)
        self.manifest = indexer.read_manifest(index_dir)

    def search(self, query: str, top_k: int = 30):
        """Return [(chunk, score)] sorted by descending cosine similarity."""
        expanded = expand_query(query)
        qvec = self.vectorizer.transform([expanded])
        if qvec.nnz == 0:
            return []
        scores = cosine_similarity(qvec, self.matrix).ravel()
        top = np.argsort(-scores)[:top_k]
        return [(self.chunks[i], float(scores[i])) for i in top if scores[i] > 0]

    def query_terms(self, query: str, limit: int = 12):
        """The highest-weighted vocabulary terms of the expanded query (for explainability)."""
        qvec = self.vectorizer.transform([expand_query(query)])
        names = self.vectorizer.get_feature_names_out()
        pairs = sorted(zip(qvec.indices, qvec.data), key=lambda p: -p[1])[:limit]
        return [names[i] for i, _ in pairs]


_instance = None
_lock = threading.Lock()


def get_retriever() -> Retriever:
    global _instance
    with _lock:
        if _instance is None or not indexer.index_is_fresh(_instance.index_dir):
            _instance = Retriever()
        return _instance
