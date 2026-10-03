import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import Icon from "../components/Icon.jsx";
import { Disclaimer } from "../components/common.jsx";

const FALLBACK_EXAMPLES = [
  "My employer has not paid my salary for the last three months",
  "Police are refusing to register my FIR for a stolen phone",
  "Someone called pretending to be from my bank and took money through UPI",
  "My landlord is not returning my security deposit",
];

const MODULES = [
  {
    to: "/match",
    icon: "search",
    title: "AI Law Matcher",
    text: "Describe your problem in everyday words. We match it to the relevant Acts, sections and Articles using TF-IDF semantic search and explain them simply.",
  },
  {
    to: "/guide",
    icon: "steps",
    title: "Legal Survival Steps",
    text: "Step-by-step guidance for common situations: what to do first, your rights, documents to keep, the right authority and emergency helplines.",
  },
  {
    to: "/draft",
    icon: "file",
    title: "Document Drafting",
    text: "Fill a short form and download a properly formatted PDF: police complaints, consumer complaints, legal notices, RTI and more.",
  },
];

export default function Home() {
  const [query, setQuery] = useState("");
  const [examples, setExamples] = useState(FALLBACK_EXAMPLES);
  const [stats, setStats] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.examples().then((d) => setExamples(d.examples.slice(0, 6))).catch(() => {});
    api.stats().then(setStats).catch(() => {});
  }, []);

  const submit = (e) => {
    e?.preventDefault();
    const q = query.trim();
    if (q.length >= 3) navigate(`/match?q=${encodeURIComponent(q)}`);
  };

  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <span className="chip accent">
              <Icon name="sparkle" size={14} /> Indian legal information, made simple
            </span>
            <h1 style={{ marginTop: 14 }}>
              Type your problem, <span>get your legal rights.</span>
            </h1>
            <p className="lead">
              Tell PocketLaw what happened, in your own words. We find the Indian laws that apply, explain your rights,
              show you exactly what to do next, and help you draft the complaint or notice.
            </p>
            <form className="card ask-box" onSubmit={submit}>
              <label htmlFor="ask" className="small muted" style={{ fontWeight: 600 }}>
                Describe your legal problem
              </label>
              <textarea
                id="ask"
                className="textarea"
                placeholder="e.g. My landlord changed the locks while I was away and is keeping my deposit..."
                value={query}
                maxLength={1000}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit();
                }}
              />
              <div className="ask-actions">
                <span className="small muted">{query.length}/1000 · Ctrl + Enter to search</span>
                <span className="spacer" />
                <button className="btn btn-primary" type="submit" disabled={query.trim().length < 3}>
                  <Icon name="search" size={18} /> Find my rights
                </button>
              </div>
            </form>
            <div className="examples" aria-label="Example problems">
              {examples.map((ex) => (
                <button key={ex} className="example" onClick={() => navigate(`/match?q=${encodeURIComponent(ex)}`)}>
                  {ex}
                </button>
              ))}
            </div>
          </div>

          <div className="hero-side">
            <div className="card">
              <h3>How it works</h3>
              <div className="stack">
                {[
                  ["Understand", "Your words are expanded with legal vocabulary and compared with every provision in the knowledge base."],
                  ["Match", "Cosine similarity ranks the most relevant Acts, sections, Articles and Supreme Court judgments."],
                  ["Act", "Get a survival guide with helplines and authorities, and a ready-to-file document."],
                ].map(([t, d], i) => (
                  <div className="mini-step" key={t}>
                    <span className="num">{i + 1}</span>
                    <div>
                      <strong>{t}</strong>
                      <div className="small muted">{d}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="container">
        <section className="section">
          <div className="modules">
            {MODULES.map((m) => (
              <Link key={m.to} to={m.to} className="card module-card">
                <span className="icon-tile">
                  <Icon name={m.icon} />
                </span>
                <h3 style={{ marginTop: 8 }}>{m.title}</h3>
                <p className="muted small">{m.text}</p>
                <span className="small" style={{ color: "var(--primary)", fontWeight: 600, marginTop: "auto" }}>
                  Open <Icon name="arrow" size={14} />
                </span>
              </Link>
            ))}
          </div>
        </section>

        {stats && (
          <section className="section">
            <div className="section-head">
              <h2>Knowledge base</h2>
              <Link to="/insights" className="small">
                See insights →
              </Link>
            </div>
            <div className="stats-strip">
              {[
                [stats.counts.provisions, "Legal provisions"],
                [stats.counts.acts, "Acts & Constitution"],
                [stats.counts.judgments, "Supreme Court judgments"],
                [stats.counts.guides, "Survival guides"],
                [stats.counts.templates, "Document templates"],
                [stats.counts.features?.toLocaleString("en-IN"), "TF-IDF features"],
              ].map(([v, l]) => (
                <div className="card flat stat" key={l}>
                  <div className="value">{v ?? "–"}</div>
                  <div className="label">{l}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        <Disclaimer />
      </div>
    </>
  );
}
