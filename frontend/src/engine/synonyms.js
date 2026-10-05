// Port of backend/rag/synonyms.py: expand everyday language with legal vocabulary.
// The trigger lists themselves come from synonyms.json (exported from Python).

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function makeExpander({ contractions, groups }) {
  const compiled = groups.map(([triggers, expansion]) => [
    triggers.map((t) => new RegExp(`(?<![a-z])${escapeRe(t)}(?![a-z])`)),
    expansion,
  ]);

  function normalise(query) {
    let q = query.toLowerCase().replace(/’/g, "'");
    for (const [short, full] of Object.entries(contractions)) q = q.split(short).join(full);
    return q.replace(/\s+/g, " ").trim();
  }

  function expand(query) {
    const q = normalise(query);
    const extra = compiled.filter(([pats]) => pats.some((p) => p.test(q))).map(([, e]) => e);
    return [q, ...extra].join(" ");
  }

  return { normalise, expand };
}
