/**
 * Shipment bookings — cargo-backend's `/bookings` module (see the web app's
 * BookingServices.ts). `sender`/`receiver` are Customer refs and
 * `pickupOption` is a required Pickup Assign ref; the mobile form picks those
 * records directly, so ids are sent as-is (no name → id lookups needed).
 */
import { api } from "@/api/client";
import { API_ENDPOINTS } from "@/api/endpoints";
import type { BackendDoc, Booking, StuffStatus } from "@/types";
import { itemFrom, listFrom, num, partyFromRef, refField, str } from "./mappers";

export function toBooking(doc: BackendDoc): Booking {
  const stuffStatus = str(doc.stuffStatus) as StuffStatus;
  return {
    id: doc._id,
    code: str(doc.bookingId ?? doc._id),
    sender: partyFromRef(doc.sender),
    receiver: partyFromRef(doc.receiver),
    pickupOption: str(refField(doc.pickupOption, "lrNo") ?? ""),
    date: str(doc.date),
    billOption: (doc.billOption as Booking["billOption"]) ?? "",
    bundleCount: num(doc.bundleCount),
    bundleType: (doc.bundleType as Booking["bundleType"]) ?? "",
    productType: (doc.productType as Booking["productType"]) ?? "",
    repackingStatus: (doc.packingStatus as Booking["repackingStatus"]) ?? "",
    stuffStatus: stuffStatus === "Stuffed" || stuffStatus === "Ready to Stuff" ? stuffStatus : "Pending",
    brandHandlingCharge: num(doc.brandHandlingCharge),
    pickupCharge: num(doc.pickupCharge),
    bundleHandlingCharge: num(doc.bundleHandlingCharge),
    actualBundle: num(doc.bundle),
    status: doc.status === false ? "Inactive" : "Active",
    createdAt: doc.createdAt ? str(doc.createdAt) : undefined,
  };
}

export interface BookingInput {
  senderId: string;
  receiverId: string;
  pickupAssignId: string;
  date: string;
  billOption: "With Bill" | "Without Bill";
  bundleType: "Bundle" | "Box" | "CBM" | "KG";
  productType: "Branded" | "Normal";
  bundleCount: number;
  brandHandlingCharge: number;
  pickupCharge: number;
  bundleHandlingCharge: number;
}

function toPayload(input: BookingInput) {
  // Each extra charge only applies under its own condition (same rule as the web form).
  return {
    sender: input.senderId,
    receiver: input.receiverId,
    pickupOption: input.pickupAssignId,
    date: input.date,
    billOption: input.billOption,
    bundleType: input.bundleType,
    productType: input.productType,
    bundleCount: input.bundleCount,
    packingStatus: "Repacking Required",
    brandHandlingCharge: input.productType === "Branded" ? input.brandHandlingCharge || 0 : 0,
    pickupCharge: input.billOption === "Without Bill" ? input.pickupCharge || 0 : 0,
    bundleHandlingCharge: input.bundleCount < 5 ? input.bundleHandlingCharge || 0 : 0,
    status: true,
  };
}

export const bookingService = {
  async list(): Promise<Booking[]> {
    const { data } = await api.get(API_ENDPOINTS.BOOKINGS.BASE);
    return listFrom(data, "bookingList").map(toBooking);
  },
  async create(input: BookingInput): Promise<Booking> {
    const { data } = await api.post(API_ENDPOINTS.BOOKINGS.BASE, toPayload(input));
    return toBooking(itemFrom(data, "booking"));
  },
  async update(id: string, body: Record<string, unknown>): Promise<Booking> {
    const { data } = await api.put(API_ENDPOINTS.BOOKINGS.BY_ID(id), body);
    return toBooking(itemFrom(data, "booking"));
  },
  async remove(id: string): Promise<void> {
    await api.delete(API_ENDPOINTS.BOOKINGS.BY_ID(id));
  },
  /** The only way cargo-backend accepts a `stuffStatus` change. */
  async updateStuffStatus(id: string, stuffStatus: StuffStatus): Promise<void> {
    await api.patch(API_ENDPOINTS.BOOKINGS.STUFF_STATUS(id), { stuffStatus });
  },
};
