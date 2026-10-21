/**
 * Generic CRUD for cargo-backend's master/operations modules (employees,
 * customers, stores, countries, partners, pricing, products, fabrics,
 * pickup assigns, pre-bookings). They all share one shape: GET-all returns
 * `{ [listKey]: [...] }`, create/update return `{ [itemKey]: {...} }`.
 * Records are kept raw (`BackendDoc`) and described by `src/features/masters/config.ts`.
 */
import { api } from "@/api/client";
import type { BackendDoc } from "@/types";
import { itemFrom, listFrom } from "./mappers";

export interface MasterEndpoint {
  endpoint: string;
  listKey: string;
  itemKey: string;
}

export const masterService = {
  async list(cfg: MasterEndpoint): Promise<BackendDoc[]> {
    const { data } = await api.get(cfg.endpoint);
    return listFrom(data, cfg.listKey);
  },
  async create(cfg: MasterEndpoint, body: Record<string, unknown>): Promise<BackendDoc> {
    const { data } = await api.post(cfg.endpoint, body);
    return itemFrom(data, cfg.itemKey);
  },
  async update(cfg: MasterEndpoint, id: string, body: Record<string, unknown>): Promise<BackendDoc> {
    const { data } = await api.put(`${cfg.endpoint}/${id}`, body);
    return itemFrom(data, cfg.itemKey);
  },
  async remove(cfg: MasterEndpoint, id: string): Promise<void> {
    await api.delete(`${cfg.endpoint}/${id}`);
  },
};
