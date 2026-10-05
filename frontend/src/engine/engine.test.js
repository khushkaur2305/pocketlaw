// The browser engine must reproduce the Python (scikit-learn) results exported in public/data/parity.json.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { KB_FILES, buildKb } from "./kb.js";
import { match } from "./matcher.js";
import {
  BLANK,
  formatInr,
  numberToWordsIndian,
  renderBlocks,
  validate,
  warningsFor,
} from "./drafting.js";
import { renderPdf } from "./pdf.js";

const dataDir = fileURLToPath(new URL("../../public/data/", import.meta.url));
const read = (name) => JSON.parse(readFileSync(dataDir + name, "utf8"));
const kb = buildKb(Object.fromEntries(Object.entries(KB_FILES).map(([k, f]) => [k, read(f)])));
const parity = read("parity.json");

// Same expectations as backend/tests/test_matcher.py
const CASES = [
  ["My employer has not paid my salary for the last three months", "cow_17", "salary_unpaid"],
  ["Police are refusing to register my FIR for a stolen phone", "bnss_173_4", "fir_refused"],
  ["My husband beats me and his mother keeps demanding dowry", "bns_85", "domestic_violence"],
  ["I bought a phone online, it is defective and the seller refuses a refund", "cpa_2_47", "consumer_complaint"],
  ["Someone called pretending to be from my bank and took money through UPI", "rbi_liability", "cyber_fraud"],
  ["The cheque my friend gave me for the loan has bounced", "nia_138", "cheque_bounce"],
  ["My landlord is not returning my security deposit", "mta_2021", "tenancy_dispute"],
  ["My manager touches me inappropriately at the office", "posh_2n", "workplace_harassment"],
  ["I was hit by a car and the driver ran away", "mva_161", "road_accident"],
  ["My son took my house and does not take care of me", "mwpsc_4", "senior_citizen"],
  ["Police arrested my brother last night and are not telling us why", "bnss_47", "arrest_rights"],
  ["I want to know the status of my pension file in the government office", "rti_3", "rti_request"],
  ["Upper caste neighbours insulted me using my caste name in public", "poa_3", "caste_atrocity"],
];

describe("parity with scikit-learn", () => {
  for (const p of parity) {
    it(`expands and vectorises: ${p.query}`, () => {
      expect(kb.expander.expand(p.query)).toBe(p.expanded);
      const vec = kb.index.transform(p.expanded);
      const js = Object.fromEntries([...vec].map(([c, w]) => [kb.index.vocab[c], w]));
      expect(Object.keys(js).sort()).toEqual(Object.keys(p.weights).sort());
      for (const [term, w] of Object.entries(p.weights)) expect(js[term]).toBeCloseTo(w, 4);
    });

    it(`ranks the same laws, guide and confidence: ${p.query}`, () => {
      const r = match(kb, p.query);
      expect(r.laws.slice(0, 3).map((l) => l.id)).toEqual(p.top_laws);
      expect(r.guide ? r.guide.id : null).toBe(p.guide);
      expect(r.confidence).toBe(p.confidence);
    });
  }
});

describe("law matcher", () => {
  for (const [query, lawId, guideId] of CASES) {
    it(query, () => {
      const r = match(kb, query);
      expect(r.laws.slice(0, 3).map((l) => l.id)).toContain(lawId);
      expect(r.guide?.id).toBe(guideId);
      expect(r.templates.length).toBeGreaterThan(0);
    });
  }

  it("does not guess for unrelated questions", () => {
    const r = match(kb, "what is the weather like today");
    expect(r.strong_match).toBe(false);
    expect(r.laws).toEqual([]);
  });
});

describe("document drafting", () => {
  const sample = (f) =>
    ({ date: "2026-09-01", number: "15000", tel: "9876543210", email: "a@b.in", select: (f.options || [""])[0] })[f.type] ??
    "Sample text";

  for (const t of kb.templates) {
    it(`renders ${t.id} with required fields only`, () => {
      const raw = Object.fromEntries(t.fields.filter((f) => f.required).map((f) => [f.name, sample(f)]));
      const { values, errors } = validate(t, raw);
      expect(errors).toEqual({});
      const blocks = renderBlocks(t, values);
      const text = blocks.map((b) => [b.text, ...(b.lines || [])].join(" ")).join(" ");
      expect(text).not.toMatch(/\{|\[\[/);
      const pdf = renderPdf(t, blocks).output("arraybuffer");
      expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe("%PDF-");
      expect(pdf.byteLength).toBeGreaterThan(2000);
    });
  }

  it("reports field errors", () => {
    const t = kb.templates.find((x) => x.id === "police_complaint");
    const { errors } = validate(t, { complainant_phone: "abc" });
    expect(errors.complainant_name).toBeTruthy();
    expect(errors.complainant_phone).toBe("Enter a valid phone number.");
  });

  it("fills optional fragments and leaves blanks for missing values", () => {
    const t = kb.templates.find((x) => x.id === "consumer_complaint");
    const { values } = validate(t, {
      complainant_name: "Asha", complainant_address: "Ludhiana", complainant_phone: "9876543210", district: "Ludhiana",
      op_name: "XYZ", op_address: "Chandigarh", product_service: "fridge", purchase_date: "2026-05-01",
      amount_paid: "32000", facts: "Stopped cooling.\nNo repair.", refund_amount: "32000", compensation_amount: "20000",
    });
    const blocks = renderBlocks(t, values);
    const first = blocks.find((b) => b.kind === "numbered").text;
    expect(first).toContain("Rs. 32,000");
    expect(first).not.toContain("invoice/order no.");
    expect(blocks.filter((b) => b.kind === "prayer_item").length).toBe(4); // optional litigation cost dropped
    const verification = blocks.find((b) => b.kind === "para" && b.text.includes("paragraphs 1 to"));
    expect(verification.text).toContain("paragraphs 1 to 6");
    expect(blocks.find((b) => b.kind === "date_place").lines[0]).toBe(`Place: ${BLANK}`);
  });

  it("warns about a stale cheque return memo and non-Latin text", () => {
    const t = kb.templates.find((x) => x.id === "cheque_bounce_notice");
    const { values } = validate(t, { return_memo_date: "2020-01-01", sender_name: "रवि" });
    const w = warningsFor(t, values);
    expect(w.some((m) => m.includes("more than 30 days"))).toBe(true);
    expect(w.some((m) => m.includes("Hindi or Punjabi"))).toBe(true);
  });

  it("formats Indian numbers", () => {
    expect(formatInr(1234567)).toBe("12,34,567");
    expect(formatInr(32000)).toBe("32,000");
    expect(formatInr(1500.5)).toBe("1,500.50");
    expect(numberToWordsIndian(250000)).toBe("Two Lakh Fifty Thousand");
    expect(numberToWordsIndian(12500000)).toBe("One Crore Twenty Five Lakh");
  });
});
