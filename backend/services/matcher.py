"""AI Law Matcher: turn a plain-language problem into relevant laws, judgments, guidance and documents."""
from collections import defaultdict

import config
from rag.retriever import get_retriever
from services import knowledge, survival
from services.drafting import template_summaries

EXAMPLES = [
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
]


def _confidence(best: float) -> str:
    if best >= config.STRONG_SCORE:
        return "high"
    if best >= config.MEDIUM_SCORE:
        return "medium"
    if best >= config.MIN_SCORE:
        return "low"
    return "none"


def _matched_terms(terms, text: str, limit: int = 5):
    low = text.lower()
    return [t for t in terms if t in low][:limit]


def _law_view(law: dict, score: float, best: float, terms, chunk_text: str) -> dict:
    return {
        "id": law["id"],
        "act": law["act"],
        "short_act": law.get("short_act"),
        "ref": law["ref"],
        "title": law["title"],
        "category": law["category"],
        "category_label": knowledge.category_label(law["category"]),
        "text": law["text"],
        "punishment": law.get("punishment"),
        "old_equivalent": law.get("old_equivalent"),
        "score": round(score, 4),
        "relevance": round(100 * score / best) if best else 0,
        "matched_terms": _matched_terms(terms, chunk_text),
    }


def _judgment_view(j: dict, score: float) -> dict:
    return {
        "id": j["id"],
        "name": j["name"],
        "citation": j["citation"],
        "year": j["year"],
        "principle": j["principle"],
        "summary": j["summary"],
        "score": round(score, 4),
    }


def citation_line(law: dict) -> str:
    return f"{law['ref']}, {law['act']} ({law['title']})"


def match(query: str, top_k: int = config.TOP_K) -> dict:
    retriever = get_retriever()
    hits = retriever.search(query, top_k=40)
    terms = retriever.query_terms(query)
    laws_by_id = knowledge.law_by_id()
    judgments_by_id = knowledge.judgment_by_id()

    law_hits, judgment_scores, documents = [], {}, []
    for chunk, score in hits:
        if score < config.MIN_SCORE:
            break
        kind = chunk["type"]
        if kind == "law" and chunk["ref_id"] in laws_by_id and len(law_hits) < top_k:
            law_hits.append((laws_by_id[chunk["ref_id"]], score, chunk["text"]))
        elif kind == "judgment" and chunk["ref_id"] in judgments_by_id:
            judgment_scores[chunk["ref_id"]] = score
        elif kind == "pdf" and len(documents) < 3:
            documents.append({
                "source": chunk.get("source", chunk["ref_id"]),
                "excerpt": chunk["text"][:600],
                "score": round(score, 4),
            })

    best_law = law_hits[0][1] if law_hits else 0.0
    # Drop the long tail: provisions scoring far below the best match are usually noise.
    law_hits = [h for h in law_hits if h[1] >= config.RELATIVE_CUTOFF * best_law]
    best = max([best_law] + list(judgment_scores.values()))
    confidence = _confidence(best)
    laws = [_law_view(law, s, best_law, terms, text) for law, s, text in law_hits]

    # Judgments: direct hits plus those linked from the top provisions.
    for law, s, _ in law_hits[:4]:
        for jid in law.get("related_judgments", []):
            if jid in judgments_by_id:
                judgment_scores[jid] = max(judgment_scores.get(jid, 0.0), s * 0.8)
    top_judgments = sorted(judgment_scores.items(), key=lambda p: -p[1])[:4]
    judgments = [_judgment_view(judgments_by_id[jid], s) for jid, s in top_judgments]

    votes = defaultdict(float)
    for law, s, _ in law_hits:
        votes[law["category"]] += s
    for jid, s in judgment_scores.items():
        votes[judgments_by_id[jid]["category"]] += 0.5 * s
    categories = sorted(votes.items(), key=lambda p: -p[1])
    primary = categories[0][0] if categories else None

    guides = survival.suggest(query, votes) if confidence != "none" else []
    guide = guides[0][1] if guides else None

    templates = []
    if confidence != "none":
        all_templates = {t["id"]: t for t in template_summaries()}
        wanted = list(guide.get("templates", [])) if guide else []
        for t in all_templates.values():
            if primary in t["categories"] and t["id"] not in wanted:
                wanted.append(t["id"])
        templates = [all_templates[t] for t in wanted if t in all_templates][:3]

    return {
        "query": query,
        "confidence": confidence,
        "strong_match": confidence in ("high", "medium"),
        "best_score": round(best, 4),
        "understood_as": terms,
        "primary_category": primary,
        "primary_category_label": knowledge.category_label(primary) if primary else None,
        "categories": [
            {"key": k, "label": knowledge.category_label(k), "weight": round(v, 4)} for k, v in categories[:5]
        ],
        "explanation": _explain(confidence, primary, laws, guide),
        "laws": laws if confidence != "none" else [],
        "judgments": judgments if confidence != "none" else [],
        "documents": documents,
        "guide": survival.summary(guide) if guide else None,
        "other_guides": [survival.summary(g) for s, g in guides[1:] if s >= 0.6 * guides[0][0]],
        "templates": templates,
        "legal_provisions_text": "; ".join(citation_line(laws_by_id[l["id"]]) for l in laws[:3]),
        "disclaimer": config.DISCLAIMER,
    }


def _explain(confidence: str, primary, laws, guide) -> str:
    if confidence == "none" or not laws:
        return (
            "We could not find a provision in our knowledge base that clearly matches your description. "
            "Try describing who did what, when and where (for example, 'my landlord changed the locks while I was away'), "
            "or use the web search below. For urgent help, call 112, or 15100 for free legal aid."
        )
    names = [f"{l['ref']} of the {l['short_act'] or l['act']} ({l['title'].lower()})" for l in laws[:2]]
    text = (
        f"Your situation appears to relate to {knowledge.category_label(primary).lower()}. "
        f"The most relevant provision{'s are' if len(names) > 1 else ' is'} {' and '.join(names)}."
    )
    if guide:
        text += f" The step-by-step guide \"{guide['title']}\" explains what to do next and who to contact."
    if confidence == "low":
        text += " The match is weak, so please read the provisions carefully or rephrase your problem with more detail."
    return text
