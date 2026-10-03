import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, store } from "../api.js";
import Icon from "../components/Icon.jsx";
import { Disclaimer, ErrorBox, HelplineList, LoadingCards } from "../components/common.jsx";

const CONFIDENCE_TEXT = {
  high: "Strong match",
  medium: "Good match",
  low: "Weak match",
  none: "No match",
};

function LawCard({ law, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <article className="card law-card">
      <div className="law-head">
        <span className="icon-tile">
          <Icon name="book" />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="law-ref">
            {law.ref} · {law.title}
          </div>
          <div className="law-act">{law.act}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="small muted">Relevance</div>
          <div className="score-bar" title={`Cosine similarity ${law.score}`}>
            <span style={{ width: `${Math.max(8, law.relevance)}%` }} />
          </div>
        </div>
      </div>
      <div className="law-body">
        <p style={{ marginBottom: 6 }}>{open ? law.text : law.text.slice(0, 220) + (law.text.length > 220 ? "…" : "")}</p>
        {open && (
          <dl className="kv">
            {law.punishment && (
              <>
                <dt>Punishment</dt>
                <dd>{law.punishment}</dd>
              </>
            )}
            {law.old_equivalent && (
              <>
                <dt>Earlier law</dt>
                <dd>{law.old_equivalent}</dd>
              </>
            )}
            <dt>Area</dt>
            <dd>{law.category_label}</dd>
            {law.matched_terms?.length > 0 && (
              <>
                <dt>Matched on</dt>
                <dd className="row" style={{ gap: 6 }}>
                  {law.matched_terms.map((t) => (
                    <span key={t} className="chip">
                      {t}
                    </span>
                  ))}
                </dd>
              </>
            )}
            <dt>Similarity</dt>
            <dd>{law.score.toFixed(3)} (cosine)</dd>
          </dl>
        )}
        <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={() => setOpen((o) => !o)}>
          {open ? "Show less" : "Read more"}
        </button>
      </div>
    </article>
  );
}

function WebResults({ web, loading, onSearch }) {
  if (loading) return <LoadingCards count={1} />;
  if (!web)
    return (
      <button className="btn btn-ghost" onClick={onSearch}>
        <Icon name="globe" size={18} /> Search the web as well
      </button>
    );
  return (
    <div className="card">
      <div className="card-title">
        <Icon name="globe" />
        <h3 style={{ margin: 0 }}>From the web</h3>
        <span className="chip">via DuckDuckGo</span>
      </div>
      {web.error && !web.results?.length && <p className="muted small">{web.error}</p>}
      {web.results?.map((r) => (
        <div key={r.url} className="web-result">
          <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600 }}>
            {r.title}
          </a>
          <div className="small muted">{r.domain}</div>
          <div className="small">{r.snippet}</div>
        </div>
      ))}
      <p className="small muted" style={{ marginTop: 10 }}>
        Web results are not verified by PocketLaw. Prefer official sources such as indiacode.nic.in and court websites.
      </p>
    </div>
  );
}

export default function Matcher() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const [input, setInput] = useState(q);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [web, setWeb] = useState(null);
  const [webLoading, setWebLoading] = useState(false);
  const navigate = useNavigate();

  const run = useCallback(() => {
    if (q.trim().length < 3) return;
    setLoading(true);
    setError("");
    setWeb(null);
    api
      .match(q)
      .then((r) => {
        setResult(r);
        store.set("pocketlaw:lastMatch", r, true);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [q]);

  useEffect(() => {
    setInput(q);
    run();
  }, [q, run]);

  const submit = (e) => {
    e.preventDefault();
    const v = input.trim();
    if (v.length >= 3) setParams({ q: v });
  };

  const searchWeb = () => {
    setWebLoading(true);
    api
      .webSearch(q)
      .then(setWeb)
      .catch((e) => setWeb({ results: [], error: e.message }))
      .finally(() => setWebLoading(false));
  };

  const draft = (templateId) =>
    navigate(`/draft/${templateId}`, {
      state: { prefill: { legal_provisions: result?.legal_provisions_text || "", facts: q } },
    });

  return (
    <div className="container page">
      <form className="search-bar" onSubmit={submit}>
        <input
          className="input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe your legal problem in your own words…"
          aria-label="Describe your legal problem"
          maxLength={1000}
        />
        <button className="btn btn-primary" disabled={input.trim().length < 3}>
          <Icon name="search" size={18} /> Find my rights
        </button>
      </form>

      {!q && (
        <div className="card" style={{ marginTop: 22 }}>
          <h2>AI Law Matcher</h2>
          <p className="muted">
            Describe what happened: who did what, when and where. For example: <em>“My husband's family took my
            jewellery and threw me out of the house.”</em>
          </p>
        </div>
      )}

      <div style={{ marginTop: 18 }}>
        <ErrorBox message={error} onRetry={run} />
      </div>

      {loading && (
        <div className="results-grid">
          <LoadingCards count={3} />
          <LoadingCards count={1} />
        </div>
      )}

      {!loading && result && (
        <>
          <div className="card" style={{ marginTop: 18 }}>
            <div className="row" style={{ marginBottom: 8 }}>
              <span className={`badge ${result.confidence}`}>{CONFIDENCE_TEXT[result.confidence]}</span>
              {result.primary_category_label && <span className="chip primary">{result.primary_category_label}</span>}
            </div>
            <p style={{ fontSize: "1.04rem", marginBottom: 10 }}>{result.explanation}</p>
            {result.understood_as?.length > 0 && (
              <div className="row small muted" style={{ gap: 6 }}>
                <span>Understood as:</span>
                {result.understood_as.slice(0, 10).map((t) => (
                  <span key={t} className="chip">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>

          {result.guide?.urgent && (
            <div className="alert danger" style={{ marginTop: 14 }}>
              <Icon name="alert" />
              <div>{result.guide.urgent}</div>
            </div>
          )}

          <div className="results-grid">
            <div className="stack">
              {result.laws.length > 0 && (
                <h2 style={{ margin: "0 0 4px" }}>Relevant laws and sections</h2>
              )}
              {result.laws.map((law, i) => (
                <LawCard key={law.id} law={law} defaultOpen={i === 0} />
              ))}

              {result.judgments.length > 0 && (
                <div className="card">
                  <div className="card-title">
                    <Icon name="scale" />
                    <h3 style={{ margin: 0 }}>Related Supreme Court judgments</h3>
                  </div>
                  {result.judgments.map((j) => (
                    <div key={j.id} className="judgment">
                      <div className="name">{j.name}</div>
                      <div className="small muted">
                        {j.citation} · {j.year}
                      </div>
                      <div style={{ fontWeight: 600, marginTop: 4 }}>{j.principle}</div>
                      <div className="small muted">{j.summary}</div>
                    </div>
                  ))}
                  <p className="small muted" style={{ marginTop: 10 }}>
                    Summaries are simplified. Read the full judgment before relying on it.
                  </p>
                </div>
              )}

              {result.documents?.length > 0 && (
                <div className="card">
                  <h3>From your uploaded documents</h3>
                  {result.documents.map((d) => (
                    <div key={d.source + d.score} className="web-result">
                      <strong>{d.source}</strong>
                      <div className="small muted">{d.excerpt}…</div>
                    </div>
                  ))}
                </div>
              )}

              <WebResults web={web} loading={webLoading} onSearch={searchWeb} />
            </div>

            <aside className="stack sticky">
              {result.guide && (
                <div className="card">
                  <div className="card-title">
                    <span className="icon-tile accent">
                      <Icon name="steps" />
                    </span>
                    <div>
                      <div className="small muted">What to do next</div>
                      <h3 style={{ margin: 0 }}>{result.guide.title}</h3>
                    </div>
                  </div>
                  <p className="small muted">{result.guide.summary}</p>
                  <Link to={`/guide/${result.guide.id}`} className="btn btn-primary" style={{ width: "100%" }}>
                    Open step-by-step guide <Icon name="arrow" size={16} />
                  </Link>
                  {result.guide.helplines?.length > 0 && (
                    <div style={{ marginTop: 14 }}>
                      <div className="small muted" style={{ marginBottom: 6, fontWeight: 600 }}>
                        Helplines
                      </div>
                      <HelplineList helplines={result.guide.helplines} />
                    </div>
                  )}
                  {result.other_guides?.length > 0 && (
                    <div className="small" style={{ marginTop: 12 }}>
                      <span className="muted">Also see: </span>
                      {result.other_guides.map((g, i) => (
                        <span key={g.id}>
                          {i > 0 && " · "}
                          <Link to={`/guide/${g.id}`}>{g.title}</Link>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {result.templates?.length > 0 && (
                <div className="card">
                  <div className="card-title">
                    <span className="icon-tile">
                      <Icon name="file" />
                    </span>
                    <h3 style={{ margin: 0 }}>Draft a document</h3>
                  </div>
                  <div className="stack">
                    {result.templates.map((t) => (
                      <button key={t.id} className="btn btn-ghost" style={{ width: "100%", justifyContent: "space-between", whiteSpace: "normal", textAlign: "left" }} onClick={() => draft(t.id)}>
                        <span>
                          <strong>{t.title}</strong>
                          <span className="small muted" style={{ display: "block", fontWeight: 400 }}>
                            {t.forum}
                          </span>
                        </span>
                        <Icon name="arrow" size={16} />
                      </button>
                    ))}
                  </div>
                  <p className="small muted" style={{ marginTop: 10 }}>
                    The matched sections and your description are filled in for you.
                  </p>
                </div>
              )}

              {!result.strong_match && (
                <div className="card">
                  <h3>Need help now?</h3>
                  <HelplineList
                    helplines={[
                      { name: "Emergency Response", number: "112" },
                      { name: "NALSA Free Legal Aid", number: "15100" },
                    ]}
                  />
                </div>
              )}
            </aside>
          </div>
          <Disclaimer text={result.disclaimer} />
        </>
      )}
    </div>
  );
}
