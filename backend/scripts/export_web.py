"""Export the knowledge base and the fitted TF-IDF index as static JSON for the browser app.

The deployed site (Vercel) has no Python: the browser loads these files and runs the same
query expansion, TF-IDF weighting and cosine similarity in JavaScript.

Usage:  python scripts/export_web.py [output_dir]
        (default output_dir: ../frontend/public/data)

Run it after editing anything in backend/data/ and commit the regenerated files.
"""
import json
import os
import sys

BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND)

import config  # noqa: E402
from rag import indexer  # noqa: E402
from rag.synonyms import CONTRACTIONS, SYNONYM_GROUPS, expand_query  # noqa: E402
from services import knowledge, survival  # noqa: E402
from services.drafting import load_templates  # noqa: E402
from services.matcher import EXAMPLES, match  # noqa: E402

DEFAULT_OUT = os.path.join(os.path.dirname(BACKEND), "frontend", "public", "data")
DECIMALS = 6

# Queries whose Python results the JavaScript tests must reproduce.
PARITY_QUERIES = [
    "My employer has not paid my salary for the last three months",
    "Police are refusing to register my FIR for a stolen phone",
    "My husband beats me and his mother keeps demanding dowry",
    "I bought a phone online, it is defective and the seller refuses a refund",
    "Someone called pretending to be from my bank and took money through UPI",
    "The cheque my friend gave me for the loan has bounced",
    "My landlord is not returning my security deposit",
    "My manager touches me inappropriately at the office",
    "I was hit by a car and the driver ran away",
    "My son took my house and does not take care of me",
    "Police arrested my brother last night and are not telling us why",
    "I want to know the status of my pension file in the government office",
    "Upper caste neighbours insulted me using my caste name in public",
    "what is the weather like today",
]


def vectorizer_settings(vec) -> dict:
    return {
        "lowercase": vec.lowercase,
        "strip_accents": vec.strip_accents == "unicode",
        "ngram_range": list(vec.ngram_range),
        "sublinear_tf": vec.sublinear_tf,
        "stop_words": sorted(vec.stop_words),
    }


def export_matrix(vec, matrix, docs) -> dict:
    csr = matrix.tocsr()
    csr.sort_indices()
    vocab = [None] * len(vec.vocabulary_)
    for term, col in vec.vocabulary_.items():
        vocab[col] = term
    return {
        "settings": vectorizer_settings(vec),
        "vocab": vocab,
        "idf": [round(float(x), DECIMALS) for x in vec.idf_],
        "docs": docs,
        "indptr": csr.indptr.tolist(),
        "indices": csr.indices.tolist(),
        "data": [round(float(x), DECIMALS) for x in csr.data],
    }


def stable_manifest(manifest: dict) -> dict:
    # Drop timestamps so re-exporting unchanged data produces identical files.
    return {k: manifest[k] for k in ("num_chunks", "num_features", "chunks_by_type", "pdf_files")}


def build_exports() -> dict:
    """Return {filename: python object} for everything the browser needs."""
    from rag.retriever import Retriever

    retriever = Retriever()  # rebuilds the index if data changed
    manifest = stable_manifest(retriever.manifest)
    docs = [{"id": c["id"], "type": c["type"], "ref_id": c["ref_id"],
             **({"source": c.get("source"), "text": c["text"][:600]} if c["type"] == "pdf" else {})}
            for c in retriever.chunks]
    index = export_matrix(retriever.vectorizer, retriever.matrix, docs)
    index["manifest"] = manifest

    gidx = survival._guide_index()
    guide_index = export_matrix(gidx["vectorizer"], gidx["matrix"], [{"id": g["id"]} for g in gidx["guides"]])

    laws = knowledge.laws()
    judgments = knowledge.judgments()
    guides = knowledge.guides()
    templates = list(load_templates().values())

    from collections import Counter

    by_category = Counter(law["category"] for law in laws)
    by_act = Counter(law.get("short_act") or law["act"] for law in laws)
    by_decade = Counter(f"{(j['year'] // 10) * 10}s" for j in judgments)
    stats = {
        "counts": {
            "provisions": len(laws),
            "acts": len({law["act"] for law in laws}),
            "judgments": len(judgments),
            "guides": len(guides),
            "templates": len(templates),
            "chunks": manifest["num_chunks"],
            "features": manifest["num_features"],
            "pdf_files": manifest["pdf_files"],
        },
        "index": manifest,
        "by_category": [{"key": k, "label": knowledge.category_label(k), "count": v} for k, v in by_category.most_common()],
        "by_act": [{"act": k, "count": v} for k, v in by_act.most_common()],
        "judgments_by_decade": [{"decade": k, "count": by_decade[k]} for k in sorted(by_decade)],
    }

    settings = {
        "MIN_SCORE": config.MIN_SCORE,
        "MEDIUM_SCORE": config.MEDIUM_SCORE,
        "STRONG_SCORE": config.STRONG_SCORE,
        "RELATIVE_CUTOFF": config.RELATIVE_CUTOFF,
        "TOP_K": config.TOP_K,
        "GUIDE_MIN_SCORE": survival.GUIDE_MIN_SCORE,
        "DISCLAIMER": config.DISCLAIMER,
        "CATEGORY_LABELS": knowledge.CATEGORY_LABELS,
    }

    parity = []
    for q in PARITY_QUERIES:
        expanded = expand_query(q)
        qvec = retriever.vectorizer.transform([expanded])
        names = retriever.vectorizer.get_feature_names_out()
        result = match(q)
        parity.append({
            "query": q,
            "expanded": expanded,
            "weights": {names[i]: round(float(w), DECIMALS) for i, w in zip(qvec.indices, qvec.data)},
            "top_laws": [law["id"] for law in result["laws"][:3]],
            "guide": result["guide"]["id"] if result["guide"] else None,
            "confidence": result["confidence"],
        })

    return {
        "index.json": index,
        "guide_index.json": guide_index,
        "synonyms.json": {"contractions": CONTRACTIONS, "groups": [[t, e] for t, e in SYNONYM_GROUPS]},
        "laws.json": laws,
        "judgments.json": judgments,
        "guides.json": guides,
        "templates.json": templates,
        "stats.json": stats,
        "config.json": settings,
        "examples.json": EXAMPLES,
        "parity.json": parity,
    }


def write_exports(out_dir: str) -> list:
    os.makedirs(out_dir, exist_ok=True)
    written = []
    for name, obj in build_exports().items():
        path = os.path.join(out_dir, name)
        compact = name in ("index.json", "guide_index.json")
        with open(path, "w", encoding="utf-8", newline="\n") as fh:
            if compact:
                json.dump(obj, fh, ensure_ascii=False, separators=(",", ":"))
            else:
                json.dump(obj, fh, ensure_ascii=False, indent=1)
            fh.write("\n")
        written.append((name, os.path.getsize(path)))
    return written


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_OUT
    for name, size in write_exports(target):
        print(f"{name:20s} {size / 1024:8.1f} KB")
    print(f"-> {os.path.abspath(target)}")
