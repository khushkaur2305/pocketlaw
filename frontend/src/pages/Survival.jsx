import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, store } from "../api.js";
import Icon from "../components/Icon.jsx";
import { Disclaimer, ErrorBox, HelplineList, LoadingCards, PortalList } from "../components/common.jsx";

function GuideList() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const load = () => {
    setError("");
    api.situations().then((d) => setItems(d.situations)).catch((e) => setError(e.message));
  };
  useEffect(load, []);

  return (
    <div className="container page">
      <h1>Legal survival steps</h1>
      <p className="lead">
        Pick the situation closest to yours. Each guide gives you ordered steps, your rights, the documents to keep, the
        right authority to approach and emergency contacts.
      </p>
      <ErrorBox message={error} onRetry={load} />
      {!items && !error && <LoadingCards count={3} />}
      {items && (
        <div className="guide-grid" style={{ marginTop: 18 }}>
          {items.map((g) => (
            <Link key={g.id} to={`/guide/${g.id}`} className="card guide-card">
              <span className="icon-tile">
                <Icon name={g.icon} />
              </span>
              <h3 style={{ margin: "6px 0 0" }}>{g.title}</h3>
              <p className="small muted" style={{ margin: 0 }}>
                {g.summary}
              </p>
              {g.urgent && (
                <span className="chip" style={{ color: "var(--danger)", marginTop: "auto", alignSelf: "flex-start" }}>
                  <Icon name="alert" size={13} /> Time-sensitive
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
      <Disclaimer />
    </div>
  );
}

function GuideDetail({ id }) {
  const [guide, setGuide] = useState(null);
  const [error, setError] = useState("");
  const storageKey = `pocketlaw:guide:${id}`;
  const [done, setDone] = useState(() => store.get(storageKey, []));
  const navigate = useNavigate();

  useEffect(() => {
    setGuide(null);
    setError("");
    setDone(store.get(storageKey, []));
    api.situation(id).then(setGuide).catch((e) => setError(e.message));
  }, [id, storageKey]);

  const toggle = (i) => {
    const next = done.includes(i) ? done.filter((x) => x !== i) : [...done, i];
    setDone(next);
    store.set(storageKey, next);
  };

  if (error)
    return (
      <div className="container page">
        <ErrorBox message={error} />
        <Link to="/guide">← All situations</Link>
      </div>
    );
  if (!guide)
    return (
      <div className="container page">
        <LoadingCards count={3} />
      </div>
    );

  const pct = Math.round((100 * done.length) / guide.steps.length);

  return (
    <div className="container page">
      <Link to="/guide" className="small">
        ← All situations
      </Link>
      <div className="row" style={{ marginTop: 10, alignItems: "flex-start" }}>
        <span className="icon-tile" style={{ width: 54, height: 54 }}>
          <Icon name={guide.icon} size={26} />
        </span>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h1 style={{ marginBottom: 6 }}>{guide.title}</h1>
          <p className="lead" style={{ margin: 0 }}>
            {guide.summary}
          </p>
        </div>
      </div>

      {guide.urgent && (
        <div className="alert danger" style={{ marginTop: 18 }}>
          <Icon name="alert" />
          <strong>{guide.urgent}</strong>
        </div>
      )}

      <div className="guide-layout" style={{ marginTop: 22 }}>
        <div className="stack">
          <div className="card">
            <div className="row" style={{ marginBottom: 10 }}>
              <h2 style={{ margin: 0 }}>Steps to take</h2>
              <span className="spacer" />
              <span className="small muted">
                {done.length} of {guide.steps.length} done
              </span>
            </div>
            <div className="progress" aria-label={`${pct}% complete`}>
              <span style={{ width: `${pct}%` }} />
            </div>
            <ol className="steps" style={{ marginTop: 8 }}>
              {guide.steps.map((s, i) => {
                const isDone = done.includes(i);
                return (
                  <li key={s.title} className={`step ${isDone ? "done" : ""}`}>
                    <button
                      className="step-check"
                      onClick={() => toggle(i)}
                      aria-pressed={isDone}
                      aria-label={`Mark step ${i + 1} as ${isDone ? "not done" : "done"}`}
                    >
                      {isDone ? <Icon name="check" size={16} stroke={3} /> : i + 1}
                    </button>
                    <div>
                      <div className="step-title">{s.title}</div>
                      <div>{s.detail}</div>
                      {s.why && (
                        <div className="step-why">
                          <strong>Why:</strong> {s.why}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="card">
            <h2>Your legal rights</h2>
            <div className="stack" style={{ marginTop: 6 }}>
              {guide.rights.map((r) => (
                <div key={r.right} className="rights-item">
                  <div style={{ fontWeight: 600 }}>{r.right}</div>
                  <div className="src">{r.source}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="two-col">
            <div className="card">
              <h3 style={{ color: "var(--success)" }}>Do</h3>
              <ul className="list-clean">
                {guide.dos.map((d) => (
                  <li key={d}>
                    <span style={{ color: "var(--success)" }}>
                      <Icon name="check" size={18} />
                    </span>
                    {d}
                  </li>
                ))}
              </ul>
            </div>
            <div className="card">
              <h3 style={{ color: "var(--danger)" }}>Don't</h3>
              <ul className="list-clean">
                {guide.donts.map((d) => (
                  <li key={d}>
                    <span style={{ color: "var(--danger)" }}>
                      <Icon name="x" size={18} />
                    </span>
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="card">
            <h3>Documents and evidence to keep</h3>
            <ul className="list-clean">
              {guide.documents.map((d) => (
                <li key={d}>
                  <Icon name="file" size={18} /> {d}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <aside className="stack sticky">
          {guide.helplines?.length > 0 && (
            <div className="card">
              <h3>Emergency and helplines</h3>
              <HelplineList helplines={guide.helplines} />
            </div>
          )}
          <div className="card">
            <h3>Where to go</h3>
            <ul className="list-clean">
              {guide.authorities.map((a) => (
                <li key={a.name}>
                  <span style={{ color: "var(--primary)" }}>
                    <Icon name="building" size={18} />
                  </span>
                  <span>
                    <strong>{a.name}</strong>
                    <span className="small muted" style={{ display: "block" }}>
                      {a.role}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          {guide.portals?.length > 0 && (
            <div className="card">
              <h3>Official portals</h3>
              <PortalList portals={guide.portals} />
            </div>
          )}
          {guide.template_details?.length > 0 && (
            <div className="card">
              <h3>Draft your document</h3>
              <div className="stack">
                {guide.template_details.map((t) => (
                  <button key={t.id} className="btn btn-primary" style={{ width: "100%", whiteSpace: "normal" }} onClick={() => navigate(`/draft/${t.id}`)}>
                    <Icon name="file" size={18} /> {t.title}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button className="btn btn-ghost no-print" onClick={() => window.print()}>
            Print this guide
          </button>
        </aside>
      </div>
      <Disclaimer text={guide.disclaimer} />
    </div>
  );
}

export default function Survival() {
  const { id } = useParams();
  return id ? <GuideDetail id={id} /> : <GuideList />;
}
