import Icon from "./Icon.jsx";

export function Disclaimer({ text }) {
  return (
    <p className="disclaimer">
      <strong>Disclaimer:</strong>{" "}
      {text ||
        "PocketLaw provides general legal information for educational and reference purposes only. It is not a substitute for advice from a qualified advocate."}
    </p>
  );
}

export function HelplineList({ helplines }) {
  if (!helplines?.length) return null;
  return (
    <div className="helpline-list">
      {helplines.map((h) => (
        <a key={h.number + h.name} className="helpline" href={`tel:${h.number}`}>
          <span className="row" style={{ gap: 8 }}>
            <Icon name="phone" size={16} />
            {h.name}
          </span>
          <span className="number">{h.number}</span>
        </a>
      ))}
    </div>
  );
}

export function ErrorBox({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="alert danger" role="alert">
      <Icon name="alert" />
      <div style={{ flex: 1 }}>{message}</div>
      {onRetry && (
        <button className="btn btn-ghost btn-sm" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function Skeleton({ height = 18, width = "100%", style }) {
  return <div className="skeleton" style={{ height, width, ...style }} />;
}

export function LoadingCards({ count = 3 }) {
  return (
    <div className="stack" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <div className="card" key={i}>
          <Skeleton height={20} width="40%" />
          <Skeleton height={14} style={{ marginTop: 12 }} />
          <Skeleton height={14} width="85%" style={{ marginTop: 8 }} />
        </div>
      ))}
    </div>
  );
}

export function PortalList({ portals }) {
  if (!portals?.length) return null;
  return (
    <ul className="list-clean">
      {portals.map((p) => (
        <li key={p.url}>
          <Icon name="link" size={16} />
          <a href={p.url} target="_blank" rel="noopener noreferrer">
            {p.name}
          </a>
        </li>
      ))}
    </ul>
  );
}
