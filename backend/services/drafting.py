"""Automated legal document drafting: validate form input, fill a template, render a PDF.

Templates live in data/templates/*.json. Text in a template may contain
  {field}        - replaced by the field value (blank line if empty)
  [[ ... ]]      - optional fragment, kept only if every {field} inside it has a value
and list items may be {"if": "field", "text": "..."} to include them conditionally.
Computed values: {today}, {year}, {para_count}, and {<number field>_words}.
"""
import datetime as dt
import glob
import io
import json
import os
import re
from xml.sax.saxutils import escape

import config

BLANK = "__________"
MAX_LEN = {"text": 200, "tel": 20, "email": 120, "textarea": 4000, "select": 300, "date": 10, "number": 15}
PHONE_RE = re.compile(r"^[0-9+\-\s()]{6,20}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
COND_RE = re.compile(r"\[\[(.+?)\]\]", re.S)
FIELD_RE = re.compile(r"\{(\w+)\}")
LIST_PREFIX_RE = re.compile(r"^\s*(?:\d+[.)]|[-*•]|\([a-z0-9]+\))\s+")

_cache = {"key": None, "templates": {}}


# ---------------------------------------------------------------- templates

def load_templates() -> dict:
    paths = sorted(glob.glob(os.path.join(config.TEMPLATE_DIR, "*.json")))
    key = tuple((p, os.path.getmtime(p)) for p in paths)
    if _cache["key"] != key:
        templates = {}
        for p in paths:
            with open(p, encoding="utf-8") as fh:
                t = json.load(fh)
            templates[t["id"]] = t
        _cache.update(key=key, templates=templates)
    return _cache["templates"]


def get_template(template_id: str):
    return load_templates().get(template_id)


def template_summaries():
    return [
        {k: t[k] for k in ("id", "title", "description", "forum", "law", "categories")}
        for t in load_templates().values()
    ]


def public_template(t: dict) -> dict:
    return {k: v for k, v in t.items() if k not in ("document",)}


# ---------------------------------------------------------------- validation

def _parse_date(value: str):
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%d.%m.%Y"):
        try:
            return dt.datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    return None


def validate(template: dict, raw: dict):
    """Return (values, errors). values holds typed values keyed by field name."""
    values, errors = {}, {}
    raw = raw or {}
    for f in template["fields"]:
        name, ftype = f["name"], f.get("type", "text")
        v = raw.get(name, f.get("default"))
        if ftype == "checkbox":
            values[name] = v in (True, "true", "on", "yes", "1", 1)
            continue
        v = "" if v is None else str(v).strip()
        if not v:
            if f.get("required"):
                errors[name] = f"{f['label']} is required."
            values[name] = None
            continue
        if len(v) > MAX_LEN.get(ftype, 200):
            errors[name] = f"{f['label']} is too long (max {MAX_LEN.get(ftype, 200)} characters)."
            continue
        if ftype == "tel" and not PHONE_RE.match(v):
            errors[name] = "Enter a valid phone number."
        elif ftype == "email" and not EMAIL_RE.match(v):
            errors[name] = "Enter a valid email address."
        elif ftype == "date":
            d = _parse_date(v)
            if not d:
                errors[name] = "Enter a valid date."
            else:
                values[name] = d
            continue
        elif ftype == "number":
            try:
                n = float(v.replace(",", ""))
                if n < 0:
                    raise ValueError
                values[name] = n
            except ValueError:
                errors[name] = "Enter a valid positive number."
            continue
        elif ftype == "select" and v not in f.get("options", []):
            errors[name] = "Choose one of the listed options."
        values[name] = v
    return values, errors


def check_warnings(template: dict, values: dict):
    warnings = []
    today = dt.date.today()
    for c in template.get("checks", []):
        if c["type"] == "max_days_since":
            d = values.get(c["field"])
            if d and (today - d).days > c["days"]:
                warnings.append(c["message"])
        elif c["type"] == "max_days_between":
            a, b = values.get(c["from"]), values.get(c["to"])
            if a and b and (b - a).days > c["days"]:
                warnings.append(c["message"])
    return warnings


# ---------------------------------------------------------------- formatting

_ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven",
         "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"]
_TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]


def _below_hundred(n: int) -> str:
    if n < 20:
        return _ONES[n]
    return (_TENS[n // 10] + " " + _ONES[n % 10]).strip()


def _below_thousand(n: int) -> str:
    h, rest = divmod(n, 100)
    parts = []
    if h:
        parts.append(_ONES[h] + " Hundred")
    if rest:
        parts.append(_below_hundred(rest))
    return " ".join(parts)


def number_to_words_indian(n: int) -> str:
    """12500000 -> 'One Crore Twenty Five Lakh'."""
    if n == 0:
        return "Zero"
    parts = []
    crore, n = divmod(n, 10_000_000)
    lakh, n = divmod(n, 100_000)
    thousand, n = divmod(n, 1000)
    if crore:
        parts.append(number_to_words_indian(crore) + " Crore")
    if lakh:
        parts.append(_below_hundred(lakh) + " Lakh")
    if thousand:
        parts.append(_below_hundred(thousand) + " Thousand")
    if n:
        parts.append(_below_thousand(n))
    return " ".join(parts)


def format_inr(n: float) -> str:
    """1234567.5 -> '12,34,567.50' (Indian digit grouping)."""
    whole = int(n)
    frac = round(n - whole, 2)
    s = str(whole)
    if len(s) > 3:
        head, tail = s[:-3], s[-3:]
        head = ",".join(re.findall(r"\d{1,2}(?=(?:\d{2})*$)", head))
        s = f"{head},{tail}"
    return f"{s}.{int(round(frac * 100)):02d}" if frac else s


def build_context(template: dict, values: dict) -> dict:
    today = dt.date.today()
    ctx = {"today": today.strftime("%d-%m-%Y"), "year": str(today.year)}
    for f in template["fields"]:
        name, ftype, v = f["name"], f.get("type", "text"), values.get(f["name"])
        if ftype == "checkbox":
            ctx[name] = "yes" if v else ""
        elif v is None or v == "":
            ctx[name] = ""
        elif ftype == "date":
            ctx[name] = v.strftime("%d-%m-%Y")
        elif ftype == "number":
            ctx[name] = format_inr(v) if "amount" in name or "salary" in name or "cost" in name or "income" in name else (
                str(int(v)) if float(v).is_integer() else str(v))
            ctx[f"{name}_words"] = f"Rupees {number_to_words_indian(int(v))} only"
        else:
            ctx[name] = v
    return ctx


def fill(text: str, ctx: dict, inline: bool = True) -> str:
    def cond(m):
        inner = m.group(1)
        needed = FIELD_RE.findall(inner)
        return inner if all(ctx.get(n) for n in needed) else ""

    def sub(m):
        v = ctx.get(m.group(1))
        if not v:
            return BLANK
        return re.sub(r"\s*\n\s*", ", ", v) if inline else v

    out = FIELD_RE.sub(sub, COND_RE.sub(cond, text))
    return re.sub(r"[ \t]{2,}", " ", out).strip()


def resolve_items(items, ctx, inline=True):
    out = []
    for item in items or []:
        if isinstance(item, dict):
            if item.get("if") and not ctx.get(item["if"]):
                continue
            item = item["text"]
        text = fill(item, ctx, inline)
        if text:
            out.append(text)
    return out


def resolve_lines(lines, ctx):
    """Like resolve_items but splits multi-line values into separate lines; keeps intentional blanks."""
    out = []
    for line in lines or []:
        if line == "":
            out.append("")
            continue
        text = fill(line, ctx, inline=False)
        if text:
            out.extend(part.strip() for part in text.split("\n") if part.strip())
    return out


def split_points(text: str):
    if not text:
        return []
    return [LIST_PREFIX_RE.sub("", ln).strip() for ln in text.splitlines() if ln.strip()]


# ---------------------------------------------------------------- blocks

def render_blocks(template: dict, values: dict):
    """Produce an ordered list of layout blocks shared by the preview and the PDF renderer."""
    doc = template["document"]
    ctx = build_context(template, values)
    blocks = []

    def add(kind, **kw):
        blocks.append({"kind": kind, **kw})

    for line in resolve_items(doc.get("court_heading"), ctx):
        add("court_heading", text=line)
    if doc.get("case_no"):
        add("case_no", text=fill(doc["case_no"], ctx))
    for p in doc.get("parties", []):
        if p.get("versus"):
            add("versus", text="VERSUS")
        else:
            add("party", lines=resolve_lines(p["lines"], ctx), role=p["role"])
    if doc.get("heading"):
        add("heading", text=fill(doc["heading"], ctx))
    if doc.get("mode_of_delivery"):
        add("delivery", text=doc["mode_of_delivery"])
    if doc.get("date_place") == "top":
        add("date_place", lines=[f"Date: {ctx['today']}", f"Place: {ctx.get('place') or BLANK}"], align="right")
    if doc.get("to"):
        add("to", lines=resolve_lines(doc["to"], ctx))
    if doc.get("subject"):
        add("subject", text=fill(doc["subject"], ctx))
    if doc.get("salutation"):
        add("salutation", text=doc["salutation"])
    for para in resolve_items(doc.get("intro"), ctx):
        add("para", text=para)

    n = 0
    for para in resolve_items(doc.get("pre_facts"), ctx):
        n += 1
        add("numbered", num=n, text=para)
    facts = split_points(values.get(doc.get("facts_field", ""), "") or "")
    if facts:
        if doc.get("facts_heading"):
            add("section_heading", text=doc["facts_heading"])
        for fact in facts:
            n += 1
            add("numbered", num=n, text=fact)
    for para in resolve_items(doc.get("paragraphs"), ctx):
        n += 1
        add("numbered", num=n, text=para)
    ctx["para_count"] = str(n)

    legal = resolve_items(doc.get("legal_basis"), ctx)
    if legal:
        add("section_heading", text=doc.get("legal_basis_heading", "Legal basis"))
        for para in legal:
            add("para", text=para)

    prayer = resolve_items(doc.get("prayer"), ctx)
    if prayer:
        if doc.get("prayer_intro"):
            add("prayer_intro", text=doc["prayer_intro"])
        for i, item in enumerate(prayer):
            add("prayer_item", label=f"({chr(97 + i)})", text=item)

    for para in resolve_items(doc.get("closing"), ctx):
        add("para", text=para)

    if doc.get("date_place") == "bottom":
        add("date_place", lines=[f"Place: {ctx.get('place') or BLANK}", f"Date: {ctx['today']}"], align="left")
    add("signoff", lines=resolve_lines(doc.get("signoff"), ctx))

    if doc.get("verification"):
        add("section_heading", text=doc.get("verification_heading", "VERIFICATION"), center=True)
        for para in resolve_items(doc["verification"], ctx):
            add("para", text=para)
        add("signoff", lines=resolve_lines(doc.get("verification_signoff"), ctx))

    enclosures = split_points(values.get(doc.get("enclosures_field", ""), "") or "")
    if enclosures:
        add("enclosures", items=enclosures)
    return blocks


# ---------------------------------------------------------------- PDF

_REPLACEMENTS = {"₹": "Rs. ", "‘": "'", "’": "'", "“": '"', "”": '"',
                 "–": "-", "—": "-", "…": "...", " ": " "}


def pdf_safe(text: str) -> str:
    """The built-in PDF fonts cover Latin-1 only; replace common symbols and drop the rest."""
    for a, b in _REPLACEMENTS.items():
        text = text.replace(a, b)
    return text.encode("latin-1", "replace").decode("latin-1")


def has_unsupported_chars(values: dict) -> bool:
    """True if any value contains characters (e.g. Hindi/Punjabi script) the PDF fonts cannot show."""
    for v in values.values():
        if isinstance(v, str):
            for a, b in _REPLACEMENTS.items():
                v = v.replace(a, b)
            try:
                v.encode("latin-1")
            except UnicodeEncodeError:
                return True
    return False


def render_pdf(template: dict, values: dict) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.lib.utils import simpleSplit
    from reportlab.platypus import KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    blocks = render_blocks(template, values)
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4, leftMargin=2.3 * cm, rightMargin=2.3 * cm, topMargin=2 * cm, bottomMargin=2.4 * cm,
        title=template["title"], author="PocketLaw", subject=template.get("law", ""),
    )
    base = ParagraphStyle("base", fontName="Times-Roman", fontSize=11.5, leading=16, alignment=TA_JUSTIFY, spaceAfter=6)
    st = {
        "center_bold": ParagraphStyle("cb", parent=base, fontName="Times-Bold", alignment=TA_CENTER, spaceAfter=2),
        "center": ParagraphStyle("c", parent=base, alignment=TA_CENTER),
        "heading": ParagraphStyle("h", parent=base, fontName="Times-Bold", fontSize=12.5, alignment=TA_CENTER, spaceBefore=6, spaceAfter=10),
        "left": ParagraphStyle("l", parent=base, alignment=TA_LEFT, spaceAfter=0),
        "right": ParagraphStyle("r", parent=base, alignment=TA_RIGHT, spaceAfter=0),
        "bold": ParagraphStyle("b", parent=base, fontName="Times-Bold", alignment=TA_LEFT, spaceBefore=6),
        "numbered": ParagraphStyle("n", parent=base, leftIndent=24, bulletIndent=0, bulletFontName="Times-Roman", bulletFontSize=11.5),
        "prayer": ParagraphStyle("p", parent=base, leftIndent=46, bulletIndent=20, bulletFontName="Times-Roman", bulletFontSize=11.5),
        "role": ParagraphStyle("role", parent=base, fontName="Times-Bold", alignment=TA_RIGHT),
    }

    def P(text, style):
        return Paragraph(escape(pdf_safe(text)), style)

    story = []
    for b in blocks:
        k = b["kind"]
        if k == "court_heading":
            story.append(P(b["text"], st["center_bold"]))
        elif k == "case_no":
            story.append(Spacer(1, 4))
            story.append(P(b["text"], st["center"]))
        elif k == "party":
            left = [P(line, st["left"]) for line in b["lines"]]
            tbl = Table([[left, P(b["role"], st["role"])]], colWidths=[10.5 * cm, 5.9 * cm])
            tbl.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "BOTTOM"), ("LEFTPADDING", (0, 0), (-1, -1), 0),
                                     ("RIGHTPADDING", (0, 0), (-1, -1), 0)]))
            story += [Spacer(1, 6), tbl]
        elif k == "versus":
            story += [Spacer(1, 6), P(b["text"], st["center_bold"])]
        elif k == "heading":
            story += [Spacer(1, 8), Paragraph(f"<u>{escape(pdf_safe(b['text']))}</u>", st["heading"])]
        elif k == "delivery":
            story.append(Paragraph(f"<b>{escape(b['text'])}</b>", st["left"]))
        elif k == "date_place":
            style = st["right"] if b.get("align") == "right" else st["left"]
            story += [Spacer(1, 4)] + [P(line, style) for line in b["lines"]] + [Spacer(1, 8)]
        elif k == "to":
            story += [P(line, st["left"]) for line in b["lines"]] + [Spacer(1, 10)]
        elif k == "subject":
            story.append(Paragraph(f"<b>Subject:</b> {escape(pdf_safe(b['text']))}", base))
            story.append(Spacer(1, 4))
        elif k == "salutation":
            story.append(P(b["text"], st["left"]))
            story.append(Spacer(1, 6))
        elif k == "para":
            story.append(P(b["text"], base))
        elif k == "numbered":
            story.append(Paragraph(escape(pdf_safe(b["text"])), st["numbered"], bulletText=f"{b['num']}."))
        elif k == "section_heading":
            style = st["heading"] if b.get("center") else st["bold"]
            story.append(Paragraph(f"<u>{escape(b['text'])}</u>" if b.get("center") else escape(b["text"]), style))
        elif k == "prayer_intro":
            story.append(P(b["text"], base))
        elif k == "prayer_item":
            story.append(Paragraph(escape(pdf_safe(b["text"])), st["prayer"], bulletText=b["label"]))
        elif k == "signoff":
            lines = [P(line, st["right"]) if line else Spacer(1, 10) for line in b["lines"]]
            story.append(KeepTogether([Spacer(1, 12)] + lines))
        elif k == "enclosures":
            items = [P("Enclosures:", st["bold"])]
            items += [P(f"{i}. {e}", st["left"]) for i, e in enumerate(b["items"], 1)]
            story.append(KeepTogether([Spacer(1, 10)] + items))

    disclaimer = "Prepared with PocketLaw (general legal information, not legal advice). Review the contents and consult an advocate before filing."

    def footer(canvas, d):
        canvas.saveState()
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(colors.grey)
        width = A4[0] - d.leftMargin - d.rightMargin
        y = 1.3 * cm
        for line in simpleSplit(disclaimer, "Helvetica", 7.5, width - 2 * cm):
            canvas.drawString(d.leftMargin, y, line)
            y -= 9
        canvas.drawRightString(A4[0] - d.rightMargin, 1.3 * cm, f"Page {d.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return buf.getvalue()


def safe_filename(template: dict, values: dict) -> str:
    who = next((values[k] for k in values if k.endswith("_name") and isinstance(values[k], str) and values[k]), "")
    slug = re.sub(r"[^A-Za-z0-9]+", "_", f"{template['id']}_{who}").strip("_")[:80]
    return f"{slug or template['id']}.pdf"
