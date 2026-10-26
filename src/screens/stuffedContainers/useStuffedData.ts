/**
 * Derived data for the stuffed-containers screens, computed the way the web
 * console's Stuffing → "Stuffed list" does: one row per stuffing record, and
 * per booking its invoice figures, payment status and bundle marks.
 */
import { useCallback, useMemo } from "react";
import { useCustomerLookup } from "@/hooks/useCustomerLookup";
import { num, str } from "@/services/mappers";
import { useAppSelector } from "@/store/hooks";
import { selectPackingByBooking, selectReceivedByInvoice } from "@/store/selectors";
import type { Booking, Invoice } from "@/types";
import type { PdfParty } from "@/utils/tablePdf";

export interface StuffedRow {
  id: string;
  containerId: string;
  containerCode: string;
  containerName: string;
  bookingIds: string[];
  stuffedDate: string;
}

export type PaymentStatus = "Paid" | "Partially paid" | "Unpaid" | "Not invoiced";

export interface StuffedBooking {
  id: string;
  booking?: Booking;
  invoice?: Invoice;
  sender: PdfParty & { contact: string };
  receiver: PdfParty & { contact: string };
  bundles: number;
  bundleMarks: string;
  receivable?: number;
  deliveryPartnerAmount?: number;
  /** Pricing entry whose destination matches the receiver's location or country. */
  perBundleCharge?: number;
  paymentStatus: PaymentStatus;
}

export function useStuffedData() {
  const stuffings = useAppSelector((s) => s.containers.stuffings);
  const containers = useAppSelector((s) => s.containers.items);
  const bookings = useAppSelector((s) => s.bookings.items);
  const invoices = useAppSelector((s) => s.finance.invoices);
  const pricing = useAppSelector((s) => s.masters.pricing.items);
  const received = useAppSelector(selectReceivedByInvoice);
  const packing = useAppSelector(selectPackingByBooking);
  const lookup = useCustomerLookup();

  // Newest stuffing first, like the web table.
  const rows = useMemo<StuffedRow[]>(
    () =>
      stuffings
        .map((st) => {
          const c = containers.find((x) => x.id === st.container);
          return { id: st.id, containerId: st.container, containerCode: c?.code ?? "—", containerName: c?.company ?? "—", bookingIds: st.bookings, stuffedDate: st.date };
        })
        .sort((a, b) => b.stuffedDate.localeCompare(a.stuffedDate)),
    [stuffings, containers]
  );

  const bookingRow = useCallback(
    (id: string): StuffedBooking => {
      const b = bookings.find((x) => x.id === id);
      const inv = b ? invoices.find((i) => i.bookingId === b.id) : undefined;
      const got = inv ? received.get(inv.id) ?? 0 : 0;
      const paymentStatus: PaymentStatus = !inv ? "Not invoiced" : got >= inv.amount ? "Paid" : got > 0 ? "Partially paid" : "Unpaid";
      const senderInfo = b ? lookup.map.get(b.sender.id) : undefined;
      const receiverInfo = b ? lookup.map.get(b.receiver.id) : undefined;
      const receiverLocation = b?.receiver.location || receiverInfo?.location || "";
      const receiverCountry = b?.receiver.country || receiverInfo?.country || "";
      const price = pricing.find((p) => str(p.to) === receiverLocation || str(p.to) === receiverCountry);
      return {
        id,
        booking: b,
        invoice: inv,
        sender: {
          name: b?.sender.name ?? "",
          lines: senderInfo ? [senderInfo.location, senderInfo.whatsapp ? `Ph: ${senderInfo.whatsapp}` : ""] : [],
          contact: b?.sender.whatsapp || senderInfo?.whatsapp || "—",
        },
        receiver: {
          name: b?.receiver.name ?? "",
          lines: [[receiverLocation, receiverCountry].filter(Boolean).join(", "), receiverInfo?.whatsapp ? `Ph: ${receiverInfo.whatsapp}` : ""],
          contact: b?.receiver.whatsapp || receiverInfo?.whatsapp || "—",
        },
        bundles: b ? b.actualBundle || b.bundleCount : 0,
        bundleMarks: (packing.get(id)?.marks ?? []).join(", "),
        receivable: inv ? inv.amount : undefined,
        deliveryPartnerAmount: inv ? inv.deliveryCharge ?? 0 : undefined,
        perBundleCharge: price ? num(price.price) : undefined,
        paymentStatus,
      };
    },
    [bookings, invoices, received, pricing, packing, lookup]
  );

  return { rows, bookingRow };
}

export const PAYMENT_TONE = { Paid: "success", "Partially paid": "warning", Unpaid: "danger", "Not invoiced": "neutral" } as const;

export const pdfMoney = (n: number | undefined) => (n === undefined ? "-" : `Rs. ${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`);
