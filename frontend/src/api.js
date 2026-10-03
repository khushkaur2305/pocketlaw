// Thin wrappers around the Flask API (proxied to :5000 by Vite in development).
const BASE = import.meta.env.VITE_API_BASE || "/api";

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
  } catch {
    throw new ApiError(
      "Cannot reach the PocketLaw server. It may be waking up (free hosting sleeps when idle). Please try again in 30 seconds."
    );
  }
  if (!res.ok) {
    let data = {};
    try {
      data = await res.json();
    } catch {
      /* non-JSON error */
    }
    throw new ApiError(data.error || `Request failed (${res.status})`, data.fields);
  }
  return res;
}

export class ApiError extends Error {
  constructor(message, fields) {
    super(message);
    this.fields = fields || {};
  }
}

const json = (path, options) => request(path, options).then((r) => r.json());
const post = (path, body) => json(path, { method: "POST", body: JSON.stringify(body) });

export const api = {
  match: (query, includeWeb = false) => post("/match", { query, include_web: includeWeb }),
  examples: () => json("/examples"),
  webSearch: (q) => json(`/websearch?q=${encodeURIComponent(q)}`),
  situations: () => json("/situations"),
  situation: (id) => json(`/situations/${encodeURIComponent(id)}`),
  templates: () => json("/templates"),
  template: (id) => json(`/templates/${encodeURIComponent(id)}`),
  preview: (id, values) => post(`/documents/${encodeURIComponent(id)}/preview`, { values }),
  stats: () => json("/stats"),
  async downloadPdf(id, values) {
    const res = await request(`/documents/${encodeURIComponent(id)}`, {
      method: "POST",
      body: JSON.stringify({ values }),
    });
    const blob = await res.blob();
    const match = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") || "");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = match ? match[1] : `${id}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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
