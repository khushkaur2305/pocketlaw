// Port of backend/services/drafting.py: validate form input, fill a template, lay it out as blocks.
// Template syntax:  {field}  -> value (blank line if empty)
//                   [[ ... ]] -> optional fragment, kept only if every {field} inside has a value
//                   {"if": "field", "text": "..."} list items are included only when the field is set.
// Computed values: {today}, {year}, {para_count}, {<number field>_words}.

export const BLANK = "__________";
const MAX_LEN = { text: 200, tel: 20, email: 120, textarea: 4000, select: 300, date: 10, number: 15 };
const PHONE_RE = /^[0-9+\-\s()]{6,20}$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const COND_RE = /\[\[([\s\S]+?)\]\]/g;
const FIELD_RE = /\{(\w+)\}/g;
const LIST_PREFIX_RE = /^\s*(?:\d+[.)]|[-*•]|\([a-z0-9]+\))\s+/;

// ------------------------------------------------------------------ dates

/** Parse YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY or DD.MM.YYYY into a UTC Date, or null. */
export function parseDate(value) {
  let y, m, d;
  let r = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (r) [, y, m, d] = r;
  else if ((r = /^(\d{2})[-/.](\d{2})[-/.](\d{4})$/.exec(value))) [, d, m, y] = r;
  else return null;
  const dt = new Date(Date.UTC(+y, +m - 1, +d));
  return dt.getUTCFullYear() === +y && dt.getUTCMonth() === +m - 1 && dt.getUTCDate() === +d ? dt : null;
}

const pad = (n) => String(n).padStart(2, "0");
const fmtDate = (dt) => `${pad(dt.getUTCDate())}-${pad(dt.getUTCMonth() + 1)}-${dt.getUTCFullYear()}`;

function todayUtc(now = new Date()) {
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}
const daysBetween = (a, b) => Math.round((b - a) / 86400000);

// ------------------------------------------------------------------ validation

/** Returns {values, errors}; values hold typed values (Date, number, boolean, string or null). */
export function validate(template, raw = {}) {
  const values = {};
  const errors = {};
  for (const f of template.fields) {
    const { name } = f;
    const type = f.type || "text";
    let v = raw[name] !== undefined ? raw[name] : f.default;
    if (type === "checkbox") {
      values[name] = [true, "true", "on", "yes", "1", 1].includes(v);
      continue;
    }
    v = v === undefined || v === null ? "" : String(v).trim();
    if (!v) {
      if (f.required) errors[name] = `${f.label} is required.`;
      values[name] = null;
      continue;
    }
    const max = MAX_LEN[type] || 200;
    if (v.length > max) {
      errors[name] = `${f.label} is too long (max ${max} characters).`;
      continue;
    }
    if (type === "tel" && !PHONE_RE.test(v)) errors[name] = "Enter a valid phone number.";
    else if (type === "email" && !EMAIL_RE.test(v)) errors[name] = "Enter a valid email address.";
    else if (type === "date") {
      const d = parseDate(v);
      if (!d) errors[name] = "Enter a valid date.";
      else values[name] = d;
      continue;
    } else if (type === "number") {
      const n = Number(v.replace(/,/g, ""));
      if (!Number.isFinite(n) || n < 0) errors[name] = "Enter a valid positive number.";
      else values[name] = n;
      continue;
    } else if (type === "select" && !(f.options || []).includes(v)) errors[name] = "Choose one of the listed options.";
    values[name] = v;
  }
  return { values, errors };
}

export function checkWarnings(template, values, now) {
  const warnings = [];
  const today = todayUtc(now);
  for (const c of template.checks || []) {
    if (c.type === "max_days_since") {
      const d = values[c.field];
      if (d && daysBetween(d, today) > c.days) warnings.push(c.message);
    } else if (c.type === "max_days_between") {
      const a = values[c.from];
      const b = values[c.to];
      if (a && b && daysBetween(a, b) > c.days) warnings.push(c.message);
    }
  }
  return warnings;
}

// ------------------------------------------------------------------ formatting

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven",
  "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

const belowHundred = (n) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]} ${ONES[n % 10]}`.trim());

function belowThousand(n) {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const parts = [];
  if (h) parts.push(`${ONES[h]} Hundred`);
  if (rest) parts.push(belowHundred(rest));
  return parts.join(" ");
}

/** 12500000 -> "One Crore Twenty Five Lakh" */
export function numberToWordsIndian(n) {
  n = Math.floor(n);
  if (n === 0) return "Zero";
  const parts = [];
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  if (crore) parts.push(`${numberToWordsIndian(crore)} Crore`);
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`);
  if (thousand) parts.push(`${belowHundred(thousand)} Thousand`);
  if (n) parts.push(belowThousand(n));
  return parts.join(" ");
}

/** 1234567.5 -> "12,34,567.50" (Indian digit grouping) */
export function formatInr(n) {
  const whole = Math.floor(n);
  const frac = Math.round((n - whole) * 100);
  let s = String(whole);
  if (s.length > 3) {
    const head = s.slice(0, -3);
    const tail = s.slice(-3);
    s = `${head.replace(/\B(?=(\d{2})+$)/g, ",")},${tail}`;
  }
  return frac ? `${s}.${String(frac).padStart(2, "0")}` : s;
}

export function buildContext(template, values, now) {
  const today = todayUtc(now);
  const ctx = { today: fmtDate(today), year: String(today.getUTCFullYear()) };
  for (const f of template.fields) {
    const { name } = f;
    const type = f.type || "text";
    const v = values[name];
    if (type === "checkbox") ctx[name] = v ? "yes" : "";
    else if (v === null || v === undefined || v === "") ctx[name] = "";
    else if (type === "date") ctx[name] = fmtDate(v);
    else if (type === "number") {
      const money = /amount|salary|cost|income/.test(name);
      ctx[name] = money ? formatInr(v) : Number.isInteger(v) ? String(v) : String(v);
      ctx[`${name}_words`] = `Rupees ${numberToWordsIndian(v)} only`;
    } else ctx[name] = v;
  }
  return ctx;
}

export function fill(text, ctx, inline = true) {
  const withCond = text.replace(COND_RE, (_, inner) => {
    const needed = [...inner.matchAll(FIELD_RE)].map((m) => m[1]);
    return needed.every((n) => ctx[n]) ? inner : "";
  });
  const out = withCond.replace(FIELD_RE, (_, name) => {
    const v = ctx[name];
    if (!v) return BLANK;
    return inline ? v.replace(/\s*\n\s*/g, ", ") : v;
  });
  return out.replace(/[ \t]{2,}/g, " ").trim();
}

export function resolveItems(items, ctx, inline = true) {
  const out = [];
  for (let item of items || []) {
    if (typeof item === "object") {
      if (item.if && !ctx[item.if]) continue;
      item = item.text;
    }
    const text = fill(item, ctx, inline);
    if (text) out.push(text);
  }
  return out;
}

export function resolveLines(lines, ctx) {
  const out = [];
  for (const line of lines || []) {
    if (line === "") {
      out.push("");
      continue;
    }
    const text = fill(line, ctx, false);
    if (text) out.push(...text.split("\n").map((p) => p.trim()).filter(Boolean));
  }
  return out;
}

export function splitPoints(text) {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .filter((ln) => ln.trim())
    .map((ln) => ln.replace(LIST_PREFIX_RE, "").trim());
}

// ------------------------------------------------------------------ blocks

/** Ordered layout blocks shared by the on-screen preview and the PDF renderer. */
export function renderBlocks(template, values, now) {
  const doc = template.document;
  const ctx = buildContext(template, values, now);
  const blocks = [];
  const add = (kind, extra) => blocks.push({ kind, ...extra });

  for (const line of resolveItems(doc.court_heading, ctx)) add("court_heading", { text: line });
  if (doc.case_no) add("case_no", { text: fill(doc.case_no, ctx) });
  for (const p of doc.parties || []) {
    if (p.versus) add("versus", { text: "VERSUS" });
    else add("party", { lines: resolveLines(p.lines, ctx), role: p.role });
  }
  if (doc.heading) add("heading", { text: fill(doc.heading, ctx) });
  if (doc.mode_of_delivery) add("delivery", { text: doc.mode_of_delivery });
  if (doc.date_place === "top") add("date_place", { lines: [`Date: ${ctx.today}`, `Place: ${ctx.place || BLANK}`], align: "right" });
  if (doc.to) add("to", { lines: resolveLines(doc.to, ctx) });
  if (doc.subject) add("subject", { text: fill(doc.subject, ctx) });
  if (doc.salutation) add("salutation", { text: doc.salutation });
  for (const para of resolveItems(doc.intro, ctx)) add("para", { text: para });

  let n = 0;
  for (const para of resolveItems(doc.pre_facts, ctx)) add("numbered", { num: ++n, text: para });
  const facts = splitPoints(values[doc.facts_field || ""] || "");
  if (facts.length) {
    if (doc.facts_heading) add("section_heading", { text: doc.facts_heading });
    for (const fact of facts) add("numbered", { num: ++n, text: fact });
  }
  for (const para of resolveItems(doc.paragraphs, ctx)) add("numbered", { num: ++n, text: para });
  ctx.para_count = String(n);

  const legal = resolveItems(doc.legal_basis, ctx);
  if (legal.length) {
    add("section_heading", { text: doc.legal_basis_heading || "Legal basis" });
    for (const para of legal) add("para", { text: para });
  }

  const prayer = resolveItems(doc.prayer, ctx);
  if (prayer.length) {
    if (doc.prayer_intro) add("prayer_intro", { text: doc.prayer_intro });
    prayer.forEach((item, i) => add("prayer_item", { label: `(${String.fromCharCode(97 + i)})`, text: item }));
  }

  for (const para of resolveItems(doc.closing, ctx)) add("para", { text: para });

  if (doc.date_place === "bottom") add("date_place", { lines: [`Place: ${ctx.place || BLANK}`, `Date: ${ctx.today}`], align: "left" });
  add("signoff", { lines: resolveLines(doc.signoff, ctx) });

  if (doc.verification) {
    add("section_heading", { text: doc.verification_heading || "VERIFICATION", center: true });
    for (const para of resolveItems(doc.verification, ctx)) add("para", { text: para });
    add("signoff", { lines: resolveLines(doc.verification_signoff, ctx) });
  }

  const enclosures = splitPoints(values[doc.enclosures_field || ""] || "");
  if (enclosures.length) add("enclosures", { items: enclosures });
  return blocks;
}

// ------------------------------------------------------------------ PDF helpers

const REPLACEMENTS = { "₹": "Rs. ", "‘": "'", "’": "'", "“": '"', "”": '"',
  "–": "-", "—": "-", "…": "...", " ": " " };

function replaceSymbols(text) {
  let t = text;
  for (const [a, b] of Object.entries(REPLACEMENTS)) t = t.split(a).join(b);
  return t;
}

/** The built-in PDF fonts cover Latin-1 only: replace common symbols and turn the rest into '?'. */
export function pdfSafe(text) {
  return replaceSymbols(text).replace(/[^\x00-\xff]/g, "?");
}

/** True if any value contains characters (e.g. Hindi/Punjabi script) the PDF fonts cannot show. */
export function hasUnsupportedChars(values) {
  return Object.values(values).some((v) => typeof v === "string" && /[^\x00-\xff]/.test(replaceSymbols(v)));
}

export function warningsFor(template, values, now) {
  const warnings = checkWarnings(template, values, now);
  if (hasUnsupportedChars(values)) {
    warnings.push(
      "Some characters (for example Hindi or Punjabi script) cannot be shown in the PDF and will appear as '?'. Please fill the form in English."
    );
  }
  return warnings;
}

export function safeFilename(template, values) {
  const who = Object.keys(values).find((k) => k.endsWith("_name") && typeof values[k] === "string" && values[k]);
  const slug = `${template.id}_${who ? values[who] : ""}`.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80);
  return `${slug || template.id}.pdf`;
}
