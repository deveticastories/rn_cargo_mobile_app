/**
 * The lists saved on the device last time (see `cache.ts`). Each slice copies
 * them in only while it hasn't loaded fresh data itself, so the screen shows
 * the previous data at once and the server's answer replaces it when it lands.
 */
import { createAction } from "@reduxjs/toolkit";
import type { MasterKey } from "@/features/masters/config";
import type { BackendDoc, Booking, BookingPackage, Container, CreditNoteEntry, DailyExpense, Invoice, ReceiptEntry, Stuffing } from "@/types";

export interface CachedData {
  bookings?: Booking[];
  containers?: { items: Container[]; stuffings: Stuffing[]; packages: BookingPackage[] };
  finance?: { invoices: Invoice[]; receipts: ReceiptEntry[]; expenses: DailyExpense[]; creditNotes: CreditNoteEntry[] };
  masters?: Partial<Record<MasterKey, BackendDoc[]>>;
}

export const cacheHydrated = createAction<CachedData>("cache/hydrated");
