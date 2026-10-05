// Render drafting blocks to an A4 PDF with jsPDF (replaces the ReportLab renderer for the static site).
import { jsPDF } from "jspdf";
import { pdfSafe } from "./drafting.js";

const PT_PER_CM = 28.3465;
const PAGE = { w: 595.28, h: 841.89 };
const MARGIN = { left: 2.3 * PT_PER_CM, right: 2.3 * PT_PER_CM, top: 2 * PT_PER_CM, bottom: 2.4 * PT_PER_CM };
const BODY = { font: "times", size: 11.5, leading: 16 };
const DISCLAIMER =
  "Prepared with PocketLaw (general legal information, not legal advice). Review the contents and consult an advocate before filing.";

export function renderPdf(template, blocks) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  doc.setProperties({ title: template.title, author: "PocketLaw", subject: template.law || "" });
  const width = PAGE.w - MARGIN.left - MARGIN.right;
  const right = PAGE.w - MARGIN.right;
  let y = MARGIN.top;

  const setFont = (style = "normal", size = BODY.size) => {
    doc.setFont(BODY.font, style);
    doc.setFontSize(size);
  };
  const ensure = (h) => {
    if (y + h > PAGE.h - MARGIN.bottom) {
      doc.addPage();
      y = MARGIN.top;
    }
  };
  // jsPDF's y is the text baseline; keep y as the top of the next line.
  const baseline = () => y + BODY.size * 0.8;

  function justifyLine(line, x, w) {
    const words = line.split(/ +/).filter(Boolean);
    if (words.length < 2) {
      doc.text(line, x, baseline());
      return;
    }
    const wordsWidth = words.reduce((s, word) => s + doc.getTextWidth(word), 0);
    const gap = (w - wordsWidth) / (words.length - 1);
    // Fall back to plain spacing if stretching would look odd (very short lines).
    if (gap > doc.getTextWidth(" ") * 4) {
      doc.text(line, x, baseline());
      return;
    }
    let cx = x;
    for (const word of words) {
      doc.text(word, cx, baseline());
      cx += doc.getTextWidth(word) + gap;
    }
  }

  /** Draw wrapped text. align: left | right | center | justify. */
  function paragraph(text, { x = MARGIN.left, w = width, align = "justify", style = "normal", size = BODY.size, after = 6, underline = false } = {}) {
    setFont(style, size);
    const lines = doc.splitTextToSize(pdfSafe(text), w);
    lines.forEach((line, i) => {
      ensure(BODY.leading);
      const last = i === lines.length - 1;
      if (align === "justify" && !last) justifyLine(line, x, w);
      else if (align === "center") doc.text(line, x + w / 2, baseline(), { align: "center" });
      else if (align === "right") doc.text(line, x + w, baseline(), { align: "right" });
      else doc.text(line, x, baseline());
      if (underline) {
        const lw = doc.getTextWidth(line);
        const lx = align === "center" ? x + (w - lw) / 2 : x;
        doc.setLineWidth(0.6);
        doc.line(lx, baseline() + 1.6, lx + lw, baseline() + 1.6);
      }
      y += BODY.leading;
    });
    y += after;
  }

  /** Text with a hanging label, e.g. "1." or "(a)". */
  function hanging(label, text, labelX, textX, after = 6) {
    setFont();
    const w = right - textX;
    const lines = doc.splitTextToSize(pdfSafe(text), w);
    lines.forEach((line, i) => {
      ensure(BODY.leading);
      if (i === 0) doc.text(label, labelX, baseline());
      if (i < lines.length - 1) justifyLine(line, textX, w);
      else doc.text(line, textX, baseline());
      y += BODY.leading;
    });
    y += after;
  }

  const space = (h) => {
    y += h;
  };

  for (const b of blocks) {
    switch (b.kind) {
      case "court_heading":
        paragraph(b.text, { align: "center", style: "bold", after: 2 });
        break;
      case "case_no":
        space(4);
        paragraph(b.text, { align: "center" });
        break;
      case "party": {
        space(6);
        setFont();
        const leftW = 10.5 * PT_PER_CM;
        const lines = b.lines.flatMap((l) => doc.splitTextToSize(pdfSafe(l), leftW));
        ensure(lines.length * BODY.leading);
        lines.forEach((line, i) => {
          doc.text(line, MARGIN.left, baseline());
          if (i === lines.length - 1) {
            setFont("bold");
            doc.text(pdfSafe(b.role), right, baseline(), { align: "right" });
            setFont();
          }
          y += BODY.leading;
        });
        break;
      }
      case "versus":
        space(6);
        paragraph(b.text, { align: "center", style: "bold", after: 2 });
        break;
      case "heading":
        space(8);
        paragraph(b.text, { align: "center", style: "bold", size: 12.5, underline: true, after: 10 });
        break;
      case "delivery":
        paragraph(b.text, { align: "left", style: "bold", after: 0 });
        break;
      case "date_place":
        space(4);
        for (const line of b.lines) paragraph(line, { align: b.align === "right" ? "right" : "left", after: 0 });
        space(8);
        break;
      case "to":
        for (const line of b.lines) paragraph(line, { align: "left", after: 0 });
        space(10);
        break;
      case "subject": {
        setFont("bold");
        const label = "Subject: ";
        const lw = doc.getTextWidth(label);
        setFont();
        const lines = doc.splitTextToSize(pdfSafe(b.text), width - lw);
        lines.forEach((line, i) => {
          ensure(BODY.leading);
          if (i === 0) {
            setFont("bold");
            doc.text(label, MARGIN.left, baseline());
            setFont();
          }
          doc.text(line, MARGIN.left + lw, baseline());
          y += BODY.leading;
        });
        space(10);
        break;
      }
      case "salutation":
        paragraph(b.text, { align: "left", after: 6 });
        break;
      case "para":
      case "prayer_intro":
        paragraph(b.text);
        break;
      case "numbered":
        hanging(`${b.num}.`, b.text, MARGIN.left, MARGIN.left + 24);
        break;
      case "prayer_item":
        hanging(b.label, b.text, MARGIN.left + 20, MARGIN.left + 46);
        break;
      case "section_heading":
        space(6);
        paragraph(b.text, { align: b.center ? "center" : "left", style: "bold", underline: !!b.center, after: 6 });
        break;
      case "signoff": {
        const h = 12 + b.lines.reduce((s, l) => s + (l ? BODY.leading : 10), 0);
        ensure(h); // keep the signature block together
        space(12);
        for (const line of b.lines) {
          if (line) paragraph(line, { align: "right", after: 0 });
          else space(10);
        }
        break;
      }
      case "enclosures": {
        ensure(26 + BODY.leading * Math.min(b.items.length, 4));
        space(10);
        paragraph("Enclosures:", { align: "left", style: "bold", after: 2 });
        b.items.forEach((e, i) => paragraph(`${i + 1}. ${e}`, { align: "left", after: 0 }));
        break;
      }
      default:
        break;
    }
  }

  // Footer on every page.
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(128);
    const lines = doc.splitTextToSize(DISCLAIMER, width - 2 * PT_PER_CM);
    let fy = PAGE.h - 1.3 * PT_PER_CM;
    for (const line of lines) {
      doc.text(line, MARGIN.left, fy);
      fy += 9;
    }
    doc.text(`Page ${p}`, right, PAGE.h - 1.3 * PT_PER_CM, { align: "right" });
    doc.setTextColor(0);
  }
  return doc;
}
