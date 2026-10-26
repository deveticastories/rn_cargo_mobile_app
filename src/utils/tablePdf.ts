/**
 * Report PDFs — mobile counterparts of the web console's downloadTablePdf
 * (stuffed list and similar) and downloadPackingListPdf: letterhead, title,
 * details and a table, rendered with expo-print and handed to the share sheet.
 */
import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

const COMPANY = "INTROLINES PVT LTD";
const CONTACT = "Mob: +91 86818 00075 &nbsp;|&nbsp; Email: info@introlines.in";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface PdfTable {
  head: string[];
  body: string[][];
  foot?: string[];
}

export interface TablePdf extends PdfTable {
  title: string;
  info: [string, string][];
  /** Wide reports (many columns) print on landscape A4, like the web's. */
  landscape?: boolean;
  /** Further tables below the main one, each under its own heading. */
  sections?: (PdfTable & { heading: string; emptyText?: string })[];
}

const STYLE = `
  @page { size: A4; margin: 15mm; }
  body { font-family: Helvetica, Arial, sans-serif; color: #141414; font-size: 10pt; margin: 0; }
  .company { font-family: "Times New Roman", Times, serif; font-size: 22pt; font-weight: bold; margin: 0; }
  .contact { font-size: 10.5pt; margin: 4px 0 8px; }
  .title { font-family: "Times New Roman", Times, serif; font-size: 16pt; font-weight: bold; text-decoration: underline; margin: 0 0 12px; }
  table { width: 100%; border-collapse: collapse; }
  td, th { border: 0.6pt solid #969696; padding: 6px 7px; text-align: left; vertical-align: top; }
  th, .label, tfoot td { background: #d9d9d9; font-weight: bold; }
  .info { width: auto; margin-bottom: 16px; }
  .info td { min-width: 40mm; }
  .party td { height: 26mm; width: 50%; }
  h3 { font-family: "Times New Roman", Times, serif; font-size: 13pt; margin: 18px 0 6px; }
  .footnote { font-style: italic; font-size: 9.5pt; margin-top: 6px; }
`;

const page = (title: string, content: string, landscape = false) => `<!doctype html>
<html><head><meta charset="utf-8"/><style>${STYLE}${landscape ? "@page { size: A4 landscape; } body { font-size: 8.5pt; } td, th { padding: 4px 5px; }" : ""}</style></head>
<body>
  <p class="company">${COMPANY}</p>
  <p class="contact">${CONTACT}</p>
  <p class="title">${esc(title)}</p>
  ${content}
</body></html>`;

function tableHtml({ title, info, head, body, foot, sections = [], landscape }: TablePdf): string {
  const row = (cells: string[], tag: "td" | "th") => `<tr>${cells.map((c) => `<${tag}>${esc(c)}</${tag}>`).join("")}</tr>`;
  const table = (t: PdfTable, emptyText = "—") => `<table>
    <thead>${row(t.head, "th")}</thead>
    <tbody>${t.body.length ? t.body.map((r) => row(r, "td")).join("") : `<tr><td colspan="${t.head.length}">${esc(emptyText)}</td></tr>`}</tbody>
    ${t.foot ? `<tfoot>${row(t.foot, "td")}</tfoot>` : ""}
  </table>`;
  return page(
    title,
    `
  ${info.length ? `<table class="info">${info.map(([k, v]) => `<tr><td class="label">${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}</table>` : ""}
  ${table({ head, body, foot })}
  ${sections.map((sec) => `<h3>${esc(sec.heading)}</h3>${table(sec, sec.emptyText)}`).join("")}`,
    landscape
  );
}

export interface PdfParty {
  name: string;
  lines: string[];
}

export interface PackingListPdf {
  lrNo: string;
  bookingDate: string;
  sender: PdfParty;
  receiver: PdfParty;
  bundles: { bundleNo: number; items: { product: string; qty: string }[] }[];
}

/** Same layout as the web's packing list: one row per product, the bundle number spanning its products. */
function packingListHtml(p: PackingListPdf): string {
  const party = (x: PdfParty) => [x.name, ...x.lines.filter(Boolean)].map(esc).join("<br/>");
  let totalQty = 0;
  const rows = p.bundles
    .map((b) => {
      const items = b.items.length ? b.items : [{ product: "", qty: "" }];
      return items
        .map((it, i) => {
          totalQty += Number(it.qty) || 0;
          const bundleCell = i === 0 ? `<td rowspan="${items.length}" style="vertical-align:middle">${b.bundleNo}</td>` : "";
          return `<tr>${bundleCell}<td>${esc(it.product)}</td><td>${esc(it.qty)}</td></tr>`;
        })
        .join("");
    })
    .join("");
  return page(
    "PACKING LIST",
    `<table><tr>
    <td class="label" style="width:38mm">LR No.</td><td style="width:48mm">${esc(p.lrNo)}</td>
    <td class="label" style="width:38mm">Booking Date</td><td>${esc(p.bookingDate)}</td>
  </tr></table>
  <table class="party" style="margin-top:18px">
    <thead><tr><th>Sender Name &amp; Details</th><th>Customer Name (Receiver Name &amp; Details)</th></tr></thead>
    <tbody><tr><td>${party(p.sender)}</td><td>${party(p.receiver)}</td></tr></tbody>
  </table>
  <h3>Description</h3>
  <table>
    <thead><tr><th style="width:30mm">Bundle No</th><th>Products</th><th style="width:32mm">Product Qty</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td colspan="2">Total Qty</td><td>${totalQty || ""}</td></tr></tfoot>
  </table>
  <p class="footnote">Note: Each Bundle No covers all product lines listed beside it; add more rows under the same bundle for additional products.</p>`
  );
}

export interface DeliveryNotePdf {
  lrNo: string;
  bookingDate: string;
  sender: PdfParty;
  receiver: PdfParty;
  rows: { bundleNo: string; product: string; qty: string }[];
}

/** Same layout as the web's delivery note: at least 10 product rows, total qty, then the two signature lines. */
function deliveryNoteBody(p: DeliveryNotePdf): string {
  const party = (x: PdfParty) => [x.name, ...x.lines.filter(Boolean)].map(esc).join("<br/>");
  const totalQty = p.rows.reduce((n, r) => n + (Number(r.qty) || 0), 0);
  const rows = [...p.rows];
  while (rows.length < 10) rows.push({ bundleNo: "", product: "", qty: "" });
  return `<table><tr>
    <td class="label" style="width:38mm">LR No.</td><td style="width:48mm">${esc(p.lrNo)}</td>
    <td class="label" style="width:38mm">Booking Date</td><td>${esc(p.bookingDate)}</td>
  </tr></table>
  <table class="party" style="margin-top:18px">
    <thead><tr><th>Sender Name &amp; Details</th><th>Receiver Name &amp; Details</th></tr></thead>
    <tbody><tr><td>${party(p.sender)}</td><td>${party(p.receiver)}</td></tr></tbody>
  </table>
  <h3>Description</h3>
  <table>
    <thead><tr><th style="width:30mm">Bundle No</th><th>Products</th><th style="width:30mm">Qty</th></tr></thead>
    <tbody>${rows.map((r) => `<tr><td>${esc(r.bundleNo)}&nbsp;</td><td>${esc(r.product)}</td><td>${esc(r.qty)}</td></tr>`).join("")}</tbody>
    <tfoot><tr><td colspan="2">Total Qty</td><td>${totalQty || ""}</td></tr></tfoot>
  </table>
  <table style="margin-top:22mm"><tr>
    <td style="border:none;width:50%">Delivery Boy Name &amp; Signature</td>
    <td style="border:none">Receiver Name &amp; Signature</td>
  </tr></table>`;
}

/** Delivery notes as one document, each on its own page with its own letterhead. */
function deliveryNotesHtml(notes: DeliveryNotePdf[]): string {
  const sheets = notes.map(
    (n) => `<section class="sheet">
  <p class="company">${COMPANY}</p>
  <p class="contact">${CONTACT}</p>
  <p class="title">DELIVERY NOTE</p>
  ${deliveryNoteBody(n)}
</section>`
  );
  return `<!doctype html>
<html><head><meta charset="utf-8"/><style>${STYLE} .sheet + .sheet { page-break-before: always; break-before: page; }</style></head>
<body>${sheets.join("")}</body></html>`;
}

async function sharePdf(html: string, fileName: string, title: string, landscape = false): Promise<void> {
  // A4 in points; Android ignores @page size, so pass the page size explicitly too.
  const { uri } = await Print.printToFileAsync(landscape ? { html, width: 842, height: 595 } : { html });
  const target = `${FileSystem.cacheDirectory}${fileName.replace(/[^\w.-]/g, "_")}`;
  await FileSystem.deleteAsync(target, { idempotent: true });
  await FileSystem.moveAsync({ from: uri, to: target });
  await Sharing.shareAsync(target, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: title });
}

/** Renders the table to `<fileName>` and opens the share sheet (Save to Files/Drive, WhatsApp, email…). */
export const downloadTablePdf = (fileName: string, pdf: TablePdf) => sharePdf(tableHtml(pdf), fileName, pdf.title, pdf.landscape);

/** A single delivery note as a printable HTML page (for saving straight to Downloads). */
export const deliveryNoteHtml = (note: DeliveryNotePdf) => deliveryNotesHtml([note]);

/** Renders a booking's packing list to `<fileName>` and opens the share sheet. */
export const downloadPackingListPdf = (fileName: string, pdf: PackingListPdf) => sharePdf(packingListHtml(pdf), fileName, `Packing list ${pdf.lrNo}`);
