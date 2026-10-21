/**
 * Invoice PDF — the same letterhead and table layout as the web console's invoice
 * (next_js_cargo_admin_web_app src/utils/pdf.ts), rendered from HTML with expo-print
 * and handed to the share sheet so it can be saved to Files/Drive or sent on.
 */
import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import type { Booking, Invoice } from "@/types";
import { fullDate } from "./format";

const COMPANY = "INTROLINES PVT LTD";
const CONTACT = "Mob: +91 86818 00075 &nbsp;|&nbsp; Email: info@introlines.in";

export interface PartyDetails {
  name: string;
  lines: string[];
}

const pdfMoney = (n: number | undefined) => `Rs. ${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const signedMoney = (n: number) => (n < 0 ? `- ${pdfMoney(-n)}` : pdfMoney(n));

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Mirrors the web's downloadSavedInvoice: every figure comes from the invoice cargo-backend stored. */
function invoiceHtml(invoice: Invoice, booking: Booking | undefined, receiver: PartyDetails): string {
  const qty = Number(booking?.actualBundle || 0);
  const pickup = Number(booking?.pickupCharge || 0);
  const brand = Number(booking?.brandHandlingCharge || 0);
  // The booking's charges may have been edited since — only itemise them if they still add up.
  const split = pickup + brand === invoice.additionalCharges;

  const rows: { description: string; rate?: number; qty?: number; amount: number }[] = [
    {
      description: `Freight India → UAE (${booking?.bundleType || "Bundle"})`,
      rate: qty ? invoice.subtotal / qty : undefined,
      qty: qty || undefined,
      amount: invoice.subtotal,
    },
    ...(!split && invoice.additionalCharges ? [{ description: "Additional charges", amount: invoice.additionalCharges }] : []),
    ...(invoice.receivableDiscount ? [{ description: "Receiver discount", amount: -invoice.receivableDiscount }] : []),
  ];

  // At least 6 numbered rows so the sheet still reads as a form when there are fewer charges.
  const numbered = rows.map(
    (r, i) =>
      `<tr><td>${i + 1}</td><td>${esc(r.description)}</td><td>${r.rate !== undefined ? pdfMoney(r.rate) : ""}</td><td>${
        r.qty ?? ""
      }</td><td>${signedMoney(r.amount)}</td></tr>`
  );
  while (numbered.length < 6) numbered.push(`<tr><td>${numbered.length + 1}</td><td></td><td></td><td></td><td></td></tr>`);

  const extra = (label: string, amount?: number) => `<tr><td colspan="4" class="note">${label}</td><td>${amount ? pdfMoney(amount) : ""}</td></tr>`;
  const extras = [
    split && pickup ? extra("Without Bill Extra Charge - Pickup Charge &nbsp;(applicable only if sent without bill)", pickup) : "",
    split && brand ? extra("Brand Handling Charge &nbsp;(applicable only for branded products)", brand) : "",
    extra("Bundle Handling Charge &nbsp;(applicable only if below 5 bundles)"),
    extra("GCC Transport Charge &nbsp;(applicable only for delivery outside UAE)"),
  ].join("");

  const receiverText = [receiver.name, ...receiver.lines.filter(Boolean)].map(esc).join("<br/>");

  return `<!doctype html>
<html><head><meta charset="utf-8"/>
<style>
  @page { size: A4; margin: 15mm; }
  body { font-family: "Times New Roman", Times, serif; color: #141414; font-size: 11pt; margin: 0; }
  .company { font-size: 22pt; font-weight: bold; margin: 0; }
  .contact { font-family: Helvetica, Arial, sans-serif; font-size: 10.5pt; margin: 4px 0 8px; }
  .title { font-size: 16pt; font-weight: bold; text-decoration: underline; margin: 0 0 12px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 0; }
  td, th { border: 0.6pt solid #969696; padding: 6px 7px; text-align: left; vertical-align: top; }
  th, .label, tfoot td { background: #d9d9d9; font-weight: bold; }
  .party td { height: 30mm; }
  h3 { font-size: 13pt; margin: 22px 0 6px; }
  .note { font-style: italic; }
  .footnote { font-style: italic; font-size: 9.5pt; margin-top: 6px; }
  .sign { margin-top: 48px; }
</style></head>
<body>
  <p class="company">${COMPANY}</p>
  <p class="contact">${CONTACT}</p>
  <p class="title">INVOICE</p>

  <table><tr>
    <td class="label" style="width:38mm">Invoice No.</td><td style="width:48mm">${esc(invoice.code)}</td>
    <td class="label" style="width:38mm">Booking Date</td><td>${booking ? esc(fullDate(booking.date)) : ""}</td>
  </tr></table>

  <table class="party" style="margin-top:22px">
    <thead><tr><th>Customer Name (Receiver Name &amp; Details)</th></tr></thead>
    <tbody><tr><td>${receiverText}</td></tr></tbody>
  </table>

  <h3>Description</h3>
  <table>
    <thead><tr><th style="width:18mm">SL No</th><th>Bundles</th><th style="width:38mm">Rate (per Bundle)</th><th style="width:26mm">Qty</th><th style="width:36mm">Amount</th></tr></thead>
    <tbody>${numbered.join("")}${extras}</tbody>
    <tfoot>
      <tr><td colspan="4">Total Amount</td><td>${pdfMoney(invoice.amount)}</td></tr>
      <tr><td colspan="4">Payable Amount</td><td>${pdfMoney(invoice.amount)}</td></tr>
    </tfoot>
  </table>
  <p class="footnote">Note: Additional charge lines above apply only under their stated condition; otherwise leave blank/remove before sending.</p>
  <p class="sign">Authorised Person Name &amp; Signature</p>
</body></html>`;
}

/** Renders the invoice to `<invoice code>.pdf` and opens the share sheet (Save to Files/Drive, WhatsApp, email…). */
export async function downloadInvoicePdf(invoice: Invoice, booking: Booking | undefined, receiver: PartyDetails): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html: invoiceHtml(invoice, booking, receiver) });
  const target = `${FileSystem.cacheDirectory}${invoice.code.replace(/[^\w-]/g, "_")}.pdf`;
  await FileSystem.deleteAsync(target, { idempotent: true });
  await FileSystem.moveAsync({ from: uri, to: target });
  await Sharing.shareAsync(target, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: `Invoice ${invoice.code}` });
}
