import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ApiError, api, store } from "../api.js";
import Icon from "../components/Icon.jsx";
import { Disclaimer, ErrorBox, LoadingCards } from "../components/common.jsx";

function TemplateList() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const load = () => {
    setError("");
    api.templates().then((d) => setItems(d.templates)).catch((e) => setError(e.message));
  };
  useEffect(load, []);

  return (
    <div className="container page">
      <h1>Draft a legal document</h1>
      <p className="lead">
        Choose a document, answer a few simple questions, preview it, and download a properly formatted PDF ready to
        print, sign and submit.
      </p>
      <ErrorBox message={error} onRetry={load} />
      {!items && !error && <LoadingCards count={3} />}
      {items && (
        <div className="template-grid" style={{ marginTop: 18 }}>
          {items.map((t) => (
            <button key={t.id} className="card guide-card" style={{ textAlign: "left", cursor: "pointer" }} onClick={() => navigate(`/draft/${t.id}`)}>
              <span className="icon-tile">
                <Icon name="file" />
              </span>
              <h3 style={{ margin: "6px 0 0" }}>{t.title}</h3>
              <p className="small muted" style={{ margin: 0 }}>
                {t.description}
              </p>
              <div className="small" style={{ marginTop: "auto" }}>
                <span className="chip primary">{t.law}</span>
              </div>
            </button>
          ))}
        </div>
      )}
      <Disclaimer />
    </div>
  );
}

function Field({ f, value, error, onChange }) {
  const id = `f-${f.name}`;
  const common = { id, name: f.name, "aria-invalid": !!error, "aria-describedby": error ? `${id}-err` : undefined };
  let control;
  if (f.type === "checkbox") {
    return (
      <div className="field">
        <label className="checkbox" htmlFor={id}>
          <input {...common} type="checkbox" checked={!!value} onChange={(e) => onChange(f.name, e.target.checked)} />
          {f.label}
        </label>
      </div>
    );
  }
  if (f.type === "textarea") {
    control = (
      <textarea {...common} className="textarea" rows={f.rows || 3} placeholder={f.placeholder} value={value ?? ""} onChange={(e) => onChange(f.name, e.target.value)} />
    );
  } else if (f.type === "select") {
    control = (
      <select {...common} className="select" value={value ?? ""} onChange={(e) => onChange(f.name, e.target.value)}>
        <option value="">Select…</option>
        {f.options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  } else {
    control = (
      <input
        {...common}
        className="input"
        type={f.type === "number" ? "number" : f.type === "tel" ? "tel" : f.type === "email" ? "email" : f.type === "date" ? "date" : "text"}
        min={f.type === "number" ? 0 : undefined}
        placeholder={f.placeholder}
        value={value ?? ""}
        onChange={(e) => onChange(f.name, e.target.value)}
      />
    );
  }
  return (
    <div className={`field ${error ? "has-error" : ""}`}>
      <label htmlFor={id}>
        {f.label}
        {f.required && <span style={{ color: "var(--danger)" }}> *</span>}
      </label>
      {control}
      {f.help && <span className="help">{f.help}</span>}
      {error && (
        <span className="error" id={`${id}-err`}>
          {error}
        </span>
      )}
    </div>
  );
}

function Highlight({ text }) {
  const parts = String(text).split(/(_{6,})/);
  return parts.map((p, i) =>
    /^_{6,}$/.test(p) ? (
      <span key={i} className="blank" title="Fill this in">
        {p}
      </span>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}

function Paper({ blocks }) {
  return (
    <div className="paper" aria-label="Document preview">
      {blocks.map((b, i) => {
        switch (b.kind) {
          case "court_heading":
            return <p key={i} className="c b">{b.text}</p>;
          case "case_no":
            return <p key={i} className="c">{b.text}</p>;
          case "party":
            return (
              <div key={i} className="party">
                <div>{b.lines.map((l, j) => <div key={j}><Highlight text={l} /></div>)}</div>
                <div className="b">{b.role}</div>
              </div>
            );
          case "versus":
            return <p key={i} className="c b" style={{ marginTop: 8 }}>{b.text}</p>;
          case "heading":
            return <p key={i} className="c b u" style={{ margin: "14px 0" }}>{b.text}</p>;
          case "delivery":
            return <p key={i} className="b">{b.text}</p>;
          case "date_place":
            return (
              <div key={i} className={b.align === "right" ? "r" : ""} style={{ margin: "8px 0" }}>
                {b.lines.map((l, j) => <div key={j}><Highlight text={l} /></div>)}
              </div>
            );
          case "to":
            return (
              <div key={i} style={{ marginBottom: 10 }}>
                {b.lines.map((l, j) => <div key={j}><Highlight text={l} /></div>)}
              </div>
            );
          case "subject":
            return <p key={i}><span className="b">Subject: </span><Highlight text={b.text} /></p>;
          case "salutation":
          case "para":
          case "prayer_intro":
            return <p key={i}><Highlight text={b.text} /></p>;
          case "numbered":
            return (
              <div key={i} className="num">
                <span>{b.num}.</span>
                <span><Highlight text={b.text} /></span>
              </div>
            );
          case "section_heading":
            return <p key={i} className={`b ${b.center ? "c u" : ""}`} style={{ marginTop: 10 }}>{b.text}</p>;
          case "prayer_item":
            return (
              <div key={i} className="num prayer">
                <span>{b.label}</span>
                <span><Highlight text={b.text} /></span>
              </div>
            );
          case "signoff":
            return (
              <div key={i} className="r" style={{ margin: "14px 0" }}>
                {b.lines.map((l, j) => (l ? <div key={j}><Highlight text={l} /></div> : <br key={j} />))}
              </div>
            );
          case "enclosures":
            return (
              <div key={i} style={{ marginTop: 12 }}>
                <div className="b">Enclosures:</div>
                {b.items.map((e, j) => <div key={j}>{j + 1}. {e}</div>)}
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}

function DraftForm({ id }) {
  const location = useLocation();
  const [template, setTemplate] = useState(null);
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState("");
  const draftKey = `pocketlaw:draft:${id}`;

  useEffect(() => {
    setTemplate(null);
    setPreview(null);
    setErrors({});
    setMessage("");
    api
      .template(id)
      .then((t) => {
        const defaults = {};
        t.fields.forEach((f) => {
          if (f.default !== undefined) defaults[f.name] = f.default;
        });
        const saved = store.get(draftKey, {});
        const prefill = {};
        const incoming = location.state?.prefill || {};
        t.fields.forEach((f) => {
          if (incoming[f.name]) prefill[f.name] = incoming[f.name];
        });
        setValues({ ...defaults, ...saved, ...prefill });
        setTemplate(t);
      })
      .catch((e) => setLoadError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (template) store.set(draftKey, values);
  }, [values, template, draftKey]);

  const groups = useMemo(() => {
    if (!template) return [];
    const out = [];
    template.fields.forEach((f) => {
      const g = f.group || "Details";
      let entry = out.find((x) => x.name === g);
      if (!entry) out.push((entry = { name: g, fields: [] }));
      entry.fields.push(f);
    });
    return out;
  }, [template]);

  const onChange = (name, value) => {
    setValues((v) => ({ ...v, [name]: value }));
    if (errors[name]) setErrors((e) => ({ ...e, [name]: undefined }));
  };

  const handleError = (e) => {
    if (e instanceof ApiError && Object.keys(e.fields).length) {
      setErrors(e.fields);
      setMessage(e.message);
      const first = document.getElementById(`f-${Object.keys(e.fields)[0]}`);
      first?.focus();
    } else {
      setMessage(e.message);
    }
  };

  const doPreview = async () => {
    setBusy("preview");
    setMessage("");
    try {
      const p = await api.preview(id, values);
      setErrors({});
      setPreview(p);
      if (window.innerWidth < 1050) document.getElementById("preview")?.scrollIntoView({ behavior: "smooth" });
    } catch (e) {
      handleError(e);
    } finally {
      setBusy("");
    }
  };

  const doDownload = async () => {
    setBusy("pdf");
    setMessage("");
    try {
      await api.downloadPdf(id, values);
      setErrors({});
    } catch (e) {
      handleError(e);
    } finally {
      setBusy("");
    }
  };

  const reset = () => {
    store.remove(draftKey);
    const defaults = {};
    template.fields.forEach((f) => {
      if (f.default !== undefined) defaults[f.name] = f.default;
    });
    setValues(defaults);
    setPreview(null);
    setErrors({});
  };

  if (loadError)
    return (
      <div className="container page">
        <ErrorBox message={loadError} />
        <Link to="/draft">← All documents</Link>
      </div>
    );
  if (!template)
    return (
      <div className="container page">
        <LoadingCards count={2} />
      </div>
    );

  return (
    <div className="container page">
      <Link to="/draft" className="small">
        ← All documents
      </Link>
      <h1 style={{ marginTop: 10 }}>{template.title}</h1>
      <p className="lead">{template.description}</p>
      <div className="row small" style={{ marginBottom: 18 }}>
        <span className="chip primary">{template.law}</span>
        <span className="chip">Submit to: {template.forum}</span>
      </div>
      {location.state?.prefill && (
        <div className="alert info" style={{ marginBottom: 16 }}>
          <Icon name="sparkle" />
          <span>We pre-filled the relevant law and your problem description from the Law Matcher. Please check and edit them.</span>
        </div>
      )}

      <div className="draft-layout">
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            doPreview();
          }}
          noValidate
        >
          {groups.map((g) => (
            <fieldset key={g.name} className="form-group">
              <legend>{g.name}</legend>
              {g.fields.map((f) => (
                <Field key={f.name} f={f} value={values[f.name]} error={errors[f.name]} onChange={onChange} />
              ))}
            </fieldset>
          ))}
          <ErrorBox message={message} />
          <div className="row">
            <button type="submit" className="btn btn-ghost" disabled={!!busy}>
              <Icon name="eye" size={18} /> {busy === "preview" ? "Preparing…" : "Preview"}
            </button>
            <button type="button" className="btn btn-primary" onClick={doDownload} disabled={!!busy}>
              <Icon name="download" size={18} /> {busy === "pdf" ? "Generating…" : "Download PDF"}
            </button>
            <span className="spacer" />
            <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>
              Clear form
            </button>
          </div>
          <p className="small muted">Your answers are saved in this browser only, so you can come back later.</p>
        </form>

        <div id="preview" className="stack sticky">
          {preview ? (
            <>
              {preview.warnings?.map((w) => (
                <div key={w} className="alert warn">
                  <Icon name="alert" />
                  <span>{w}</span>
                </div>
              ))}
              <Paper blocks={preview.blocks} />
              <p className="small muted">
                Highlighted blanks are to be filled in by hand. Sign the document, attach copies of your evidence, and
                keep a copy for yourself.
              </p>
            </>
          ) : (
            <div className="card center" style={{ padding: 40 }}>
              <span className="icon-tile" style={{ margin: "0 auto 12px" }}>
                <Icon name="eye" />
              </span>
              <h3>Preview appears here</h3>
              <p className="muted small">Fill in the form and click Preview to see the formatted document.</p>
            </div>
          )}
        </div>
      </div>
      <Disclaimer />
    </div>
  );
}

export default function Drafting() {
  const { id } = useParams();
  return id ? <DraftForm id={id} /> : <TemplateList />;
}
