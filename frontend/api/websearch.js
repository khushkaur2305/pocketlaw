// Vercel serverless function: GET /api/websearch?q=...
import { searchDdg } from "./_lib/ddg.js";

export default async function handler(req, res) {
  const q = new URL(req.url, "http://localhost").searchParams.get("q") || "";
  const out = await searchDdg(q);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=3600");
  res.statusCode = out.error && out.error.startsWith("Query must") ? 400 : 200;
  res.end(JSON.stringify(out));
}
