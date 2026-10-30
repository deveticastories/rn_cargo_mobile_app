/**
 * Goods Received Note — the company's printed Introlines form, reproduced
 * exactly: assets/grn-template.svg is the original A4 PDF page (lines, logo,
 * labels, address) converted to vectors, and the booking's values are placed
 * into its boxes on top. Positions are in PDF points from the page's top-left.
 */
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import { downloadPdf } from "./downloads";

export interface GrnParty {
  name: string;
  lines: string[];
}

export interface GoodsReceivedNote {
  bookingId: string;
  date: string;
  shipmentMode: string;
  sender: GrnParty;
  receiver: GrnParty;
  destination: string;
  bundles: string;
  bundleMark: string;
}

const A4 = { width: 595, height: 842 };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The template's SVG markup, read once from the bundled asset. */
let template: Promise<string> | null = null;
function loadTemplate(): Promise<string> {
  template ??= (async () => {
    const asset = Asset.fromModule(require("../../assets/grn-template.svg"));
    await asset.downloadAsync();
    return FileSystem.readAsStringAsync(asset.localUri ?? asset.uri);
  })();
  template.catch(() => (template = null));
  return template;
}

/** One line of text whose baseline sits at `baseline` points from the top, like the form's own labels. */
const field = (left: number, baseline: number, width: number, text: string, size = 8.5) =>
  `<div class="f" style="left:${left}pt;top:${baseline - size * 0.85}pt;width:${width}pt;font-size:${size}pt">${esc(text)}</div>`;

const party = (left: number, p: GrnParty) =>
  `<div class="p" style="left:${left}pt"><b>${esc(p.name || "-")}</b>${p.lines
    .filter(Boolean)
    .map((l) => `<br/>${esc(l)}`)
    .join("")}</div>`;

function goodsReceivedHtml(note: GoodsReceivedNote, svg: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"/><style>
  @page { size: ${A4.width}pt ${A4.height}pt; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${A4.width}pt; height: ${A4.height}pt; overflow: hidden; }
  body { position: relative; font-family: Helvetica, Arial, sans-serif; color: #000; }
  .bg { position: absolute; left: 0; top: 0; width: ${A4.width}pt; height: ${A4.height}pt; }
  .bg svg { width: 100%; height: 100%; display: block; }
  .f { position: absolute; line-height: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .p { position: absolute; top: 410pt; width: 232pt; height: 45pt; overflow: hidden; font-size: 8.5pt; line-height: 1.3; }
</style></head><body>
<div class="bg">${svg}</div>
${field(407, 344, 142, note.bookingId, 9.1)}
${field(407, 364, 142, note.date, 9.1)}
${field(407, 382, 142, note.shipmentMode, 9.1)}
${party(47, note.sender)}
${party(287, note.receiver)}
${field(157, 468, 122, note.destination)}
${field(407, 468, 142, note.bundles)}
${field(407, 482, 142, note.bundleMark)}
</body></html>`;
}

/** Renders the Goods Received Note to `<fileName>` (A4) in Downloads. */
export async function downloadGoodsReceivedPdf(fileName: string, note: GoodsReceivedNote): Promise<void> {
  const svg = await loadTemplate();
  await downloadPdf({ fileName, html: goodsReceivedHtml(note, svg), size: A4 });
}
