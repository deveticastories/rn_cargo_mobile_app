/**
 * The company's printed form layout (as on the Goods Received Note), shared by
 * every PDF: one black-ruled box with the Introlines logo, the document title,
 * the document's own content, then the office address and "Authorised Signature".
 */
import { LOGO_DATA_URI } from "./pdfLogo";

export const A4_PORTRAIT = { width: 595, height: 842 };
export const A4_LANDSCAPE = { width: 842, height: 595 };

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const icon = (paths: string) =>
  `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#000" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
const ICONS = {
  pin: icon('<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>'),
  phone: icon(
    '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z"/>'
  ),
  mail: icon('<rect x="2" y="4" width="20" height="16" rx="1"/><path d="m2 6 10 7 10-7"/>'),
  globe: icon('<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>'),
};

const CONTACTS: [keyof typeof ICONS, string][] = [
  ["pin", "NO.25(2)/22, GROUND FLOOR, OPP VINAYAGAR KOVIL, KUMARAPURAM 1ST<br/>STREET RAYAPURAM, TIRUPPUR – 642601"],
  ["phone", "+91 8681800075"],
  ["mail", "info@introlines.in"],
  ["globe", "www.introlines.in"],
];

/** Base styles for framed documents; content tables use the same thin black rules as the form. */
export const FRAME_STYLE = `
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: Helvetica, Arial, sans-serif; color: #000; font-size: 10pt; margin: 0; }
  .frame { border: 1.2pt solid #000; -webkit-box-decoration-break: clone; box-decoration-break: clone; }
  .frame + .frame { page-break-before: always; break-before: page; }
  .logo { text-align: center; padding: 4px 0 2px; border-bottom: 0.8pt solid #000; }
  .logo img { height: 78px; }
  .doc-title { text-align: center; font-weight: bold; font-size: 12pt; padding: 9px 0; border-bottom: 0.8pt solid #000; text-transform: uppercase; }
  .content { padding: 14px 14px 6px; }
  .content table { width: 100%; border-collapse: collapse; }
  .content td, .content th { border: 0.6pt solid #000; padding: 5px 7px; text-align: left; vertical-align: top; }
  .content th, .content .label, .content tfoot td { font-weight: bold; }
  .content th { text-align: center; }
  .content .info { width: auto; margin-bottom: 14px; }
  .content .info td { min-width: 40mm; }
  .content .party td { height: 26mm; width: 50%; }
  .content .note { font-style: italic; }
  h3 { font-size: 11pt; margin: 16px 0 6px; }
  .footnote { font-style: italic; font-size: 9pt; margin-top: 6px; }
  .bottom { display: flex; justify-content: space-between; align-items: flex-start; padding: 28px 30px 26px; page-break-inside: avoid; break-inside: avoid; }
  .contacts { font-size: 8pt; line-height: 1.35; }
  .contacts div { display: flex; gap: 9px; margin-bottom: 9px; }
  .contacts svg { flex: none; margin-top: 1px; }
  .signature { font-size: 10.5pt; padding: 0 40px 0 20px; }
`;

/** One framed sheet. `signature: false` leaves the right of the footer empty (for forms with their own signature lines). */
export function framedSheet(title: string, content: string, opts: { signature?: string | false } = {}): string {
  const signature = opts.signature === undefined ? "Authorised Signature" : opts.signature;
  return `<section class="frame">
  <div class="logo"><img src="${LOGO_DATA_URI}" alt="Introlines Merchant Exports"/></div>
  <div class="doc-title">${esc(title)}</div>
  <div class="content">${content}</div>
  <div class="bottom">
    <div class="contacts">${CONTACTS.map(([k, text]) => `<div>${ICONS[k]}<span>${text}</span></div>`).join("")}</div>
    ${signature ? `<div class="signature">${esc(signature)}</div>` : ""}
  </div>
</section>`;
}

/** A full HTML document of framed sheets (one per page). */
export const framedDocument = (sheets: string[], extraStyle = "") =>
  `<!doctype html><html><head><meta charset="utf-8"/><style>${FRAME_STYLE}${extraStyle}</style></head><body>${sheets.join("")}</body></html>`;
