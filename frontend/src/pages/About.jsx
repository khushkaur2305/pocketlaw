import { Disclaimer } from "../components/common.jsx";

export default function About() {
  return (
    <div className="container page" style={{ maxWidth: 860 }}>
      <h1>About PocketLaw</h1>
      <p className="lead">
        PocketLaw is a legal information and guidance platform that makes Indian law easier to understand and act on.
        You describe a problem in everyday language, and PocketLaw retrieves the relevant laws, explains your rights,
        guides you step by step, and drafts the documents you need.
      </p>

      <div className="card" style={{ marginTop: 18 }}>
        <h2>How the matching works</h2>
        <p>
          The knowledge base is split into chunks (one per provision or judgment, plus overlapping windows for long PDF
          text). A TF-IDF vectoriser turns every chunk into a sparse vector of weighted words and word pairs. Your query
          is first expanded with legal vocabulary (for example, “boss didn't pay” adds “wages”, “employer” and “payment of
          wages”), vectorised the same way, and compared with every chunk using cosine similarity. The best-scoring
          provisions, their linked Supreme Court judgments, the most relevant survival guide and suitable document
          templates are returned together.
        </p>
        <p className="muted small">
          To extend the knowledge base, add entries to <code>backend/data/laws.json</code> or drop judgment / Act PDFs
          into <code>backend/data/pdfs/</code>. The index rebuilds automatically.
        </p>
      </div>

      <Disclaimer text="PocketLaw provides general legal information and guidance for educational and reference purposes. It is not a substitute for professional legal advice. Laws, helpline numbers and procedures change; verify with official sources or an advocate before acting." />
    </div>
  );
}
