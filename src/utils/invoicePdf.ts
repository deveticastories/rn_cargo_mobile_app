/**
 * Invoice PDF in the company's printed invoice form (invoiceFormPdf.ts):
 * consignee = receiver, mark = bundle marks, commodity = GARMENTS with each
 * product's pieces, particular = bundle type. Every figure comes from the
 * invoice cargo-backend stored, like the web's downloadSavedInvoice.
 */
import { packageService, type BookingPackingList } from "@/services/packageService";
import type { Booking, Invoice } from "@/types";
import { fullDate } from "./format";
import { downloadInvoiceFormPdf, type ConsigneeSheet } from "./invoiceFormPdf";

export interface PartyDetails {
  name: string;
  lines: string[];
}

export interface InvoiceExtras {
  /** The booking's bundle marks, e.g. "13, 14, 15". */
  marks?: string;
  /** Product name for a packing-list product id. */
  productName?: (id: string) => string;
}

/** Packing lists already fetched this session — an invoiced booking's list no longer changes. */
const packingLists = new Map<string, Promise<BookingPackingList | null>>();

function packingListOf(bookingId: string) {
  let list = packingLists.get(bookingId);
  if (!list) {
    list = packageService.getByBooking(bookingId);
    packingLists.set(bookingId, list);
    // A failed fetch is retried next time instead of being remembered.
    list.catch(() => packingLists.delete(bookingId));
  }
  return list.catch(() => null);
}

/** "Shirt – 40 pcs" per product on the booking's packing list. */
async function piecesOf(bookingId: string, productName?: (id: string) => string): Promise<string[]> {
  const list = await packingListOf(bookingId);
  const perProduct = new Map<string, number>();
  for (const l of (list?.bundles ?? []).flatMap((b) => b.lines)) {
    const name = productName?.(l.productId) || "Items";
    perProduct.set(name, (perProduct.get(name) ?? 0) + (Number(l.quantity) || 0));
  }
  return [...perProduct.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, n]) => `${name} – ${n} pcs`);
}

async function invoiceSheet(invoice: Invoice, booking: Booking | undefined, receiver: PartyDetails, extras: InvoiceExtras): Promise<ConsigneeSheet> {
  const qty = Number(booking?.actualBundle || booking?.bundleCount || 0);
  const pickup = Number(booking?.pickupCharge || 0);
  const brand = Number(booking?.brandHandlingCharge || 0);
  // Whatever the total holds beyond the bundles, pickup / brand handling and discount is the delivery partner's charge.
  const delivery = Math.round((invoice.amount - invoice.subtotal + invoice.receivableDiscount - pickup - brand) * 100) / 100;
  // The booking's charges may have been edited since — only itemise them if they still add up.
  const split = delivery >= 0;
  const rows: ConsigneeSheet["rows"] = [
    {
      commodity: "GARMENTS",
      pieces: booking ? await piecesOf(booking.id, extras.productName) : [],
      particular: booking?.bundleType || "Bundle",
      qty,
      rate: qty ? invoice.subtotal / qty : undefined,
      amount: invoice.subtotal,
    },
    ...(split
      ? [
          ...(pickup ? [{ particular: "Pickup charge (without bill)", amount: pickup }] : []),
          ...(brand ? [{ particular: "Brand handling charge", amount: brand }] : []),
          ...(delivery > 0 ? [{ particular: "Delivery partner charges", amount: delivery }] : []),
        ]
      : invoice.additionalCharges
        ? [{ particular: "Additional charges", amount: invoice.additionalCharges }]
        : []),
    ...(invoice.receivableDiscount ? [{ particular: "Receiver discount", amount: -invoice.receivableDiscount }] : []),
  ];
  return {
    // The form prints the phone number as-is (no "Ph:" label).
    consignee: { name: receiver.name, lines: receiver.lines.map((l) => l.replace(/^Ph:\s*/, "")) },
    date: fullDate(invoice.createdAt || booking?.date || new Date().toISOString()),
    invoiceNo: invoice.code,
    mark: extras.marks || "-",
    packages: qty ? String(qty) : "-",
    rows,
    total: invoice.amount,
  };
}

/** Renders the invoice to `<invoice code>.pdf` in Downloads. */
export async function downloadInvoicePdf(invoice: Invoice, booking: Booking | undefined, receiver: PartyDetails, extras: InvoiceExtras = {}) {
  await downloadInvoiceFormPdf(`${invoice.code}.pdf`, [await invoiceSheet(invoice, booking, receiver, extras)]);
}
