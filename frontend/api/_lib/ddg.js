// DuckDuckGo HTML search (no API key). Port of backend/services/websearch.py.
// Shared by the Vercel function (api/websearch.js) and the Vite dev middleware.

const ENDPOINT = "https://html.duckduckgo.com/html/";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const ENTITIES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#x27;": "'", "&#39;": "'", "&nbsp;": " " };

function decode(s) {
  return s
    .replace(/&(?:amp|lt|gt|quot|nbsp|#x27|#39);/g, (m) => ENTITIES[m])
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
}

const clean = (html) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

function resolve(href) {
  let url = decode(href);
  if (url.startsWith("//")) url = "https:" + url;
  try {
    const u = new URL(url);
    if (u.hostname.endsWith("duckduckgo.com") && u.pathname.startsWith("/l/")) {
      return u.searchParams.get("uddg") || url;
    }
  } catch {
    /* keep as is */
  }
  return url;
}

export async function searchDdg(query, maxResults = 6) {
  const q = String(query || "").trim();
  if (q.length < 3 || q.length > 300) return { query: q, results: [], error: "Query must be between 3 and 300 characters." };

  let html;
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "User-Agent": USER_AGENT, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ q: `${q} Indian law`, kl: "in-en" }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } catch (e) {
    return { query: q, results: [], error: `Web search is unavailable right now (${e.name || "error"}).` };
  }

  const results = [];
  // Each result starts with <div class="result ...">; ads carry the extra class "result--ad".
  const parts = html.split(/<div class="(result(?:\s[^"]*)?)"\s*>/);
  for (let i = 1; i + 1 < parts.length && results.length < maxResults; i += 2) {
    const cls = parts[i];
    const body = parts[i + 1];
    if (cls.includes("result--ad")) continue;
    const link = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/.exec(body)
      || /<a[^>]*href="([^"]+)"[^>]*class="result__a"[^>]*>([\s\S]*?)<\/a>/.exec(body);
    if (!link) continue;
    const url = resolve(link[1]);
    if (!/^https?:\/\//.test(url)) continue;
    const snippet = /class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|div|td)>/.exec(body);
    let domain = "";
    try {
      domain = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      /* ignore */
    }
    results.push({ title: clean(link[2]), url, domain, snippet: snippet ? clean(snippet[1]) : "" });
  }

  const out = { query: q, results, source: "DuckDuckGo" };
  if (!results.length) out.error = "No web results found.";
  return out;
}
