/**
 * Reports: pick a From / To range (the calendar jumps by month and year),
 * and see the stuffed bookings grouped container-wise, customer-wise (sender)
 * or country-wise (receiver's country) — with a PDF of the same view.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { ChevronDown, ChevronLeft, ChevronRight, Download, MapPin, Phone, Tag, Truck } from "lucide-react-native";
import { showError } from "@/components/AppAlert";
import { DatePickerField } from "@/components/DatePickerField";
import { Avatar, Badge, Card, IconButton, Stat } from "@/components/primitives";
import { EmptyView, NavHeader, Screen } from "@/components/Screen";
import { Segmented } from "@/components/Segmented";
import { Place, usePlaceColor } from "@/components/Place";
import { Txt } from "@/components/Txt";
import { useRefresh } from "@/hooks/useBootstrapData";
import { useCustomerLookup } from "@/hooks/useCustomerLookup";
import type { MoreScreenProps } from "@/navigation/types";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { ensureBookings, ensureContainers, ensureFinance, ensureMaster } from "@/store/ensure";
import { fetchBookings } from "@/store/slices/bookingsSlice";
import { fetchContainers } from "@/store/slices/containersSlice";
import { fetchFinance } from "@/store/slices/financeSlice";
import { radius } from "@/theme/fonts";
import { useTheme } from "@/theme/ThemeProvider";
import type { Booking } from "@/types";
import { fullDate, money, parseDate } from "@/utils/format";
import { downloadTablePdf, type PdfSpan } from "@/utils/tablePdf";
import { useStuffedData, type StuffedBooking } from "@/screens/stuffedContainers/useStuffedData";

type GroupBy = "container" | "customer" | "country" | "partner";
const GROUPS = ["container", "country", "customer", "partner"] as const;
const GROUP_LABELS = { container: "Container", customer: "Customer", country: "Country", partner: "Delivery Partner" } as const;

const pad = (n: number) => String(n).padStart(2, "0");
const monthStart = (y: number, m: number) => `${y}-${pad(m + 1)}-01`;
const monthEnd = (y: number, m: number) => `${y}-${pad(m + 1)}-${pad(new Date(y, m + 1, 0).getDate())}`;
/** A booking's date as a local "YYYY-MM-DD", comparable with the picker values. */
const localDay = (value?: string) => {
  const d = parseDate(value);
  return d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : "";
};

interface ReportRow {
  booking: Booking;
  /** Receiver details, bundle marks and invoice figures, as the Stuffed list shows them. */
  item: StuffedBooking;
  day: string;
  bundles: number;
  partner: string;
  payable: number;
  receivable: number;
}

interface ReportGroup {
  key: string;
  label: string;
  sublabel?: string;
  rows: ReportRow[];
  bundles: number;
  payable: number;
  receivable: number;
}

export function BookingReportsScreen({ navigation }: MoreScreenProps<"BookingReports">) {
  const t = useTheme();
  const dispatch = useAppDispatch();
  const bookings = useAppSelector((s) => s.bookings.items);
  const bookingsStatus = useAppSelector((s) => s.bookings.status);
  const stuffings = useAppSelector((s) => s.containers.stuffings);
  const containers = useAppSelector((s) => s.containers.items);
  const lookup = useCustomerLookup();
  const placeColor = usePlaceColor();
  const { bookingRow } = useStuffedData();

  const now = new Date();
  const [from, setFrom] = useState(monthStart(now.getFullYear(), now.getMonth()));
  const [to, setTo] = useState(monthEnd(now.getFullYear(), now.getMonth()));
  const [groupBy, setGroupBy] = useState<GroupBy>("container");
  const [openKey, setOpenKey] = useState<string | null>(null);
  // The group whose PDF is being made.
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    dispatch(ensureBookings());
    dispatch(ensureContainers());
    dispatch(ensureFinance());
    dispatch(ensureMaster("customers"));
    dispatch(ensureMaster("pricing"));
  }, [dispatch]);

  const load = useCallback(() => Promise.all([dispatch(fetchBookings()), dispatch(fetchContainers()), dispatch(fetchFinance())]), [dispatch]);
  const { refreshing, onRefresh } = useRefresh(load);

  const containerOf = useMemo(() => {
    const map = new Map<string, { id: string; label: string; sublabel: string }>();
    for (const st of stuffings) {
      const c = containers.find((x) => x.id === st.container);
      for (const id of st.bookings) map.set(id, { id: st.container, label: c?.code ?? "—", sublabel: c?.company ?? "" });
    }
    return map;
  }, [stuffings, containers]);
  const rows = useMemo<ReportRow[]>(
    () =>
      bookings
        // Only bookings already stuffed into a container.
        .filter((b) => {
          const day = localDay(b.date);
          return containerOf.has(b.id) && day && day >= from && day <= to;
        })
        .map((b) => {
          const item = bookingRow(b.id);
          return {
            booking: b,
            item,
            day: localDay(b.date),
            bundles: item.bundles,
            partner: item.invoice?.deliveryPartner ?? "",
            payable: item.deliveryPartnerAmount ?? 0,
            receivable: item.receivable ?? 0,
          };
        })
        .sort((a, b) => (a.day === b.day ? a.booking.code.localeCompare(b.booking.code) : a.day.localeCompare(b.day))),
    [bookings, bookingRow, containerOf, from, to]
  );

  const groups = useMemo<ReportGroup[]>(() => {
    const map = new Map<string, ReportGroup>();
    for (const r of rows) {
      const b = r.booking;
      let key: string;
      let label: string;
      let sublabel: string | undefined;
      if (groupBy === "container") {
        const c = containerOf.get(b.id)!;
        key = c.id;
        label = c.label;
        sublabel = c.sublabel;
      } else if (groupBy === "customer") {
        key = b.sender.id || b.sender.name;
        label = b.sender.name || "—";
        sublabel = lookup.senderPlace(b);
      } else if (groupBy === "partner") {
        // The partner is chosen on the invoice, so bookings not invoiced yet have none.
        key = r.partner.toLowerCase() || "~uninvoiced";
        label = r.partner || "Not invoiced yet";
      } else {
        const country = lookup.receiverCountry(b);
        key = country.toLowerCase() || "~unknown";
        label = country || "Country not set";
      }
      const g = map.get(key) ?? { key, label, sublabel, rows: [], bundles: 0, payable: 0, receivable: 0 };
      g.rows.push(r);
      g.bundles += r.bundles;
      g.payable += r.payable;
      g.receivable += r.receivable;
      map.set(key, g);
    }
    // Biggest groups first; "Country not set" / "Not invoiced yet" go last.
    return [...map.values()].sort((a, b) => (a.key.startsWith("~") ? 1 : b.key.startsWith("~") ? -1 : b.rows.length - a.rows.length || a.label.localeCompare(b.label)));
  }, [rows, groupBy, containerOf, lookup]);

  const totalBundles = rows.reduce((n, r) => n + r.bundles, 0);
  const totalReceivable = rows.reduce((n, r) => n + r.receivable, 0);
  const rangeLabel = `${fullDate(from)} – ${fullDate(to)}`;

  /** One group's PDF: its bookings in the chosen dates. */
  const downloadGroupPdf = async (g: ReportGroup) => {
    if (downloading) return;
    setDownloading(g.key);
    try {
      const label = GROUP_LABELS[groupBy];
      // Places print in their place colour; a receiver's place takes its country's.
      const groupName: PdfSpan[] =
        groupBy === "country" && !g.key.startsWith("~")
          ? [{ text: g.label, color: placeColor(g.label) }]
          : groupBy === "customer" && g.sublabel
            ? [g.label, " · ", { text: g.sublabel, color: placeColor(g.sublabel) }]
            : [[g.label, g.sublabel].filter(Boolean).join(" · ")];
      const slug = g.label.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "group";
      await downloadTablePdf(`booking-report-${groupBy}-${slug}-${from}-to-${to}.pdf`, {
        title: `${label.toUpperCase()} WISE BOOKING REPORT`,
        landscape: true,
        info: [
          [label, groupName],
          ["Period", rangeLabel],
          ["No. of Bookings", String(g.rows.length)],
          ["No. of Bundles", String(g.bundles)],
          ["Generated On", fullDate(new Date().toISOString())],
        ],
        head: ["Sl No", "Booking ID", "Receiver Details", "Bundle Mark", "Bundle Count", "Delivery Partner", "Delivery Partner Payable Amount", "Total Receivable Amount"],
        body: g.rows.map((r, i) => {
          const rc = receiverOf(r);
          // The receiver's full details (name, place, number) print in their country's colour.
          const details = [rc.name, rc.location, rc.contact].filter(Boolean).join(", ");
          const place = lookup.receiverCountry(r.booking) || rc.location;
          return [
            String(i + 1),
            r.booking.code,
            details ? [{ text: details, color: place ? placeColor(place) : undefined }] : "-",
            r.item.bundleMarks || "-",
            String(r.bundles),
            r.partner || "-",
            r.item.invoice ? money(r.payable) : "-",
            r.item.invoice ? money(r.receivable) : "-",
          ];
        }),
        foot: ["", "", "", "Total", String(g.bundles), "", money(g.payable), money(g.receivable)],
      });
    } catch (e) {
      showError("Couldn't create the PDF", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <Screen>
      <NavHeader
        left={<IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} accessibilityLabel="Back" />}
        title="Reports"
      />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pair}>
          <View style={{ flex: 1 }}>
            <DatePickerField
              label="From"
              value={from}
              maxDate={to}
              onChange={(v) => {
                setFrom(v);
                setOpenKey(null);
              }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <DatePickerField
              label="To"
              value={to}
              minDate={from}
              onChange={(v) => {
                setTo(v);
                setOpenKey(null);
              }}
            />
          </View>
        </View>

        <Segmented
          options={GROUPS}
          labels={{ container: "Container", country: "Country", customer: "Customer", partner: "Delivery" }}
          value={groupBy}
          onChange={(v) => {
            setGroupBy(v);
            setOpenKey(null);
          }}
        />

        <Card style={{ marginTop: 14, marginBottom: 14 }}>
          <Txt size={12} muted>
            {rangeLabel}
          </Txt>
          <View style={[styles.stats, { borderColor: t.border }]}>
            <Stat label="Bookings" value={String(rows.length)} />
            <Stat label="Bundles" value={String(totalBundles)} />
            <Stat label="Receivable" value={money(totalReceivable)} align="right" />
          </View>
        </Card>

        {bookingsStatus === "loading" && bookings.length === 0 ? (
          <ActivityIndicator color={t.primary} style={{ marginTop: 24 }} />
        ) : groups.length === 0 ? (
          <EmptyView title="No stuffed bookings" message="No bookings made in the selected dates have been stuffed yet." />
        ) : (
          groups.map((g) => (
            <GroupCard
              key={g.key}
              group={g}
              open={openKey === g.key}
              onToggle={() => setOpenKey(openKey === g.key ? null : g.key)}
              groupBy={groupBy}
              downloading={downloading === g.key}
              onDownload={() => downloadGroupPdf(g)}
            />
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

/** Receiver name, location and contact number. */
function receiverOf(r: ReportRow) {
  const rc = r.item.receiver;
  return { name: rc.name || r.booking.receiver.name, location: rc.lines[0] ?? "", contact: rc.contact !== "—" ? rc.contact : "" };
}

function GroupCard({
  group,
  open,
  onToggle,
  groupBy,
  downloading,
  onDownload,
}: {
  group: ReportGroup;
  open: boolean;
  onToggle: () => void;
  groupBy: GroupBy;
  downloading: boolean;
  onDownload: () => void;
}) {
  const t = useTheme();
  return (
    <Card style={{ marginBottom: 12 }} padded={false}>
      <Pressable onPress={onToggle} style={styles.groupHead} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <View style={{ flex: 1 }}>
          <Txt size={15} weight="bold" numberOfLines={1}>
            {groupBy === "country" && !group.key.startsWith("~") ? <Place country={group.label} /> : group.label}
          </Txt>
          {group.sublabel ? (
            <Txt size={12} muted numberOfLines={1}>
              {groupBy === "customer" ? <Place location={group.sublabel} /> : group.sublabel}
            </Txt>
          ) : null}
          <View style={styles.groupBadges}>
            <Badge label={`${group.rows.length} booking${group.rows.length === 1 ? "" : "s"}`} tone="info" size="sm" dot={false} />
            <Badge label={`${group.bundles} bundle${group.bundles === 1 ? "" : "s"}`} tone="purple" size="sm" dot={false} />
            <Badge label={money(group.receivable)} tone="success" size="sm" dot={false} />
          </View>
        </View>
        {downloading ? (
          <ActivityIndicator color={t.primary} style={{ width: 36 }} />
        ) : (
          <IconButton icon={Download} size={36} onPress={onDownload} accessibilityLabel={`Download ${group.label} PDF`} />
        )}
        {open ? <ChevronDown size={18} color={t.textMuted} /> : <ChevronRight size={18} color={t.textMuted} />}
      </Pressable>
      {open && (
        <View style={[styles.detail, { borderColor: t.border }]}>
          {group.rows.map((r) => (
            <BookingCard key={r.booking.id} row={r} />
          ))}
        </View>
      )}
    </Card>
  );
}

/** One stuffed booking: receiver, bundles, delivery partner and the two amounts. */
function BookingCard({ row: r }: { row: ReportRow }) {
  const t = useTheme();
  const rc = receiverOf(r);
  const invoiced = !!r.item.invoice;
  return (
    <View style={[styles.booking, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}>
      <View style={styles.bookingHead}>
        <Txt mono size={13.5} weight="bold" color={t.code}>
          {r.booking.code}
        </Txt>
        <Badge label={`${r.bundles} bundle${r.bundles === 1 ? "" : "s"}`} tone="purple" size="sm" dot={false} />
      </View>

      <View style={styles.receiver}>
        <Avatar name={rc.name || "?"} size={38} />
        <View style={{ flex: 1, gap: 2 }}>
          <Txt size={14.5} weight="bold" numberOfLines={1}>
            {rc.name || "—"}
          </Txt>
          <IconLine icon={MapPin} text={rc.location ? <Place {...r.item.receiver.place} single /> : "Location not set"} />
          <IconLine icon={Phone} text={rc.contact || "No contact number"} />
        </View>
      </View>

      <View style={[styles.facts, { borderColor: t.border }]}>
        <Fact icon={Tag} label="Bundle mark" value={r.item.bundleMarks || "—"} />
        <Fact icon={Truck} label="Delivery partner" value={r.partner || "—"} />
      </View>

      <View style={[styles.amounts, { borderColor: t.border }]}>
        <AmountLine label="Delivery partner payable" value={invoiced ? money(r.payable) : "Not invoiced"} />
        <AmountLine label="Total receivable" value={invoiced ? money(r.receivable) : "Not invoiced"} />
      </View>
    </View>
  );
}

type IconType = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

function IconLine({ icon: Icon, text }: { icon: IconType; text: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <Icon size={13} color={t.textMuted} strokeWidth={2} />
      <Txt size={12.5} muted numberOfLines={1} style={{ flex: 1 }}>
        {text}
      </Txt>
    </View>
  );
}

function Fact({ icon: Icon, label, value }: { icon: IconType; label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, gap: 3 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
        <Icon size={13} color={t.textMuted} strokeWidth={2} />
        <Txt size={11} muted uppercase weight="semibold">
          {label}
        </Txt>
      </View>
      <Txt size={13.5} weight="semibold" numberOfLines={2}>
        {value}
      </Txt>
    </View>
  );
}

function AmountLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.amount}>
      <Txt size={13} muted>
        {label}
      </Txt>
      <Txt size={14} weight="bold">
        {value}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  pair: { flexDirection: "row", gap: 10 },
  stats: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth * 2, paddingTop: 10, marginTop: 10 },
  groupHead: { flexDirection: "row", alignItems: "center", gap: 8, padding: 14 },
  groupBadges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  detail: { borderTopWidth: StyleSheet.hairlineWidth * 2, padding: 12, gap: 10 },
  booking: { borderWidth: 1, borderRadius: radius.md, padding: 12 },
  bookingHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  receiver: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  facts: { flexDirection: "row", gap: 12, borderTopWidth: StyleSheet.hairlineWidth * 2, marginTop: 12, paddingTop: 10 },
  amounts: { borderTopWidth: StyleSheet.hairlineWidth * 2, marginTop: 12, paddingTop: 8, gap: 6 },
  amount: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
});
