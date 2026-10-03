from collections import Counter

from flask import Blueprint, jsonify

from rag.retriever import get_retriever
from services import knowledge, survival
from services.drafting import template_summaries

bp = Blueprint("stats", __name__)


@bp.get("/stats")
def stats():
    laws = knowledge.laws()
    judgments = knowledge.judgments()
    manifest = get_retriever().manifest or {}

    by_category = Counter(law["category"] for law in laws)
    by_act = Counter(law.get("short_act") or law["act"] for law in laws)
    by_decade = Counter(f"{(j['year'] // 10) * 10}s" for j in judgments)

    return jsonify({
        "counts": {
            "provisions": len(laws),
            "acts": len({law["act"] for law in laws}),
            "judgments": len(judgments),
            "guides": len(survival.list_guides()),
            "templates": len(template_summaries()),
            "chunks": manifest.get("num_chunks"),
            "features": manifest.get("num_features"),
            "pdf_files": manifest.get("pdf_files", 0),
        },
        "index": manifest,
        "by_category": [
            {"key": k, "label": knowledge.category_label(k), "count": v} for k, v in by_category.most_common()
        ],
        "by_act": [{"act": k, "count": v} for k, v in by_act.most_common()],
        "judgments_by_decade": [{"decade": k, "count": by_decade[k]} for k in sorted(by_decade)],
    })
