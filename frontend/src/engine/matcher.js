// Port of backend/services/matcher.py and services/survival.py::suggest.
// `kb` is the knowledge base assembled in kb.js (indexes, laws, judgments, guides, templates, config).

export function categoryLabel(kb, key) {
  if (!key) return null;
  return kb.config.CATEGORY_LABELS[key] || key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Same composition as backend/rag/ingest.py::law_text, used to explain which terms matched.
function lawText(law) {
  const keywords = (law.keywords || []).join(" ");
  return [law.act, law.short_act || "", law.ref, law.title, law.title, law.text, law.punishment || "",
    keywords, keywords, law.old_equivalent || ""].filter(Boolean).join(" ");
}

function confidence(cfg, best) {
  if (best >= cfg.STRONG_SCORE) return "high";
  if (best >= cfg.MEDIUM_SCORE) return "medium";
  if (best >= cfg.MIN_SCORE) return "low";
  return "none";
}

const round = (x, d) => Math.round(x * 10 ** d) / 10 ** d;

export function guideSummary(g) {
  return {
    id: g.id,
    title: g.title,
    icon: g.icon,
    summary: g.summary,
    urgent: g.urgent ?? null,
    categories: g.categories,
    helplines: g.helplines || [],
    templates: g.templates || [],
  };
}

export function templateSummary(t) {
  const { id, title, description, forum, law, categories } = t;
  return { id, title, description, forum, law, categories };
}

export function suggestGuides(kb, query, votes, limit = 3) {
  const qvec = kb.guideIndex.transform(kb.expander.expand(query));
  const sims = kb.guideIndex.scores(qvec);
  let total = 0;
  for (const v of votes.values()) total += v;
  total = total || 1;
  const ranked = kb.guides.map((g, i) => {
    const share = g.categories.reduce((s, c) => s + (votes.get(c) || 0), 0) / total;
    return [sims[i] + 0.3 * share, g];
  });
  ranked.sort((a, b) => b[0] - a[0]);
  return ranked
    .slice(0, limit)
    .filter(([s]) => s >= kb.config.GUIDE_MIN_SCORE)
    .map(([s, g]) => [round(s, 3), g]);
}

export function match(kb, query, topK = kb.config.TOP_K) {
  const cfg = kb.config;
  const qvec = kb.index.transform(kb.expander.expand(query));
  const hits = kb.index.search(qvec, 40);
  const terms = kb.index.topTerms(qvec);

  const lawHits = [];
  const judgmentScores = new Map();
  const documents = [];
  for (const { doc, score } of hits) {
    if (score < cfg.MIN_SCORE) break;
    if (doc.type === "law" && kb.lawById.has(doc.ref_id) && lawHits.length < topK) {
      lawHits.push([kb.lawById.get(doc.ref_id), score]);
    } else if (doc.type === "judgment" && kb.judgmentById.has(doc.ref_id)) {
      judgmentScores.set(doc.ref_id, score);
    } else if (doc.type === "pdf" && documents.length < 3) {
      documents.push({ source: doc.source || doc.ref_id, excerpt: (doc.text || "").slice(0, 600), score: round(score, 4) });
    }
  }

  const bestLaw = lawHits.length ? lawHits[0][1] : 0;
  const keptLaws = lawHits.filter(([, s]) => s >= cfg.RELATIVE_CUTOFF * bestLaw);
  const best = Math.max(bestLaw, ...judgmentScores.values());
  const conf = confidence(cfg, best);

  const laws = keptLaws.map(([law, s]) => {
    const low = lawText(law).toLowerCase();
    return {
      id: law.id,
      act: law.act,
      short_act: law.short_act ?? null,
      ref: law.ref,
      title: law.title,
      category: law.category,
      category_label: categoryLabel(kb, law.category),
      text: law.text,
      punishment: law.punishment ?? null,
      old_equivalent: law.old_equivalent ?? null,
      score: round(s, 4),
      relevance: bestLaw ? Math.round((100 * s) / bestLaw) : 0,
      matched_terms: terms.filter((t) => low.includes(t)).slice(0, 5),
    };
  });

  for (const [law, s] of keptLaws.slice(0, 4)) {
    for (const jid of law.related_judgments || []) {
      if (kb.judgmentById.has(jid)) judgmentScores.set(jid, Math.max(judgmentScores.get(jid) || 0, s * 0.8));
    }
  }
  const judgments = [...judgmentScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([jid, s]) => {
      const j = kb.judgmentById.get(jid);
      return { id: j.id, name: j.name, citation: j.citation, year: j.year, principle: j.principle, summary: j.summary, score: round(s, 4) };
    });

  const votes = new Map();
  for (const [law, s] of keptLaws) votes.set(law.category, (votes.get(law.category) || 0) + s);
  for (const [jid, s] of judgmentScores) {
    const cat = kb.judgmentById.get(jid).category;
    votes.set(cat, (votes.get(cat) || 0) + 0.5 * s);
  }
  const categories = [...votes.entries()].sort((a, b) => b[1] - a[1]);
  const primary = categories.length ? categories[0][0] : null;

  const guides = conf !== "none" ? suggestGuides(kb, query, votes) : [];
  const guide = guides.length ? guides[0][1] : null;

  let templates = [];
  if (conf !== "none") {
    const all = new Map(kb.templates.map((t) => [t.id, templateSummary(t)]));
    const wanted = guide ? [...(guide.templates || [])] : [];
    for (const t of all.values()) if (t.categories.includes(primary) && !wanted.includes(t.id)) wanted.push(t.id);
    templates = wanted.filter((id) => all.has(id)).map((id) => all.get(id)).slice(0, 3);
  }

  return {
    query,
    confidence: conf,
    strong_match: conf === "high" || conf === "medium",
    best_score: round(best, 4),
    understood_as: terms,
    primary_category: primary,
    primary_category_label: categoryLabel(kb, primary),
    categories: categories.slice(0, 5).map(([k, v]) => ({ key: k, label: categoryLabel(kb, k), weight: round(v, 4) })),
    explanation: explain(kb, conf, primary, laws, guide),
    laws: conf !== "none" ? laws : [],
    judgments: conf !== "none" ? judgments : [],
    documents,
    guide: guide ? guideSummary(guide) : null,
    other_guides: guides.slice(1).filter(([s]) => s >= 0.6 * guides[0][0]).map(([, g]) => guideSummary(g)),
    templates,
    legal_provisions_text: laws
      .slice(0, 3)
      .map((l) => `${l.ref}, ${l.act} (${l.title})`)
      .join("; "),
    disclaimer: cfg.DISCLAIMER,
    web: null,
  };
}

function explain(kb, conf, primary, laws, guide) {
  if (conf === "none" || !laws.length) {
    return (
      "We could not find a provision in our knowledge base that clearly matches your description. " +
      "Try describing who did what, when and where (for example, 'my landlord changed the locks while I was away'), " +
      "or use the web search below. For urgent help, call 112, or 15100 for free legal aid."
    );
  }
  const names = laws.slice(0, 2).map((l) => `${l.ref} of the ${l.short_act || l.act} (${l.title.toLowerCase()})`);
  let text =
    `Your situation appears to relate to ${categoryLabel(kb, primary).toLowerCase()}. ` +
    `The most relevant provision${names.length > 1 ? "s are" : " is"} ${names.join(" and ")}.`;
  if (guide) text += ` The step-by-step guide "${guide.title}" explains what to do next and who to contact.`;
  if (conf === "low") text += " The match is weak, so please read the provisions carefully or rephrase your problem with more detail.";
  return text;
}
