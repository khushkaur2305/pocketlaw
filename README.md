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
| Backend            | Python (Flask)                                                   |
| RAG Engine         | TF-IDF Vectorizer (scikit-learn) + cosine similarity             |
| Vector Index       | SciPy sparse matrix (unigrams + bigrams, max 15,000 features)    |
| PDF Processing     | pdfplumber + pypdf (ingestion), ReportLab (generation)           |
| Web Search         | DuckDuckGo HTML scraping (no API key required)                   |
| Knowledge Base     | 161 provisions from 33 Acts / the Constitution, 49 Supreme Court judgment summaries, 14 guides; extendable with judgment PDFs |

The index size grows as you add data. The Insights page shows the live chunk and feature counts.

## Running locally (Windows)

Requirements: Python 3.10+ and Node.js 18+.

**1. Backend** (http://127.0.0.1:5000)

```bash
cd backend
python -m venv venv
venv\Scripts\pip install -r requirements.txt
venv\Scripts\python app.py
```

The search index is built automatically on first start, and rebuilt whenever `data/*.json` or `data/pdfs/` changes.

**2. Frontend** (http://localhost:5173, with `/api` proxied to the backend)

```bash
cd frontend
npm install
npm run dev
```

**Tests**

```bash
cd backend
venv\Scripts\python -m pytest -q
```

The tests cover retrieval relevance (13 everyday problems must surface the right provision and guide), every API route, and rendering of all 9 PDF templates.

> scikit-learn is pinned to 1.6.1 because newer wheels' DLLs are blocked by Windows Smart App Control on some machines.

## Extending the knowledge base

- **Laws:** add entries to `backend/data/laws.json` (`act`, `ref`, `title`, `category`, `text`, `keywords`, optional `punishment`, `old_equivalent`, `related_judgments`).
- **Judgments / Acts as PDFs:** drop text-based PDFs in `backend/data/pdfs/`. They are chunked into 200-word windows with 50-word overlap and indexed.
- **Everyday-language synonyms:** `backend/rag/synonyms.py`.
- **Guides:** `backend/data/survival_steps.json`.
- **Document templates:** add a JSON file in `backend/data/templates/`. It needs no code changes, because fields, the form, validation and the PDF layout are all driven by the template.

## API

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
