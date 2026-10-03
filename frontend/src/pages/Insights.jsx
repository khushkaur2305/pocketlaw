import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from "chart.js";
import { Bar } from "react-chartjs-2";
import { api, store } from "../api.js";
import { Disclaimer, ErrorBox, LoadingCards } from "../components/common.jsx";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

function useThemeColors() {
  const [colors, setColors] = useState(read);
  function read() {
    const s = getComputedStyle(document.documentElement);
    const v = (n) => s.getPropertyValue(n).trim();
    return { text: v("--muted"), grid: v("--border"), primary: v("--primary"), accent: v("--accent") };
  }
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setColors(read());
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return colors;
}

function barOptions(c, { horizontal = false, label = "" } = {}) {
  return {
    indexAxis: horizontal ? "y" : "x",
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx) => `${ctx.formattedValue} ${label}` } },
    },
    scales: {
      x: { ticks: { color: c.text, precision: 0 }, grid: { color: horizontal ? c.grid : "transparent" } },
      y: { ticks: { color: c.text, precision: 0 }, grid: { color: horizontal ? "transparent" : c.grid } },
    },
  };
}

export default function Insights() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const c = useThemeColors();
  const [last] = useState(() => store.get("pocketlaw:lastMatch", null, true));

  const load = () => {
    setError("");
    api.stats().then(setStats).catch((e) => setError(e.message));
  };
  useEffect(load, []);

  const data = useMemo(() => {
    if (!stats) return null;
    const bar = (labels, values, color) => ({
      labels,
      datasets: [{ data: values, backgroundColor: color, borderRadius: 6, maxBarThickness: 26 }],
    });
    return {
      category: bar(stats.by_category.map((x) => x.label), stats.by_category.map((x) => x.count), c.primary),
      act: bar(stats.by_act.slice(0, 12).map((x) => x.act), stats.by_act.slice(0, 12).map((x) => x.count), c.accent),
      decade: bar(stats.judgments_by_decade.map((x) => x.decade), stats.judgments_by_decade.map((x) => x.count), c.primary),
      last: last?.laws?.length
        ? bar(last.laws.map((l) => `${l.short_act || ""} ${l.ref}`.trim()), last.laws.map((l) => l.score), c.accent)
        : null,
    };
  }, [stats, c, last]);

  return (
    <div className="container page">
      <h1>Insights</h1>
      <p className="lead">What PocketLaw knows, and how its search engine scored your last query.</p>
      <ErrorBox message={error} onRetry={load} />
      {!stats && !error && <LoadingCards count={2} />}
      {stats && data && (
        <>
          <div className="stats-strip" style={{ marginTop: 10 }}>
            {[
              [stats.counts.provisions, "Provisions"],
              [stats.counts.acts, "Acts"],
              [stats.counts.judgments, "Judgments"],
              [stats.counts.chunks, "Indexed chunks"],
              [stats.counts.features?.toLocaleString("en-IN"), "TF-IDF features"],
              [stats.counts.pdf_files, "PDFs ingested"],
            ].map(([v, l]) => (
              <div className="card flat stat" key={l}>
                <div className="value">{v ?? "–"}</div>
                <div className="label">{l}</div>
              </div>
            ))}
          </div>

          <div className="card" style={{ marginTop: 18 }}>
            <h3>Your last query: similarity scores</h3>
            {data.last ? (
              <>
                <p className="small muted">“{last.query}”: cosine similarity between your query vector and each provision.</p>
                <div className="chart-box">
                  <Bar data={data.last} options={barOptions(c, { horizontal: true, label: "similarity" })} aria-label="Similarity scores for last query" />
                </div>
              </>
            ) : (
              <p className="muted">
                No query yet in this session. <Link to="/match">Try the Law Matcher</Link> and come back.
              </p>
            )}
          </div>

          <div className="charts" style={{ marginTop: 18 }}>
            <div className="card">
              <h3>Provisions by area of law</h3>
              <div className="chart-box tall">
                <Bar data={data.category} options={barOptions(c, { horizontal: true, label: "provisions" })} aria-label="Provisions by area of law" />
              </div>
            </div>
            <div className="stack">
              <div className="card">
                <h3>Top Acts by provisions</h3>
                <div className="chart-box">
                  <Bar data={data.act} options={barOptions(c, { label: "provisions" })} aria-label="Top Acts by number of provisions" />
                </div>
              </div>
              <div className="card">
                <h3>Judgments by decade</h3>
                <div className="chart-box" style={{ height: 140 }}>
                  <Bar data={data.decade} options={barOptions(c, { label: "judgments" })} aria-label="Judgments by decade" />
                </div>
              </div>
            </div>
          </div>

          {stats.index?.built_at && (
            <p className="small muted" style={{ marginTop: 14 }}>
              Index built {stats.index.built_at} in {stats.index.build_seconds}s · vocabulary capped at 15,000 features ·
              unigrams and bigrams with sublinear TF.
            </p>
          )}
        </>
      )}
      <Disclaimer />
    </div>
  );
}
