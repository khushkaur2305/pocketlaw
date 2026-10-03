import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import Icon from "./Icon.jsx";

const LINKS = [
  { to: "/match", label: "Law Matcher" },
  { to: "/guide", label: "Survival Steps" },
  { to: "/draft", label: "Draft Documents" },
  { to: "/insights", label: "Insights" },
  { to: "/about", label: "About" },
];

export default function Layout({ children }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => {
    setOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <>
      <div className="sos-strip">
        <div className="container">
          <Icon name="alert" size={15} />
          <span>In an emergency:</span>
          <a href="tel:112">112 Emergency</a>
          <a href="tel:181">181 Women</a>
          <a href="tel:1930">1930 Cyber Fraud</a>
          <a href="tel:1098">1098 Child</a>
          <a href="tel:15100">15100 Free Legal Aid</a>
        </div>
      </div>
      <header className="nav">
        <div className="container nav-inner">
          <Link to="/" className="brand" aria-label="PocketLaw home">
            <span className="brand-mark">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3v18M7 21h10M4 7h16M4 7l-3 7a3 3 0 0 0 6 0zM20 7l-3 7a3 3 0 0 0 6 0z" />
              </svg>
            </span>
            PocketLaw
          </Link>
          <button className="nav-toggle" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu" aria-expanded={open}>
            <Icon name="menu" />
          </button>
          <nav className={`nav-links ${open ? "open" : ""}`}>
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} className={({ isActive }) => (isActive ? "active" : "")}>
                {l.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="footer">
        <div className="container stack">
          <div className="row">
            <strong style={{ color: "var(--text)" }}>PocketLaw</strong>
            <span>Type your problem, get your legal rights.</span>
          </div>
          <p className="small" style={{ maxWidth: "80ch" }}>
            PocketLaw provides general legal information for educational and reference purposes only. It is not a
            substitute for advice from a qualified advocate. For free legal help, contact your District Legal Services
            Authority or call NALSA at 15100.
          </p>
        </div>
      </footer>
    </>
  );
}
