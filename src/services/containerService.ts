/** Containers (`/containers`) and the stuffing events that load bookings into them (`/stuffings`). */
import { api } from "@/api/client";
import { API_ENDPOINTS } from "@/api/endpoints";
import type { BackendDoc, Container, Stuffing } from "@/types";
import { itemFrom, listFrom, refId, str } from "./mappers";

export function toContainer(doc: BackendDoc): Container {
  return {
    id: doc._id,
    code: str(doc.containerCode ?? doc._id),
    status: (doc.containerStatus as Container["status"]) ?? "Active",
    company: str(doc.company),
    stuffingCode: doc.stuffingCode ? str(doc.stuffingCode) : undefined,
    stuffingDate: str(doc.stuffingDate),
    cutOffDate: doc.cutOffDate ? str(doc.cutOffDate) : undefined,
    etaCok: doc.etaCok ? str(doc.etaCok) : undefined,
    etdCok: doc.etdCok ? str(doc.etdCok) : undefined,
    etaUae: doc.etaUae ? str(doc.etaUae) : undefined,
  };
}

function toStuffing(doc: BackendDoc): Stuffing {
  return {
    id: doc._id,
    container: refId(doc.container),
    bookings: Array.isArray(doc.bookings) ? (doc.bookings as unknown[]).map(refId) : [],
    date: str(doc.date),
  };
}

export const containerService = {
  async list(): Promise<Container[]> {
    const { data } = await api.get(API_ENDPOINTS.CONTAINERS.BASE);
    return listFrom(data, "containerList").map(toContainer);
  },
  async listStuffings(): Promise<Stuffing[]> {
    const { data } = await api.get(API_ENDPOINTS.STUFFINGS.BASE);
    return listFrom(data, "stuffingList").map(toStuffing);
  },
  /** Loads bookings into a container; cargo-backend marks both as stuffed. */
  async createStuffing(containerId: string, bookingIds: string[]): Promise<Stuffing> {
    const { data } = await api.post(API_ENDPOINTS.STUFFINGS.BASE, { container: containerId, bookings: bookingIds });
    return toStuffing(itemFrom(data, "data"));
  },
};
