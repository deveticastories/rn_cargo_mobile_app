/** Small helpers for turning cargo-backend's (sometimes populated) refs into plain values. */
import type { BackendDoc, PartyRef } from "@/types";

export function refId(ref: unknown): string {
  if (ref && typeof ref === "object" && "_id" in ref) return String((ref as { _id: unknown })._id);
  return ref == null ? "" : String(ref);
}

export function refField(ref: unknown, field: string): unknown {
  return ref && typeof ref === "object" ? (ref as Record<string, unknown>)[field] : undefined;
}

export function str(value: unknown): string {
  return value == null ? "" : String(value);
}

export function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function optionalNum(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** Short, stable, cosmetic code for entities with no natural human-readable one. Display only. */
export function fallbackCode(prefix: string, id: string): string {
  return `${prefix}-${id.slice(-6).toUpperCase()}`;
}

export function partyFromRef(ref: unknown): PartyRef {
  return {
    id: refId(ref),
    name: str(refField(ref, "name")),
    whatsapp: refField(ref, "whatsapp") ? str(refField(ref, "whatsapp")) : undefined,
    location: refField(ref, "location") ? str(refField(ref, "location")) : undefined,
    country: refField(ref, "country") ? str(refField(ref, "country")) : undefined,
  };
}

/** Pulls the array out of a cargo-backend list envelope, e.g. `{ success, bookingList: [...] }`. */
export function listFrom(body: unknown, key: string): BackendDoc[] {
  const value = body && typeof body === "object" ? (body as Record<string, unknown>)[key] : undefined;
  return Array.isArray(value) ? (value as BackendDoc[]) : [];
}

export function itemFrom(body: unknown, key: string): BackendDoc {
  const value = body && typeof body === "object" ? (body as Record<string, unknown>)[key] : undefined;
  return (value ?? {}) as BackendDoc;
}

/** "CTN-0007" → next is "CTN-0008". Used for codes cargo-backend requires but never generates. */
export function nextSequentialCode(docs: BackendDoc[], field: string, prefix: string, pad = 4): string {
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  let max = 0;
  for (const doc of docs) {
    const match = str(doc[field]).match(re);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  return `${prefix}-${String(max + 1).padStart(pad, "0")}`;
}
