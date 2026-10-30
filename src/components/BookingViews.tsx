/** Booking presentations shared by the dashboard, the bookings list and repacking. */
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Line } from "react-native-svg";
import { Ship } from "lucide-react-native";
import { bookingStage, STAGE_META } from "@/store/selectors";
import type { Tone } from "@/theme/palette";
import { useTheme } from "@/theme/ThemeProvider";
import type { Booking } from "@/types";
import { shortDate } from "@/utils/format";
import { Avatar, Badge, Card, Tag } from "./primitives";
import { Txt } from "./Txt";

export function bookingUnits(b: Booking): string {
  const n = b.actualBundle || b.bundleCount;
  const unit = (b.bundleType || "bundle").toLowerCase();
  const plural = unit === "box" ? "boxes" : unit === "bundle" ? "bundles" : unit;
  return `${n} ${n === 1 && unit === "box" ? "box" : n === 1 && unit === "bundle" ? "bundle" : plural}`;
}

export function receiverPlace(b: Booking, lookup?: { location?: string; country?: string }): string {
  const location = b.receiver.location || lookup?.location || "";
  const country = b.receiver.country || lookup?.country || "";
  return [location, country].filter(Boolean).join(", ");
}

/** Bookings list card: code + status, sender → receiver, tags. */
export function BookingCard({
  booking,
  senderPlace,
  receiverPlaceText,
  packed,
  status,
  onPress,
}: {
  booking: Booking;
  senderPlace: string;
  receiverPlaceText: string;
  /** Packing-list progress, shown while bundles are still being added. */
  packed?: { packed: number; total: number };
  /** Badge to show instead of the booking's repacking/stuffing stage. */
  status?: { label: string; tone: Tone };
  onPress: () => void;
}) {
  const t = useTheme();
  const stage = status ?? STAGE_META[bookingStage(booking)];
  return (
    <Card onPress={onPress} style={{ marginBottom: 12 }}>
      <View style={styles.rowBetween}>
        <Txt mono size={12.5} weight="semibold" color={t.code}>
          {booking.code}
        </Txt>
        <Badge label={stage.label} tone={stage.tone} size="sm" />
      </View>

      <View style={[styles.rowBetween, { marginTop: 14, alignItems: "flex-start" }]}>
        <View style={{ flex: 1 }}>
          <Txt size={10.5} weight="semibold" muted uppercase>
            Sender
          </Txt>
          <Txt size={15} weight="bold" style={{ marginTop: 4 }} numberOfLines={1}>
            {booking.sender.name || "—"}
          </Txt>
          <Txt size={12.5} muted numberOfLines={1}>
            {senderPlace || " "}
          </Txt>
        </View>
        <View style={styles.route}>
          <Svg width={20} height={2}>
            <Line x1="0" y1="1" x2="20" y2="1" stroke={t.borderStrong} strokeDasharray="3 3" strokeWidth={1.4} />
          </Svg>
          <Ship size={15} color={t.primary} strokeWidth={1.8} />
          <Svg width={20} height={2}>
            <Line x1="0" y1="1" x2="20" y2="1" stroke={t.borderStrong} strokeDasharray="3 3" strokeWidth={1.4} />
          </Svg>
        </View>
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <Txt size={10.5} weight="semibold" muted uppercase>
            Receiver
          </Txt>
          <Txt size={15} weight="bold" style={{ marginTop: 4 }} numberOfLines={1}>
            {booking.receiver.name || "—"}
          </Txt>
          <Txt size={12.5} muted numberOfLines={1}>
            {receiverPlaceText || " "}
          </Txt>
        </View>
      </View>

      <View style={styles.tags}>
        <Tag label={`${booking.actualBundle || booking.bundleCount} × ${booking.bundleType || "Bundle"}`} />
        {packed ? <Tag label={`${packed.packed}/${packed.total} packed`} /> : null}
        {booking.productType ? <Tag label={booking.productType} /> : null}
        {booking.billOption ? <Tag label={booking.billOption} /> : null}
        <Tag label={shortDate(booking.date)} />
      </View>
    </Card>
  );
}

/** Compact row for "Recent bookings" on the dashboard. */
export function BookingRow({ booking, city, onPress, last }: { booking: Booking; city: string; onPress: () => void; last?: boolean }) {
  const t = useTheme();
  const stage = STAGE_META[bookingStage(booking)];
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.recentRow,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: t.border },
        pressed && { backgroundColor: t.surfaceAlt },
      ]}
    >
      <Avatar name={booking.sender.name || booking.code} size={40} />
      <View style={{ flex: 1, marginHorizontal: 12 }}>
        <Txt size={14.5} weight="bold" numberOfLines={1}>
          {booking.sender.name || "—"}
          {city ? ` → ${city}` : ""}
        </Txt>
        <Txt size={11.5} mono muted numberOfLines={1} style={{ marginTop: 2 }}>
          {booking.code} · {bookingUnits(booking)}
        </Txt>
      </View>
      <Badge label={stage.short} tone={stage.tone} size="sm" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  route: { flexDirection: "row", alignItems: "center", gap: 3, paddingTop: 22, paddingHorizontal: 6 },
  tags: { flexDirection: "row", flexWrap: "wrap", marginTop: 10 },
  recentRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 14 },
});
