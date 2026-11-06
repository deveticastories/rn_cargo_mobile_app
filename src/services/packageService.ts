/**
 * Packing lists (`/packages`) — one document per booking holding its bundles,
 * each with weights and product lines. Ported from the web app's
 * PackageServices (getPackageByBooking / upsertBundle).
 */
import { api, ApiError } from "@/api/client";
import { API_ENDPOINTS } from "@/api/endpoints";
import type { BackendDoc } from "@/types";
import { itemFrom, num, refId, str } from "./mappers";

export interface PackingLine {
  productId: string;
  quantity: number;
  fabricId?: string;
  unitId?: string;
  description?: string;
}

export interface SavedBundle {
  id: string;
  bundleNo: number;
  netWeight: number;
  grossWeight: number;
  lines: PackingLine[];
}

export interface BookingPackingList {
  id: string;
  repackedBy: string;
  bundles: SavedBundle[];
}

function toPackingList(doc: BackendDoc): BookingPackingList {
  const bundles = Array.isArray(doc.bundles) ? (doc.bundles as BackendDoc[]) : [];
  return {
    id: doc._id,
    repackedBy: str(doc.repackedBy),
    bundles: bundles
      .map((b) => ({
        id: str(b._id),
        bundleNo: num(b.bundleNo),
        netWeight: num(b.netWeight),
        grossWeight: num(b.grossWeight),
        lines: (Array.isArray(b.products) ? (b.products as BackendDoc[]) : []).map((p) => ({
          productId: refId(p.product),
          quantity: num(p.quantity),
          fabricId: p.fabric ? refId(p.fabric) : undefined,
          unitId: p.unit ? refId(p.unit) : undefined,
          description: p.description ? str(p.description) : undefined,
        })),
      }))
      .sort((a, b) => a.bundleNo - b.bundleNo),
  };
}

const toBackendBundle = (b: Omit<SavedBundle, "id"> & { id?: string }) => ({
  ...(b.id ? { _id: b.id } : {}),
  bundleNo: b.bundleNo,
  netWeight: b.netWeight,
  grossWeight: b.grossWeight,
  products: b.lines.map((l) => ({ product: l.productId, quantity: l.quantity, fabric: l.fabricId || undefined, unit: l.unitId || undefined, description: l.description || undefined })),
});

/** Packing lists read in the last couple of minutes (PDFs and delivery notes reuse them). */
const CACHE_MS = 120_000;
const recent = new Map<string, { at: number; list: Promise<BookingPackingList | null> }>();

export const packageService = {
  /** The booking's packing list, or null if none has been saved yet. */
  async getByBooking(bookingId: string): Promise<BookingPackingList | null> {
    try {
      const { data } = await api.get(API_ENDPOINTS.PACKAGES.BY_BOOKING(bookingId));
      return toPackingList(itemFrom(data, "data"));
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
  },

  /**
   * Same as getByBooking, but a list read moments ago (or just saved) is reused instead of
   * asked for again — for PDFs and previews. Editing screens use getByBooking.
   */
  getCached(bookingId: string): Promise<BookingPackingList | null> {
    const hit = recent.get(bookingId);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.list;
    const list = packageService.getByBooking(bookingId);
    recent.set(bookingId, { at: Date.now(), list });
    // A failed read is retried next time instead of being remembered.
    list.catch(() => recent.delete(bookingId));
    return list;
  },

  /** Forgets cached packing lists (pull-to-refresh). */
  clearCache() {
    recent.clear();
  },

  /** Adds or replaces one bundle on the booking's packing list, creating the list if needed. */
  async upsertBundle(bookingId: string, bundle: Omit<SavedBundle, "id">, opts: { repackedBy?: string } = {}): Promise<BookingPackingList> {
    const saved = await upsert(bookingId, bundle, opts);
    recent.set(bookingId, { at: Date.now(), list: Promise.resolve(saved) });
    return saved;
  },
};

/** The save itself: adds or replaces the bundle on the existing list, or creates the list. */
async function upsert(bookingId: string, bundle: Omit<SavedBundle, "id">, opts: { repackedBy?: string }): Promise<BookingPackingList> {
  const existing = await packageService.getByBooking(bookingId);
  if (!existing) {
    const body = { booking: bookingId, bundles: [toBackendBundle(bundle)], ...(opts.repackedBy ? { repackedBy: opts.repackedBy } : {}) };
    const { data } = await api.post(API_ENDPOINTS.PACKAGES.BASE, body);
    return toPackingList(itemFrom(data, "data"));
  }
  const bundles = existing.bundles.map(toBackendBundle);
  const at = existing.bundles.findIndex((b) => b.bundleNo === bundle.bundleNo);
  const next = toBackendBundle({ ...bundle, id: at >= 0 ? existing.bundles[at].id : undefined });
  if (at >= 0) bundles[at] = next;
  else bundles.push(next);
  const body = { bundles, ...(opts.repackedBy !== undefined ? { repackedBy: opts.repackedBy } : {}) };
  const { data } = await api.put(API_ENDPOINTS.PACKAGES.BY_ID(existing.id), body);
  return toPackingList(itemFrom(data, "data"));
}
