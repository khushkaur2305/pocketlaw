# PocketLaw – Type Your Problem, Get Your Legal Rights

**PocketLaw** is an AI-powered legal information and guidance platform designed to make Indian legal information more accessible, understandable, and practical for everyone. Users describe their legal problems in simple, everyday language, and PocketLaw uses a Retrieval-Augmented Generation (RAG) approach with semantic search to identify the relevant Indian laws, Acts, sections and constitutional Articles.

## Objectives and modules

| # | Objective | Module |
|---|-----------|--------|
| 1 | Understand users' legal problems and identify the relevant Indian laws, Acts, Articles or sections | **AI Law Matcher**: everyday-language query expansion, then TF-IDF vectorisation (scikit-learn) and cosine similarity, instead of exact keyword matching |
| 2 | Provide legal guidance, legal rights and the relevant emergency or authority contacts | **Interactive Legal Survival Steps**: 14 situation guides with ordered steps, do's and don'ts, rights (with sources), documents to keep, authorities, helplines and official portals |
| 3 | Automatically generate formatted legal applications from basic case details | **Automated Legal Document Drafting**: 9 templates rendered as properly formatted PDFs |

The three modules work as one flow: **problem → law → guidance → document**. A matched problem links straight to its survival guide, and opens the right template with the matched sections and the user's description already filled in.

### Document templates
Police complaint / FIR request (BNSS s.173) · Complaint to SP on FIR refusal (BNSS s.173(4)) · Consumer complaint to District Commission (CPA 2019 s.35) · Domestic violence application (PWDVA s.12) · RTI application (RTI Act s.6) · General legal notice · Cheque bounce notice (NI Act s.138) · Unpaid wages claim (Code on Wages) · Free legal aid application (LSA Act s.12)

## Technology stack

| Component          | Technologies                                                     |
| ------------------ | ---------------------------------------------------------------- |
| Frontend           | React 18, HTML5, CSS3, JavaScript (Vite)                         |
| Data Visualization | Chart.js (react-chartjs-2)                                       |
| Data pipeline      | Python (scikit-learn, SciPy, pdfplumber, pypdf)                  |
| RAG Engine         | TF-IDF Vectorizer (scikit-learn) + cosine similarity (run in the browser) |
| Vector Index       | SciPy sparse matrix exported as compact CSR JSON (unigrams + bigrams, max 15,000 features) |
| PDF Generation     | jsPDF (in the browser)                                           |
| Web Search         | DuckDuckGo HTML scraping via a Vercel serverless function (no API key required) |
| Hosting            | Vercel (static site + one function), free tier, no environment variables |
| Knowledge Base     | 161 provisions from 33 Acts / the Constitution, 49 Supreme Court judgment summaries, 14 guides; extendable with judgment PDFs |

### How it fits together

```
backend/ (Python, run on your computer)              frontend/ (deployed to Vercel)
  data/*.json, data/pdfs/  ──►  scikit-learn TF-IDF  ──►  public/data/*.json  ──►  browser engine (src/engine/)
                                scripts/export_web.py      (index, laws, guides,    query expansion, TF-IDF,
                                                            templates, stats)       cosine similarity, jsPDF
                                                                                    api/websearch.js (DuckDuckGo)
```

Python fits the TF-IDF model and exports it. The browser repeats the same steps (query expansion, weighting and cosine similarity) on the visitor's device, so the site needs no server. Tests check that the browser and scikit-learn give identical results.

The Flask app in `backend/` still works as an optional local API and as the reference implementation, but the deployed site does not use it.

## Running locally (Windows)

Requirements: Node.js 18+ (and Python 3.10+ only if you change the legal data).

```bash
cd frontend
```
```bash
npm.cmd install
```
```bash
npm.cmd run dev
```

Then open http://localhost:5173. (On Windows PowerShell, use `npm.cmd`, and don't chain commands with `&&`.)

### After editing the legal data (laws, judgments, guides, templates, PDFs)

```bash
cd backend
```
```bash
python -m venv venv
```
```bash
venv\Scripts\pip install -r requirements.txt
```
```bash
venv\Scripts\python scripts\export_web.py
```

This regenerates `frontend/public/data/`. Commit those files; Vercel only serves them and never runs Python.

### Tests

```bash
cd backend
```
```bash
venv\Scripts\python -m pytest -q
```
```bash
cd ..\frontend
```
```bash
npm.cmd test
```

- **Python (59 tests):** retrieval relevance (13 everyday problems must surface the right provision and guide), the Flask API, rendering of all 9 templates, and a check that the exported data is up to date.
- **JavaScript (55 tests):** parity with scikit-learn (identical TF-IDF weights, top-3 laws, guide and confidence), the same relevance cases, and PDF generation for every template.

> scikit-learn is pinned to 1.6.1 because newer wheels' DLLs are blocked by Windows Smart App Control on some machines.

## Deployment (Vercel only, free)

1. Push the repository to GitHub.
2. On vercel.com, choose **Add New → Project** and import the repository.
3. Set **Root Directory** to `frontend`. The framework is detected as Vite.
4. Click **Deploy**. No environment variables or API keys are needed.

Every later push to GitHub redeploys automatically.

Notes:
- `frontend/vercel.json` sends every page path to `index.html`, so links such as `/guide/cyber_fraud` work when refreshed. `/api`, `/data` and `/assets` are left alone.
- `frontend/api/websearch.js` becomes a Vercel serverless function. DuckDuckGo sometimes blocks cloud servers; if so, only the optional web search shows "unavailable".
- Searches and documents are processed in the visitor's browser and never sent to a server. Only the optional web search query goes to DuckDuckGo.

## Extending the knowledge base

- **Laws:** add entries to `backend/data/laws.json` (`act`, `ref`, `title`, `category`, `text`, `keywords`, optional `punishment`, `old_equivalent`, `related_judgments`).
- **Judgments / Acts as PDFs:** drop text-based PDFs in `backend/data/pdfs/`. They are chunked into 200-word windows with 50-word overlap and indexed.
- **Everyday-language synonyms:** `backend/rag/synonyms.py`.
- **Guides:** `backend/data/survival_steps.json`.
- **Document templates:** add a JSON file in `backend/data/templates/`. It needs no code changes, because fields, the form, validation and the PDF layout are all driven by the template.

After any of these changes, run `scripts/export_web.py` and commit `frontend/public/data/`.

## Optional local Flask API

Run with `venv\Scripts\python app.py` (http://127.0.0.1:5000). It serves the same features over HTTP:

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/match` `{query, include_web?}` | Matched laws, judgments, guide, templates, explanation |
| GET | `/api/situations`, `/api/situations/<id>` | Survival guides |
| GET | `/api/templates`, `/api/templates/<id>` | Document templates and their fields |
| POST | `/api/documents/<id>/preview` `{values}` | Validated, rendered preview blocks and warnings |
| POST | `/api/documents/<id>` `{values}` | PDF download |
| GET | `/api/websearch?q=` | DuckDuckGo results |
| GET | `/api/stats` | Knowledge base and index statistics |

## Project goal

To bridge the gap between complex legal information and ordinary people by bringing legal information retrieval, rights awareness, practical guidance and basic legal document generation together in a single, user-friendly platform.

**Disclaimer:** PocketLaw provides general legal information and guidance for educational and reference purposes. It is not a substitute for professional legal advice. Laws, helpline numbers and procedures change; verify with official sources or an advocate before acting.
