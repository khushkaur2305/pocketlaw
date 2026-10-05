// Browser-side TF-IDF that reproduces the scikit-learn TfidfVectorizer fitted by
// backend/rag/indexer.py (and exported by backend/scripts/export_web.py):
// lowercase -> accent strip -> \w\w+ tokens -> stop words -> 1..2-grams ->
// sublinear tf (1 + ln tf) * idf -> L2 normalise. Cosine similarity against the
// already-normalised document rows is then a plain dot product.

const TOKEN_RE = /[\p{L}\p{N}_]{2,}/gu;

function stripAccents(s) {
  return s.normalize("NFKD").replace(/\p{M}/gu, "");
}

export class TfidfIndex {
  constructor(exported) {
    const s = exported.settings;
    this.settings = s;
    this.stop = new Set(s.stop_words);
    this.vocab = exported.vocab;
    this.col = new Map(exported.vocab.map((t, i) => [t, i]));
    this.idf = exported.idf;
    this.docs = exported.docs;
    this.indptr = exported.indptr;
    this.indices = exported.indices;
    this.data = exported.data;
    this.manifest = exported.manifest;
  }

  analyze(text) {
    let t = this.settings.lowercase ? text.toLowerCase() : text;
    if (this.settings.strip_accents) t = stripAccents(t);
    const tokens = (t.match(TOKEN_RE) || []).filter((w) => !this.stop.has(w));
    const [minN, maxN] = this.settings.ngram_range;
    const grams = [];
    for (let n = minN; n <= maxN; n++) {
      for (let i = 0; i + n <= tokens.length; i++) grams.push(tokens.slice(i, i + n).join(" "));
    }
    return grams;
  }

  /** Sparse query vector as Map(column -> weight). */
  transform(text) {
    const counts = new Map();
    for (const g of this.analyze(text)) {
      const c = this.col.get(g);
      if (c !== undefined) counts.set(c, (counts.get(c) || 0) + 1);
    }
    let norm = 0;
    const vec = new Map();
    for (const [c, tf] of counts) {
      const w = (this.settings.sublinear_tf ? 1 + Math.log(tf) : tf) * this.idf[c];
      vec.set(c, w);
      norm += w * w;
    }
    norm = Math.sqrt(norm);
    if (norm > 0) for (const [c, w] of vec) vec.set(c, w / norm);
    return vec;
  }

  /** Cosine similarity of the query vector with every document row. */
  scores(qvec) {
    const out = new Float64Array(this.docs.length);
    if (qvec.size === 0) return out;
    for (let row = 0; row < this.docs.length; row++) {
      let dot = 0;
      for (let k = this.indptr[row]; k < this.indptr[row + 1]; k++) {
        const w = qvec.get(this.indices[k]);
        if (w !== undefined) dot += w * this.data[k];
      }
      out[row] = dot;
    }
    return out;
  }

  /** [{doc, score}] sorted by descending score, positive scores only. */
  search(qvec, topK = 30) {
    const s = this.scores(qvec);
    const order = Array.from(s.keys()).filter((i) => s[i] > 0);
    order.sort((a, b) => s[b] - s[a] || a - b);
    return order.slice(0, topK).map((i) => ({ doc: this.docs[i], score: s[i] }));
  }

  /** Highest-weighted vocabulary terms of a query vector (for "Understood as"). */
  topTerms(qvec, limit = 12) {
    return [...qvec.entries()]
      .sort((a, b) => b[1] - a[1] || a[0] - b[0])
      .slice(0, limit)
      .map(([c]) => this.vocab[c]);
  }
}
