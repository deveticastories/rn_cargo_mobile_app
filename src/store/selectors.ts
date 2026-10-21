/** Memoized derived data shared by several screens. */
import { createSelector } from "@reduxjs/toolkit";
import type { Booking, Container, Invoice } from "@/types";
import type { Tone } from "@/theme/palette";
import { daysFromToday, isSameMonth, parseDate } from "@/utils/format";
import type { RootState } from "./index";

/* ------------------------------- Bookings -------------------------------- */

export type BookingStage = "repacking" | "ready" | "readyToStuff" | "stuffed";

export function bookingStage(b: Booking): BookingStage {
  if (b.stuffStatus === "Stuffed") return "stuffed";
  if (b.stuffStatus === "Ready to Stuff") return "readyToStuff";
  if (b.repackingStatus === "Ready to Ship") return "ready";
  return "repacking";
}

export const STAGE_META: Record<BookingStage, { label: string; short: string; tone: Tone }> = {
  repacking: { label: "Repacking Required", short: "Repack", tone: "warning" },
  ready: { label: "Ready to Ship", short: "Ready", tone: "success" },
  readyToStuff: { label: "Ready to Stuff", short: "To stuff", tone: "info" },
  stuffed: { label: "Stuffed", short: "Stuffed", tone: "purple" },
};

const selectBookingItems = (s: RootState) => s.bookings.items;

/** Newest first — Mongo ids embed their creation time, so they sort chronologically. */
export const selectBookingsSorted = createSelector([selectBookingItems], (items) =>
  [...items].sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0))
);

export const selectBookingStats = createSelector([selectBookingItems], (items) => {
  const counts: Record<BookingStage, number> = { repacking: 0, ready: 0, readyToStuff: 0, stuffed: 0 };
  let readyBundles = 0;
  let thisMonth = 0;
  let lastMonth = 0;
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  for (const b of items) {
    const stage = bookingStage(b);
    counts[stage] += 1;
    if (stage === "ready" || stage === "readyToStuff") readyBundles += b.actualBundle || b.bundleCount;
    if (isSameMonth(b.date, now)) thisMonth += 1;
    else if (isSameMonth(b.date, prev)) lastMonth += 1;
  }
  const growth = lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : null;
  return { total: items.length, counts, readyBundles, thisMonth, lastMonth, growth };
});

/* ------------------------------ Containers ------------------------------- */

export type ContainerPhase = "loading" | "stuffed" | "atSea" | "arrived";

export function containerPhase(c: Container): ContainerPhase {
  if (c.status !== "Stuffed") return "loading";
  const toEtd = daysFromToday(c.etdCok);
  const toEta = daysFromToday(c.etaUae);
  if (toEta !== null && toEta <= 0) return "arrived";
  if (toEtd !== null && toEtd <= 0) return "atSea";
  return "stuffed";
}

/** Bookings loaded into each container, from the stuffing records. */
export const selectBookingsPerContainer = createSelector([(s: RootState) => s.containers.stuffings], (stuffings) => {
  const map = new Map<string, Set<string>>();
  for (const st of stuffings) {
    const set = map.get(st.container) ?? new Set<string>();
    st.bookings.forEach((b) => set.add(b));
    map.set(st.container, set);
  }
  return map;
});

/** Sea voyage progress 0..1 between ETD Kochi and ETA UAE. */
export function voyageProgress(c: Container): number | null {
  const etd = parseDate(c.etdCok);
  const eta = parseDate(c.etaUae);
  if (!etd || !eta || eta <= etd) return null;
  return Math.min(1, Math.max(0, (Date.now() - etd.getTime()) / (eta.getTime() - etd.getTime())));
}

/* -------------------------------- Finance -------------------------------- */

export type InvoiceStatus = "Paid" | "Partial" | "Unpaid";

export const INVOICE_TONE: Record<InvoiceStatus, Tone> = { Paid: "success", Partial: "warning", Unpaid: "danger" };

export const selectReceivedByInvoice = createSelector([(s: RootState) => s.finance.receipts], (receipts) => {
  const map = new Map<string, number>();
  for (const r of receipts) map.set(r.invoiceId, (map.get(r.invoiceId) ?? 0) + r.receivedAmount);
  return map;
});

export function invoiceStatus(inv: Invoice, received: number): InvoiceStatus {
  if (received >= inv.amount && inv.amount > 0) return "Paid";
  if (received > 0) return "Partial";
  return "Unpaid";
}

export const selectPettyCash = createSelector(
  [(s: RootState) => s.finance.creditNotes, (s: RootState) => s.finance.expenses],
  (notes, expenses) =>
    notes.reduce((sum, n) => sum + n.amount, 0) - expenses.reduce((sum, e) => sum + e.amount, 0)
);
