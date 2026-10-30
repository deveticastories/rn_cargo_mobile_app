/**
 * The company's printed invoice form (INVOICE.pdf): consignee, date, invoice
 * no, mark and packages; rows of commodity & pieces, particular (bundle type),
 * qty, rate per box and amount; then the total in words, both bank accounts and
 * the signature box. Used for booking invoices (one page per invoice).
 */
import { downloadPdf } from "./downloads";
import { A4_PORTRAIT, esc } from "./pdfFrame";
import { LOGO_DATA_URI } from "./pdfLogo";

export interface ConsigneeSheet {
  consignee: { name: string; lines: string[] };
  date: string;
  invoiceNo: string;
  mark: string;
  packages: string;
  /** `pieces`: one line per product, e.g. "Shirt – 40 pcs". Charge rows leave commodity empty. */
  rows: { bookingId?: string; commodity?: string; pieces?: string[]; particular: string; qty?: number; rate?: number; amount?: number }[];
  /** Printed total; defaults to the sum of the row amounts. */
  total?: number;
}

const amount = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ONES = ["", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN", "ELEVEN", "TWELVE", "THIRTEEN", "FOURTEEN", "FIFTEEN", "SIXTEEN", "SEVENTEEN", "EIGHTEEN", "NINETEEN"];
const TENS = ["", "", "TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY", "SEVENTY", "EIGHTY", "NINETY"];

/** 1500 → "ONE THOUSAND FIVE HUNDRED", as printed on the invoice. */
function inWords(n: number): string {
  const below1000 = (x: number): string => {
    const parts: string[] = [];
    if (x >= 100) parts.push(`${ONES[Math.floor(x / 100)]} HUNDRED`);
    const r = x % 100;
    if (r >= 20) parts.push([TENS[Math.floor(r / 10)], ONES[r % 10]].filter(Boolean).join(" "));
    else if (r > 0) parts.push(ONES[r]);
    return parts.join(" ");
  };
  const whole = Math.floor(n);
  if (whole === 0) return "ZERO";
  const scales: [number, string][] = [
    [1_000_000_000, "BILLION"],
    [1_000_000, "MILLION"],
    [1_000, "THOUSAND"],
  ];
  let rest = whole;
  const words: string[] = [];
  for (const [size, name] of scales) {
    if (rest >= size) {
      words.push(`${below1000(Math.floor(rest / size))} ${name}`);
      rest %= size;
    }
  }
  if (rest > 0) words.push(below1000(rest));
  const fils = Math.round((n - whole) * 100);
  return words.join(" ") + (fils ? ` AND ${below1000(fils)} FILS` : "");
}

const STYLE = `
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: Helvetica, Arial, sans-serif; color: #000; font-size: 9.5pt; margin: 0; }
  .sheet { border: 1.2pt solid #000; }
  .sheet + .sheet { page-break-before: always; break-before: page; }
  table { width: 100%; border-collapse: collapse; }
  td, th { border: 0.7pt solid #000; padding: 4px 6px; vertical-align: top; text-align: left; }
  .logo { text-align: center; padding: 6px 0 2px; border-bottom: 0.8pt solid #000; }
  .logo img { height: 74px; }
  .title { text-align: center; font-weight: bold; font-size: 13pt; padding: 7px 0; border-bottom: 0.8pt solid #000; }
  .head td { border-top: none; }
  .head td:first-child { border-left: none; }
  .head td:last-child { border-right: none; }
  .b { font-weight: bold; }
  .c { text-align: center; }
  .r { text-align: right; }
  .items td:first-child { border-left: none; }
  .items td:last-child { border-right: none; }
  .items th { text-align: center; font-weight: bold; }
  .items td { height: 26px; }
  .items .filler td { height: auto; border-top: none; border-bottom: none; }
  .wide td:first-child { border-left: none; }
  .wide td:last-child { border-right: none; }
  .bank td { font-size: 8pt; font-weight: bold; line-height: 1.45; height: 92px; }
  .foot { text-align: center; font-size: 8.5pt; padding: 8px 6px; line-height: 1.5; }
`;

function sheet(s: ConsigneeSheet): string {
  const total = s.total ?? s.rows.reduce((n, r) => n + (r.amount ?? 0), 0);
  const consignee = [`<span style="font-size:11pt">${esc(s.consignee.name)}</span>`, ...s.consignee.lines.filter(Boolean).map(esc)].join("<br/>");
  const rows = s.rows
    .map(
      (r, i) => `<tr>
        <td class="c">${i + 1}</td>
        <td>${r.commodity ? `<b>${esc(r.commodity)}</b>` : ""}${(r.pieces ?? []).map((p) => `<br/>${esc(p)}`).join("")}${r.bookingId ? `<br/><span style="font-size:8pt">${esc(r.bookingId)}</span>` : ""}</td>
        <td>${esc(r.particular)}</td>
        <td class="c">${r.qty || ""}</td>
        <td class="r">${r.rate !== undefined ? amount(r.rate) : ""}</td>
        <td class="r">${r.amount !== undefined ? (r.amount < 0 ? `-${amount(-r.amount)}` : amount(r.amount)) : ""}</td>
      </tr>`
    )
    .join("");
  // Keep the item block tall like the printed form when there are only a few bookings.
  const filler = Math.max(0, 7 - s.rows.length) * 26;
  return `<section class="sheet">
  <div class="logo"><img src="${LOGO_DATA_URI}" alt="Introlines Merchant Exports"/></div>
  <div class="title">INVOICE</div>
  <table class="head">
    <tr><td class="b" style="width:60%">CONSIGNEE DETAILS</td><td class="b" style="width:14%">Date</td><td>${esc(s.date)}</td></tr>
    <tr><td rowspan="3" style="font-size:10.5pt;line-height:1.5">${consignee}</td><td class="b">Invoice No</td><td>${esc(s.invoiceNo)}</td></tr>
    <tr><td>MARK</td><td>${esc(s.mark)}</td></tr>
    <tr><td class="b">Packages</td><td>${esc(s.packages)}</td></tr>
  </table>
  <table class="items">
    <thead><tr>
      <th style="width:9%;border-left:none">SI</th><th style="width:25%">Commodity &amp; Pcs</th><th style="width:25%">Particular</th>
      <th style="width:11%">QTY</th><th style="width:14%">Rate per Box</th><th style="width:16%;border-right:none">Amount<br/>(AED)</th>
    </tr></thead>
    <tbody>${rows}${filler ? `<tr class="filler"><td style="height:${filler}px"></td><td></td><td></td><td></td><td></td><td></td></tr>` : ""}</tbody>
  </table>
  <table class="wide">
    <tr><td class="b r" style="padding-right:30px">TOTAL AMOUNT(AED) &nbsp;&nbsp;&nbsp;&nbsp; ${amount(total)}</td></tr>
    <tr><td class="b r" style="padding-right:30px;font-size:8.5pt">Amount Collected From India()</td></tr>
  </table>
  <table class="wide">
    <tr>
      <td class="b c" style="width:72%;padding:14px 6px">Amount in words: ${inWords(total)} (AED) ONLY</td>
      <td class="b c" style="padding:14px 6px;border-right:none">Amount to be collected<br/>${amount(total)}</td>
    </tr>
  </table>
  <table class="wide">
    <tr><td class="b c" style="width:35%">INDIA</td><td class="b c" style="width:37%">DUBAI</td><td class="b c">SIGNATURE</td></tr>
    <tr class="bank">
      <td>A/C NAME : INTROLINES PRIVATE LIMITED<br/>A/C NO : 922020041854324<br/>IFSC CODE : UTIB0000210<br/>SWIFT CODE : AXISNBB210<br/>AD CODE : 63601999200017</td>
      <td>A/C NAME : AL ZAI ALANIQ TRADING<br/>A/C NO : 0373224910001<br/>IBAN : AE570400000373224910001<br/>BANK NAME: RAK BANK</td>
      <td></td>
    </tr>
  </table>
  <div class="foot">NO.25(2)/22, GROUND FLOOR, OPP VINAYAGAR KOVIL, KUMARAPURAM 1ST STREET RAYAPURAM, TIRUPPUR – 642601<br/>www.introlines.in</div>
</section>`;
}

export const invoiceFormHtml = (sheets: ConsigneeSheet[]) =>
  `<!doctype html><html><head><meta charset="utf-8"/><style>${STYLE}</style></head><body>${sheets.map(sheet).join("")}</body></html>`;

/** Invoice-form pages, saved to Downloads. */
export const downloadInvoiceFormPdf = (fileName: string, sheets: ConsigneeSheet[]) =>
  downloadPdf({ fileName, html: invoiceFormHtml(sheets), size: A4_PORTRAIT });
