/**
 * One stuffed container — the web console's expanded "Stuffed list" row: its
 * bookings with sender / receiver, bundles, bundle marks, receivable, delivery
 * partner amount and payment status ("CONTAINER BOOKING LIST" PDF). Tap a
 * booking for its charges ("BOOKING CHARGES" PDF) and bundles ("BUNDLE DETAILS" PDF).
 */
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { ChevronDown, ChevronLeft, ChevronRight, Download } from "lucide-react-native";
import { Badge, Card, DashedDivider, IconButton, Stat } from "@/components/primitives";
import { EmptyView, NavHeader, Screen } from "@/components/Screen";
import { Txt } from "@/components/Txt";
import type { MoreScreenProps } from "@/navigation/types";
import { str } from "@/services/mappers";
import { packageService, type BookingPackingList } from "@/services/packageService";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { ensureMaster } from "@/store/ensure";
import { useTheme } from "@/theme/ThemeProvider";
import { fullDate, money } from "@/utils/format";
import { downloadTablePdf } from "@/utils/tablePdf";
import { downloadContainerBookingList, PAYMENT_TONE, pdfMoney, useStuffedData, type StuffedBooking, type StuffedRow } from "./useStuffedData";

interface BundleLine {
  bundle: string;
  product: string;
  qty: string;
  fabric: string;
}

export function StuffedContainerScreen({ navigation, route }: MoreScreenProps<"StuffedContainer">) {
  const t = useTheme();
  const dispatch = useAppDispatch();
  const { rows, bookingRow } = useStuffedData();
  const row = rows.find((r) => r.id === route.params.stuffingId);
  const [openId, setOpenId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    dispatch(ensureMaster("products"));
    dispatch(ensureMaster("fabrics"));
  }, [dispatch]);

  const bookings = useMemo(() => (row ? row.bookingIds.map(bookingRow) : []), [row, bookingRow]);
  const back = <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} accessibilityLabel="Back" />;

  if (!row) {
    return (
      <Screen>
        <NavHeader left={back} title="Container" />
        <EmptyView title="Container not found" message="It may have been removed. Go back and pull to refresh." />
      </Screen>
    );
  }

  const containerInfo: [string, string][] = [
    ["Container ID", row.containerCode],
    ["Container Name", row.containerName],
  ];

  const run = async (key: string, task: () => Promise<void>) => {
    setDownloading(key);
    try {
      await task();
    } catch (e) {
      Alert.alert("Couldn't create the PDF", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setDownloading(null);
    }
  };

  /** The web's container manifest ("CONTAINER BOOKING LIST"). */
  const downloadManifest = () => run("manifest", () => downloadContainerBookingList(row, bookings));

  const totalBundles = bookings.reduce((n, b) => n + b.bundles, 0);

  return (
    <Screen>
      <NavHeader
        left={back}
        title={row.containerCode}
        right={
          downloading === "manifest" ? (
            <ActivityIndicator color={t.primary} style={{ width: 40 }} />
          ) : (
            <IconButton icon={Download} onPress={downloadManifest} accessibilityLabel="Download container booking list PDF" />
          )
        }
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 30 }}>
        <Card style={{ marginBottom: 14 }}>
          <Txt size={15} weight="bold">
            {row.containerName}
          </Txt>
          <View style={[styles.stats, { borderColor: t.border }]}>
            <Stat label="Stuffed" value={row.stuffedDate ? fullDate(row.stuffedDate) : "—"} />
            <Stat label="Bookings" value={String(bookings.length)} />
            <Stat label="Bundles" value={String(totalBundles)} align="right" />
          </View>
        </Card>

        {bookings.length === 0 ? (
          <EmptyView title="No bookings" message="This stuffing has no bookings recorded." />
        ) : (
          bookings.map((b, i) => (
            <StuffedBookingCard
              key={b.id}
              slNo={i + 1}
              item={b}
              row={row}
              containerInfo={containerInfo}
              open={openId === b.id}
              onToggle={() => setOpenId(openId === b.id ? null : b.id)}
              downloading={downloading}
              run={run}
            />
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

/** A booking on a stuffed container: tap to expand its charges and bundles, each with its PDF (web's expanded row). */
export function StuffedBookingCard({
  slNo,
  item,
  row,
  containerInfo,
  open,
  onToggle,
  downloading,
  run,
}: {
  slNo: number;
  item: StuffedBooking;
  row: StuffedRow;
  containerInfo: [string, string][];
  open: boolean;
  onToggle: () => void;
  downloading: string | null;
  run: (key: string, task: () => Promise<void>) => Promise<void>;
}) {
  const t = useTheme();
  const b = item.booking;
  const products = useAppSelector((s) => s.masters.products.items);
  const fabrics = useAppSelector((s) => s.masters.fabrics.items);
  const [list, setList] = useState<BookingPackingList | null | undefined>(undefined);

  // Load the packing list the first time the booking is opened.
  useEffect(() => {
    if (!open || list !== undefined) return;
    void packageService
      .getByBooking(item.id)
      .then(setList)
      .catch(() => setList(null));
  }, [open, list, item.id]);

  const packages = useAppSelector((s) => s.containers.packages);
  const markOf = useMemo(() => {
    // Bundle mark IDs number every saved bundle across all packing lists in id order, like the web.
    const ids = packages.flatMap((p) => p.bundles.map((x) => x.id)).filter(Boolean).sort();
    return new Map(ids.map((id, i) => [id, i + 1]));
  }, [packages]);

  const nameOf = (items: { _id: string; name?: unknown }[], id?: string) => (id ? str(items.find((x) => x._id === id)?.name) : "");
  const lines: BundleLine[] = (list?.bundles ?? []).flatMap((bundle) =>
    bundle.lines.map((l) => ({
      bundle: `Bundle ${bundle.bundleNo}${markOf.get(bundle.id) ? ` (mark ${markOf.get(bundle.id)})` : ""}`,
      product: nameOf(products, l.productId) || "—",
      qty: String(l.quantity || "—"),
      fabric: nameOf(fabrics, l.fabricId) || "—",
    }))
  );

  if (!b) {
    return (
      <Card style={{ marginBottom: 10 }}>
        <Txt size={13} muted>
          This booking no longer exists.
        </Txt>
      </Card>
    );
  }

  const afterDelivery = item.receivable === undefined ? undefined : item.receivable - (item.deliveryPartnerAmount ?? 0);
  const info: [string, string][] = [...containerInfo, ["Booking ID", b.code], ["Booking Date", fullDate(b.date)]];

  const downloadCharges = () =>
    run(`charges-${b.id}`, () =>
      downloadTablePdf(`${b.code}-charges.pdf`, {
        title: "BOOKING CHARGES",
        landscape: true,
        info,
        head: ["Sl No", "Booking ID", "Sender Name", "Sender Contact", "Receiver Name", "Receiver Contact", "No. of Bundles", "Bundle Mark", "Pickup Charge", "Brand Handling", "Bundle Handling", "Delivery Partner", "Per Bundle", "Total Receivable", "After Delivery"],
        body: [
          [
            "1",
            b.code,
            item.sender.name,
            item.sender.contact,
            item.receiver.name,
            item.receiver.contact,
            String(item.bundles),
            item.bundleMarks || "-",
            pdfMoney(b.pickupCharge),
            pdfMoney(b.brandHandlingCharge),
            pdfMoney(b.bundleHandlingCharge),
            pdfMoney(item.deliveryPartnerAmount),
            pdfMoney(item.perBundleCharge),
            pdfMoney(item.receivable),
            pdfMoney(afterDelivery),
          ],
        ],
      })
    );

  const downloadBundles = () =>
    run(`bundles-${b.id}`, () => {
      const totalQty = lines.reduce((n, l) => n + (Number(l.qty) || 0), 0);
      return downloadTablePdf(`${b.code}-bundles.pdf`, {
        title: "BUNDLE DETAILS",
        landscape: true,
        info,
        head: ["Sl No", "Booking ID", "Bundles", "Products", "Qty", "Fabrics", "Minimum Bundles", "Branded / Normal", "With / Without Bill"],
        body: lines.map((l, i) => [String(i + 1), b.code, l.bundle, l.product, l.qty, l.fabric, item.bundles < 5 ? "Below 5" : "5 or more", b.productType || "—", b.billOption || "—"]),
        foot: ["", "", "", "Total Qty", String(totalQty), "", "", "", ""],
      });
    });

  return (
    <Card style={{ marginBottom: 10 }} padded={false}>
      <Pressable onPress={onToggle} style={styles.cardHead} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <View style={{ flex: 1 }}>
          <View style={styles.rowBetween}>
            <Txt mono size={12.5} weight="semibold" color={t.code}>
              {slNo}. {b.code}
            </Txt>
            <Badge label={item.paymentStatus} tone={PAYMENT_TONE[item.paymentStatus]} size="sm" />
          </View>
          <Txt size={14.5} weight="bold" numberOfLines={1} style={{ marginTop: 6 }}>
            {item.sender.name || "—"} → {item.receiver.name || "—"}
          </Txt>
          <Txt size={12} muted numberOfLines={1}>
            {[item.sender.lines[0], item.receiver.lines[0]].filter(Boolean).join("  →  ") || " "}
          </Txt>
          <View style={[styles.stats, { borderColor: t.border }]}>
            <Stat label="Bundles" value={String(item.bundles)} />
            <Stat label="Receivable" value={item.receivable === undefined ? "—" : money(item.receivable)} />
            <Stat label="Delivery partner" value={item.deliveryPartnerAmount === undefined ? "—" : money(item.deliveryPartnerAmount)} align="right" />
          </View>
          {item.bundleMarks ? (
            <Txt size={12} muted style={{ marginTop: 8 }} numberOfLines={2}>
              Bundle marks: {item.bundleMarks}
            </Txt>
          ) : null}
        </View>
        <View style={{ marginLeft: 8 }}>{open ? <ChevronDown size={18} color={t.textMuted} /> : <ChevronRight size={18} color={t.textMuted} />}</View>
      </Pressable>

      {open && (
        <View style={[styles.detail, { borderColor: t.border }]}>
          <SectionHead title="Charges" loading={downloading === `charges-${b.id}`} onDownload={downloadCharges} />
          <Line label="Sender contact" value={item.sender.contact} />
          <Line label="Receiver contact" value={item.receiver.contact} />
          <Line label="Pickup charge" value={money(b.pickupCharge)} />
          <Line label="Brand handling charge" value={money(b.brandHandlingCharge)} />
          <Line label="Bundle handling charge" value={money(b.bundleHandlingCharge)} />
          <Line label="Delivery partner charge" value={item.deliveryPartnerAmount === undefined ? "—" : money(item.deliveryPartnerAmount)} />
          <Line label="Per bundle charge" value={item.perBundleCharge === undefined ? "—" : money(item.perBundleCharge)} />
          <DashedDivider />
          <Line label="Total receivable" value={item.receivable === undefined ? "—" : money(item.receivable)} strong />
          <Line label="After delivery charge" value={afterDelivery === undefined ? "—" : money(afterDelivery)} strong />

          <View style={{ height: 14 }} />
          <SectionHead title="Bundles" loading={downloading === `bundles-${b.id}`} onDownload={lines.length ? downloadBundles : undefined} />
          {list === undefined ? (
            <ActivityIndicator color={t.primary} style={{ marginVertical: 10 }} />
          ) : lines.length === 0 ? (
            <Txt size={12.5} muted>
              No packing list saved for this booking's bundles.
            </Txt>
          ) : (
            <>
              {lines.map((l, i) => (
                <View key={i} style={[styles.bundleLine, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: t.border }]}>
                  <View style={{ flex: 1 }}>
                    <Txt size={12} muted>
                      {l.bundle}
                    </Txt>
                    <Txt size={13.5} weight="semibold">
                      {[l.product, l.fabric !== "—" ? l.fabric : ""].filter(Boolean).join(" · ")}
                    </Txt>
                  </View>
                  <Txt size={13.5} weight="bold">
                    × {l.qty}
                  </Txt>
                </View>
              ))}
              <View style={styles.tags}>
                <Badge label={item.bundles < 5 ? "Below 5 bundles" : "5 or more bundles"} tone="neutral" size="sm" dot={false} />
                {b.productType ? <Badge label={b.productType} tone="neutral" size="sm" dot={false} /> : null}
                {b.billOption ? <Badge label={b.billOption} tone={b.billOption === "With Bill" ? "info" : "warning"} size="sm" dot={false} /> : null}
              </View>
            </>
          )}
        </View>
      )}
    </Card>
  );
}

function SectionHead({ title, loading, onDownload }: { title: string; loading: boolean; onDownload?: () => void }) {
  const t = useTheme();
  return (
    <View style={[styles.rowBetween, { marginBottom: 6 }]}>
      <Txt size={14} weight="bold">
        {title}
      </Txt>
      {onDownload &&
        (loading ? (
          <ActivityIndicator size="small" color={t.primary} />
        ) : (
          <Pressable onPress={onDownload} hitSlop={8} style={styles.pdfBtn} accessibilityLabel={`Download ${title.toLowerCase()} PDF`}>
            <Download size={14} color={t.primary} />
            <Txt size={12.5} weight="semibold" color={t.primary}>
              PDF
            </Txt>
          </Pressable>
        ))}
    </View>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.line}>
      <Txt size={13} muted={!strong} weight={strong ? "bold" : "regular"} style={{ flex: 1, marginRight: 12 }}>
        {label}
      </Txt>
      <Txt size={13.5} weight={strong ? "bold" : "semibold"}>
        {value}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  stats: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, marginTop: 12, paddingTop: 10 },
  cardHead: { flexDirection: "row", alignItems: "center", padding: 16 },
  detail: { borderTopWidth: StyleSheet.hairlineWidth, padding: 16 },
  line: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 5 },
  bundleLine: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  pdfBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
});
