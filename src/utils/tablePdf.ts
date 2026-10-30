/**
 * Report PDFs — mobile counterparts of the web console's downloadTablePdf
 * (stuffed list and similar) and downloadPackingListPdf: letterhead, title,
 * details and a table inside the company form frame (pdfFrame.ts), rendered
 * with expo-print and saved to Downloads.
 */
import { downloadPdf } from "./downloads";
import { A4_LANDSCAPE, A4_PORTRAIT, esc, framedDocument, framedSheet } from "./pdfFrame";
import { LOGO_DATA_URI } from "./pdfLogo";

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

const LANDSCAPE_STYLE = "@page { size: A4 landscape; } body { font-size: 8.5pt; } .content td, .content th { padding: 4px 5px; }";

const page = (title: string, content: string, landscape = false) => framedDocument([framedSheet(title, content)], landscape ? LANDSCAPE_STYLE : "");
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
function packingListSheet(p: PackingListPdf): string {
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
  return framedSheet(
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

/** The company's printed delivery note form (DELVRY NOTE.pdf). */
const DELIVERY_NOTE_STYLE = `
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: Helvetica, Arial, sans-serif; color: #000; font-size: 10pt; margin: 0; }
  .sheet + .sheet { page-break-before: always; break-before: page; }
  .box { border: 1.2pt solid #000; }
  .logo { text-align: center; padding: 10px 8px 4px; border-bottom: 0.8pt solid #000; position: relative; }
  .logo img { height: 66px; }
  .logo .phone { text-align: right; font-size: 8.5pt; margin-top: 4px; }
  .title { text-align: center; font-weight: bold; font-size: 13pt; padding: 8px 0; border-bottom: 0.8pt solid #000; }
  .bar { display: flex; justify-content: space-between; font-weight: bold; padding: 8px 14px; border-bottom: 0.8pt solid #000; }
  .consignee { padding: 9px 14px 12px; border-bottom: 0.8pt solid #000; line-height: 1.45; }
  .consignee .label { font-weight: bold; font-size: 9pt; margin-bottom: 4px; }
  .bundles { padding: 9px 14px; border-bottom: 0.8pt solid #000; }
  table { width: 100%; border-collapse: collapse; }
  th { font-weight: bold; font-size: 9pt; padding: 8px 6px; border-bottom: 0.8pt solid #000; text-align: center; }
  td { padding: 6px 8px; vertical-align: top; }
  th + th, td + td { border-left: 0.8pt solid #000; }
  .c { text-align: center; }
  .total td { border-top: 0.8pt solid #000; font-weight: bold; padding: 12px 8px; }
  .total td + td { border-left: none; }
  .sign { display: flex; justify-content: space-between; font-weight: bold; font-size: 9pt; margin-top: 30mm; padding: 0 2px; }
`;

const dmy = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

/** One delivery note page: booking, date, consignee, bundle count, then each product line with its bundle as the remark. */
function deliveryNoteSheet(p: DeliveryNotePdf): string {
  const totalQty = p.rows.reduce((n, r) => n + (Number(r.qty) || 0), 0);
  const bundles = new Set(p.rows.map((r) => r.bundleNo).filter(Boolean)).size;
  const consignee = [`<b>${esc(p.receiver.name)}</b>`, ...p.receiver.lines.filter(Boolean).map((l) => esc(l.replace(/^Ph:\s*/, "")))].join("<br/>");
  const rows = p.rows
    .map(
      (r, i) =>
        `<tr><td class="c">${i + 1}</td><td>${esc(r.product)}${r.qty ? ` – ${esc(r.qty)} pcs` : ""}</td><td class="c">${r.bundleNo ? `Bundle ${esc(r.bundleNo)}` : ""}</td></tr>`
    )
    .join("");
  // Keep the item area as tall as the printed form.
  const filler = Math.max(40, 360 - p.rows.length * 28);
  return `<section class="sheet">
  <div class="box">
    <div class="logo"><img src="${LOGO_DATA_URI}" alt="Introlines Merchant Exports"/><div class="phone">00971 56 504 9779</div></div>
    <div class="title">DELIVERY NOTE</div>
    <div class="bar"><span>BOOKING ID: ${esc(p.lrNo)}</span><span>DATE:${dmy(new Date())}</span></div>
    <div class="consignee"><div class="label">CONSIGNEE DETAILS</div>${consignee}</div>
    <div class="bundles">No of Bundles${bundles ? `: <b>${bundles}</b>` : ""}</div>
    <table>
      <thead><tr><th style="width:10%">SI NO</th><th>DESCRIPTION</th><th style="width:18%">REMARKS</th></tr></thead>
      <tbody>${rows}<tr><td style="height:${filler}px"></td><td></td><td></td></tr></tbody>
      <tfoot><tr class="total"><td></td><td>TOTAL${totalQty ? ` &nbsp; ${totalQty} pcs` : ""}</td><td></td></tr></tfoot>
    </table>
  </div>
  <div class="sign"><span style="margin-top:6px">RECEIVERS SIGN</span><span style="margin-right:30px">SIGNATURE</span></div>
</section>`;
}

/** Delivery notes as one document, one page each, in the company's delivery note form. */
function deliveryNotesHtml(notes: DeliveryNotePdf[]): string {
  return `<!doctype html><html><head><meta charset="utf-8"/><style>${DELIVERY_NOTE_STYLE}</style></head><body>${notes.map(deliveryNoteSheet).join("")}</body></html>`;
}
/** Renders the table to `<fileName>` in Downloads (A4 in points; Android ignores @page size). */
export const downloadTablePdf = (fileName: string, pdf: TablePdf) =>
  downloadPdf({ fileName, html: tableHtml(pdf), size: pdf.landscape ? A4_LANDSCAPE : A4_PORTRAIT });

/** A single delivery note as a printable HTML page (for saving straight to Downloads). */
export const deliveryNoteHtml = (note: DeliveryNotePdf) => deliveryNotesHtml([note]);

/** Renders a booking's packing list to `<fileName>` in Downloads. */
export const downloadPackingListPdf = (fileName: string, pdf: PackingListPdf) => downloadPackingListsPdf(fileName, [pdf]);

/** Several bookings' packing lists in one PDF, each on its own framed page. */
export const downloadPackingListsPdf = (fileName: string, pdfs: PackingListPdf[]) =>
  downloadPdf({ fileName, html: framedDocument(pdfs.map(packingListSheet)), size: A4_PORTRAIT });
