// Assemble the in-browser knowledge base from the JSON exported by backend/scripts/export_web.py.
import { makeExpander } from "./synonyms.js";
import { TfidfIndex } from "./tfidf.js";

/** Build the knowledge base from already-parsed JSON objects (used by the app and by the tests). */
export function buildKb(d) {
  return {
    config: d.config,
    index: new TfidfIndex(d.index),
    guideIndex: new TfidfIndex(d.guideIndex),
    expander: makeExpander(d.synonyms),
    laws: d.laws,
    lawById: new Map(d.laws.map((l) => [l.id, l])),
    judgments: d.judgments,
    judgmentById: new Map(d.judgments.map((j) => [j.id, j])),
    guides: d.guides,
    templates: d.templates,
  };
}

export const KB_FILES = {
  config: "config.json",
  index: "index.json",
  guideIndex: "guide_index.json",
  synonyms: "synonyms.json",
  laws: "laws.json",
  judgments: "judgments.json",
  guides: "guides.json",
  templates: "templates.json",
};
