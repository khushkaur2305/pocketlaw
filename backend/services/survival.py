"""Interactive legal survival guides: listing, lookup and picking the right guide for a problem."""
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from rag.indexer import STOP_WORDS
from rag.synonyms import expand_query
from services import knowledge

GUIDE_MIN_SCORE = 0.08

_index = {"key": None, "vectorizer": None, "matrix": None, "guides": None}


def _guide_text(g: dict) -> str:
    parts = [g["title"], g["title"], g["summary"]]
    parts += [s["title"] + " " + s["detail"] for s in g["steps"]]
    parts += [r["right"] + " " + r["source"] for r in g["rights"]]
    return " ".join(parts)


def _guide_index():
    guides = knowledge.guides()
    if _index["guides"] is not guides:
        vec = TfidfVectorizer(stop_words=STOP_WORDS, ngram_range=(1, 2), sublinear_tf=True)
        _index.update(
            guides=guides,
            vectorizer=vec,
            matrix=vec.fit_transform([_guide_text(g) for g in guides]),
        )
    return _index


def summary(g: dict) -> dict:
    return {
        "id": g["id"],
        "title": g["title"],
        "icon": g.get("icon"),
        "summary": g["summary"],
        "urgent": g.get("urgent"),
        "categories": g["categories"],
        "helplines": g.get("helplines", []),
        "templates": g.get("templates", []),
    }


def list_guides():
    return [summary(g) for g in knowledge.guides()]


def get_guide(guide_id: str):
    for g in knowledge.guides():
        if g["id"] == guide_id:
            return g
    return None


def suggest(query: str, category_votes: dict, limit: int = 3):
    """Rank guides by text similarity to the query plus agreement with the matched law categories."""
    idx = _guide_index()
    qvec = idx["vectorizer"].transform([expand_query(query)])
    sims = cosine_similarity(qvec, idx["matrix"]).ravel()
    total_votes = sum(category_votes.values()) or 1.0
    ranked = []
    for g, sim in zip(idx["guides"], sims):
        share = sum(category_votes.get(c, 0.0) for c in g["categories"]) / total_votes
        ranked.append((float(sim) + 0.3 * share, g))
    ranked.sort(key=lambda p: -p[0])
    return [(round(s, 3), g) for s, g in ranked[:limit] if s >= GUIDE_MIN_SCORE]
