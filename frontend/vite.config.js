import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { searchDdg } from "./api/_lib/ddg.js";

// Serve /api/websearch locally (on Vercel the same code runs as the api/websearch.js function).
function webSearchDev() {
  const handler = async (req, res) => {
    const q = new URL(req.url, "http://localhost").searchParams.get("q") || "";
    const out = await searchDdg(q);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(out));
  };
  return {
    name: "pocketlaw-websearch-dev",
    configureServer(server) {
      server.middlewares.use("/api/websearch", handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use("/api/websearch", handler);
    },
  };
}

export default defineConfig({
  plugins: [react(), webSearchDev()],
  server: { port: 5173 },
  test: { environment: "node" },
});
