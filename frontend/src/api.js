// PocketLaw data layer. Everything runs in the browser from the static JSON in /data
// (exported by backend/scripts/export_web.py); only web search calls a serverless function.
import { KB_FILES, buildKb } from "./engine/kb.js";
import { guideSummary, match, templateSummary } from "./engine/matcher.js";
import { renderBlocks, safeFilename, validate, warningsFor } from "./engine/drafting.js";

const DATA = `${import.meta.env.BASE_URL}data/`;

export class ApiError extends Error {
  constructor(message, fields) {
    super(message);
    this.fields = fields || {};
  }
}

const cache = new Map();

function load(name) {
  if (!cache.has(name)) {
    const p = fetch(DATA + name)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .catch(() => {
        cache.delete(name);
        throw new ApiError("Could not load PocketLaw data. Check your internet connection and try again.");
      });
    cache.set(name, p);
  }
  return cache.get(name);
}

let kbPromise = null;
function kb() {
  if (!kbPromise) {
    const keys = Object.keys(KB_FILES);
    kbPromise = Promise.all(keys.map((k) => load(KB_FILES[k])))
      .then((vals) => buildKb(Object.fromEntries(keys.map((k, i) => [k, vals[i]]))))
      .catch((e) => {
        kbPromise = null;
        throw e;
      });
  }
  return kbPromise;
}

async function templateById(id) {
  const t = (await load("templates.json")).find((x) => x.id === id);
  if (!t) throw new ApiError("Template not found");
  return t;
}

async function validated(id, values) {
  const t = await templateById(id);
  const { values: clean, errors } = validate(t, values || {});
  if (Object.keys(errors).length) throw new ApiError("Please correct the highlighted fields.", errors);
  return { t, clean };
}

export const api = {
  async match(query) {
    const q = String(query || "").trim();
    if (q.length < 3) throw new ApiError("Please describe your problem in a few words.");
    if (q.length > 1000) throw new ApiError("Please keep your description under 1000 characters.");
    return match(await kb(), q);
  },

  async examples() {
    return { examples: await load("examples.json") };
  },

  async situations() {
    return { situations: (await load("guides.json")).map(guideSummary) };
  },

  async situation(id) {
    const [guides, templates, config] = await Promise.all([load("guides.json"), load("templates.json"), load("config.json")]);
    const g = guides.find((x) => x.id === id);
    if (!g) throw new ApiError("Situation not found");
    const byId = new Map(templates.map((t) => [t.id, templateSummary(t)]));
    return {
      ...g,
      template_details: (g.templates || []).filter((t) => byId.has(t)).map((t) => byId.get(t)),
      disclaimer: config.DISCLAIMER,
    };
  },

  async templates() {
    return { templates: (await load("templates.json")).map(templateSummary) };
  },

  async template(id) {
    // eslint-disable-next-line no-unused-vars
    const { document: _doc, ...rest } = await templateById(id);
    return rest;
  },

  async preview(id, values) {
    const { t, clean } = await validated(id, values);
    const config = await load("config.json");
    return { title: t.title, blocks: renderBlocks(t, clean), warnings: warningsFor(t, clean), disclaimer: config.DISCLAIMER };
  },

  async downloadPdf(id, values) {
    const { t, clean } = await validated(id, values);
    const { renderPdf } = await import("./engine/pdf.js"); // jsPDF is loaded only when needed
    renderPdf(t, renderBlocks(t, clean)).save(safeFilename(t, clean));
  },

  async stats() {
    return load("stats.json");
  },

  async webSearch(q) {
    try {
      const r = await fetch(`/api/websearch?q=${encodeURIComponent(q)}`);
      if (!r.ok) throw new Error(String(r.status));
      return await r.json();
    } catch {
      return { query: q, results: [], error: "Web search is unavailable right now." };
    }
  },
};

// Storage helpers that never throw (private mode, blocked storage, etc.)
export const store = {
  get(key, fallback = null, session = false) {
    try {
      const raw = (session ? sessionStorage : localStorage).getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value, session = false) {
    try {
      (session ? sessionStorage : localStorage).setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};
