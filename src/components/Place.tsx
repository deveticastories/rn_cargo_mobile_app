/**
 * Locations and countries with a coloured dot in front wherever they're shown. Every place has its own
 * colour, no two alike, and the same one on every screen; the names keep the line's colour. Nest inside a Txt.
 */
import React from "react";
import { Text } from "react-native";
import { createSelector } from "@reduxjs/toolkit";
import type { RootState } from "@/store";
import { useAppSelector } from "@/store/hooks";
import { canonicalPlace } from "@/utils/pricing";

/** A piece of a line: plain text, a location or a country. */
export type PlaceSeg = string | { location: string } | { country: string };

export interface PlaceParts {
  location?: string;
  country?: string;
}

/** The countries shipped between most keep fixed colours. */
const FIXED: Record<string, string> = { india: "#F28C28", uae: "#1F9D55" };

/** A place's colour key: "Dubai", "U.A.E" and "UAE" are one place; case and spacing don't matter. */
const keyOf = (name: string) => canonicalPlace(name).toLowerCase();

/**
 * Hue n of a sequence spread round the colour wheel (golden angle), so any number of places get
 * distinct colours; it steps past the hues India and UAE use.
 */
function hueColor(n: number): string {
  let hue = 0;
  for (let i = 0, found = -1; found < n; i++) {
    hue = (210 + i * 137.508) % 360;
    // Leave room round saffron (≈30°) and green (≈145°).
    if (Math.abs(hue - 30) < 12 || Math.abs(hue - 145) < 12) continue;
    found++;
  }
  return `hsl(${Math.round(hue)}, 68%, 48%)`;
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Every place the app knows of, numbered in name order — each number is a colour of its own. */
const selectPlaceColors = createSelector(
  [
    (s: RootState) => s.masters.countries.items,
    (s: RootState) => s.masters.customers.items,
    (s: RootState) => s.masters.stores.items,
    (s: RootState) => s.masters.pricing.items,
    (s: RootState) => s.bookings.items,
  ],
  (countries, customers, stores, pricing, bookings) => {
    const names = new Set<string>();
    const add = (v: unknown) => {
      const k = keyOf(str(v));
      if (k && !FIXED[k]) names.add(k);
    };
    for (const c of countries) add(c.name);
    for (const c of customers) {
      add(c.location);
      add(c.country);
    }
    for (const s of stores) add(s.location);
    for (const p of pricing) {
      add(p.from);
      add(p.to);
    }
    for (const b of bookings) {
      add(b.sender.location);
      add(b.receiver.location);
      add(b.receiver.country);
    }
    const colors = new Map<string, string>();
    [...names].sort().forEach((k, i) => colors.set(k, hueColor(i)));
    return colors;
  }
);

/** Places not in the data yet (typed somewhere new) get the next free colours, in the order they're seen. */
const extra = new Map<string, string>();

/** A place's colour (the one its dot uses), for colouring it outside the app too — e.g. in PDFs. */
export function usePlaceColor() {
  const colors = useAppSelector(selectPlaceColors);
  return (name: string): string => {
    const k = keyOf(name);
    if (FIXED[k]) return FIXED[k];
    const known = colors.get(k);
    if (known) return known;
    let c = extra.get(k);
    if (!c) {
      c = hueColor(colors.size + extra.size);
      extra.set(k, c);
    }
    return c;
  };
}

const Dot = ({ color }: { color: string }) => <Text style={{ color }}>● </Text>;

/** "Kochi, India" with a dot each. `single`: one dot for the whole place (the country's, else the location's). */
export function Place({ location, country, single }: PlaceParts & { single?: boolean }) {
  const dotColor = usePlaceColor();
  if (single) {
    const text = [location, country].filter(Boolean).join(", ");
    if (!text) return null;
    return (
      <>
        <Dot color={dotColor(country || location || "")} />
        {text}
      </>
    );
  }
  return <PlaceSegs segs={placeSegs({ location, country })} />;
}

/** The parts as segments: [location, ", ", country]. */
export function placeSegs({ location, country }: PlaceParts): PlaceSeg[] {
  const segs: PlaceSeg[] = [];
  if (location) segs.push({ location });
  if (location && country) segs.push(", ");
  if (country) segs.push({ country });
  return segs;
}

export function PlaceSegs({ segs }: { segs: PlaceSeg[] }) {
  const dotColor = usePlaceColor();
  return (
    <>
      {segs.map((seg, i) => {
        if (typeof seg === "string") return <React.Fragment key={i}>{seg}</React.Fragment>;
        const text = "location" in seg ? seg.location : seg.country;
        if (!text) return null;
        // Only the dot is coloured; the name keeps the line's own colour.
        return (
          <React.Fragment key={i}>
            <Dot color={dotColor(text)} />
            {text}
          </React.Fragment>
        );
      })}
    </>
  );
}

/** Plain-text form of segments (for search). */
export const segsText = (segs: PlaceSeg[]) => segs.map((s) => (typeof s === "string" ? s : "location" in s ? s.location : s.country)).join("");
