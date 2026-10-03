"""Supplementary web search by scraping DuckDuckGo's HTML endpoint (no API key required)."""
import time
from urllib.parse import parse_qs, unquote, urlparse

import requests
from bs4 import BeautifulSoup

ENDPOINT = "https://html.duckduckgo.com/html/"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
CACHE_SECONDS = 600
_cache = {}


def _resolve(href: str) -> str:
    """DuckDuckGo wraps result links as //duckduckgo.com/l/?uddg=<encoded url>."""
    if href.startswith("//"):
        href = "https:" + href
    parsed = urlparse(href)
    if "duckduckgo.com" in parsed.netloc and parsed.path.startswith("/l/"):
        target = parse_qs(parsed.query).get("uddg")
        if target:
            return unquote(target[0])
    return href


def search(query: str, max_results: int = 6) -> dict:
    query = query.strip()
    key = (query.lower(), max_results)
    cached = _cache.get(key)
    if cached and time.time() - cached[0] < CACHE_SECONDS:
        return cached[1]

    try:
        resp = requests.post(
            ENDPOINT,
            data={"q": f"{query} Indian law", "kl": "in-en"},
            headers={"User-Agent": USER_AGENT},
            timeout=8,
        )
        resp.raise_for_status()
    except requests.RequestException as exc:
        return {"query": query, "results": [], "error": f"Web search is unavailable right now ({type(exc).__name__})."}

    soup = BeautifulSoup(resp.text, "html.parser")
    results = []
    for res in soup.select("div.result"):
        if "result--ad" in (res.get("class") or []):
            continue
        link = res.select_one("a.result__a")
        if not link or not link.get("href"):
            continue
        snippet = res.select_one(".result__snippet")
        url = _resolve(link["href"])
        if not url.startswith("http"):
            continue
        results.append({
            "title": link.get_text(" ", strip=True),
            "url": url,
            "domain": urlparse(url).netloc.replace("www.", ""),
            "snippet": snippet.get_text(" ", strip=True) if snippet else "",
        })
        if len(results) >= max_results:
            break

    out = {"query": query, "results": results, "source": "DuckDuckGo"}
    if not results:
        out["error"] = "No web results found."
    _cache[key] = (time.time(), out)
    return out
