/** Pricing master helpers shared by invoicing and the stuffing list. */
import { num, str } from "@/services/mappers";
import type { BackendDoc } from "@/types";

/** Same aliases as the web console's canonicalPlace, so "Dubai" or "U.A.E" still match the UAE route. */
const PLACE_ALIASES: Record<string, string> = {
  india: "India",
  uae: "UAE",
  "u.a.e": "UAE",
  "u.a.e.": "UAE",
  "united arab emirates": "UAE",
  dubai: "UAE",
};

export const canonicalPlace = (v: unknown) => {
  const s = str(v).trim().replace(/\s+/g, " ");
  return PLACE_ALIASES[s.toLowerCase()] ?? s;
};

export const isIndiaToUae = (p: BackendDoc) => canonicalPlace(p.from) === "India" && canonicalPlace(p.to) === "UAE";

/** India → UAE price per unit for a bundle type (Box, Bundle, …), if one is set. */
export function indiaToUaeRate(pricing: BackendDoc[], bundleType: string): number | undefined {
  const route = pricing.find((p) => isIndiaToUae(p) && str(p.uom) === bundleType);
  return route ? num(route.price) : undefined;
}
