/** 04 · Booking detail — progress timeline, contacts, shipment, charges, next action. */
import React, { useEffect, useState } from "react";
import { Alert, Linking, ScrollView, Share, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowRight, Check, ChevronLeft, Download, EllipsisVertical, FileText, Loader, MessageCircle, Phone, Share2, Trash2 } from "lucide-react-native";
import { ActionSheet, BottomSheet } from "@/components/ActionSheet";
import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Avatar, Card, DashedDivider, IconButton, SectionTitle } from "@/components/primitives";
import { EmptyView, NavHeader, Screen } from "@/components/Screen";
import { Txt } from "@/components/Txt";
import { useCustomerLookup } from "@/hooks/useCustomerLookup";
import type { RootScreenProps } from "@/navigation/types";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { bookingStage, selectPackingByBooking, STAGE_META } from "@/store/selectors";
import { ensureMaster } from "@/store/ensure";
import { deleteBooking } from "@/store/slices/bookingsSlice";
import { useTheme } from "@/theme/ThemeProvider";
import type { Booking } from "@/types";
import { fullDate, money, shortDate } from "@/utils/format";
import { downloadGoodsReceivedPdf } from "@/utils/goodsReceivedPdf";
import { downloadInvoicePdf } from "@/utils/invoicePdf";

/**
 * Progress steps, following the web console's shipment pipeline (Repacking →
 * Ready to ship → Stuffed). "Repacked" only appears for bookings that needed
 * repacking. Each step is done or not; the first one not done is current.
 */
function progressSteps(b: Booking): { key: string; label: string; done: boolean }[] {
  const packed = b.repackingStatus === "Ready to Ship";
  const needsRepack = b.repackingStatus === "Repacking Required" || b.actualBundle > 0;
  return [
    { key: "booked", label: "Booked", done: true },
    ...(needsRepack ? [{ key: "repacked", label: "Repacked", done: packed }] : []),
    { key: "packageReady", label: "Package ready", done: packed && (b.packageListStatus === "Added" || b.stuffStatus === "Stuffed") },
    { key: "stuffed", label: "Stuffed", done: b.stuffStatus === "Stuffed" },
  ];
}

const digits = (phone?: string) => (phone ?? "").replace(/[^\d+]/g, "");

function bookingSummary(b: Booking, senderPlace: string, receiverPlace: string): string {
  const extra = b.brandHandlingCharge + b.pickupCharge + b.bundleHandlingCharge;
  return [
    `Booking ${b.code}`,
    `Date: ${fullDate(b.date)}`,
    `Status: ${STAGE_META[bookingStage(b)].label}`,
    "",
    `Sender: ${b.sender.name}${senderPlace ? ` (${senderPlace})` : ""}`,
    `Receiver: ${b.receiver.name}${receiverPlace ? ` (${receiverPlace})` : ""}`,
    "",
    `Bundles: ${b.bundleCount}${b.actualBundle ? ` (actual ${b.actualBundle})` : ""} × ${b.bundleType}`,
    `Product: ${b.productType} · ${b.billOption}`,
    b.pickupOption ? `Pickup LR: ${b.pickupOption}` : "",
    "",
    `Brand handling: ${money(b.brandHandlingCharge)}`,
    `Pickup charge: ${money(b.pickupCharge)}`,
    `Bundle handling: ${money(b.bundleHandlingCharge)}`,
    `Extra charges: ${money(extra)}`,
  ]
    .filter((line, i, arr) => !(line === "" && arr[i - 1] === ""))
    .join("\n");
}

export function BookingDetailScreen({ navigation, route }: RootScreenProps<"BookingDetail">) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const booking = useAppSelector((s) => s.bookings.items.find((b) => b.id === route.params.id));
  const mutatingId = useAppSelector((s) => s.bookings.mutatingId);
  const lookup = useCustomerLookup();
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const invoice = useAppSelector((s) => s.finance.invoices.find((i) => i.bookingId === route.params.id));
  const packing = useAppSelector(selectPackingByBooking);
  const products = useAppSelector((s) => s.masters.products.items);
  useEffect(() => {
    dispatch(ensureMaster("products"));
  }, [dispatch]);
  // Bundle marks and product names for the invoice form PDF.
  const invoiceExtras = {
    marks: (packing.get(route.params.id)?.marks ?? []).join(", "),
    productName: (id: string) => String(products.find((p) => p._id === id)?.name ?? ""),
  };
  const [downloading, setDownloading] = useState(false);
  const [sharingPdf, setSharingPdf] = useState(false);
  const [noInvoiceOpen, setNoInvoiceOpen] = useState(false);

  const back = <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} accessibilityLabel="Back" />;

  if (!booking) {
    return (
      <Screen>
        <NavHeader left={back} title="Booking" />
        <EmptyView title="Booking not found" message="It may have been deleted. Pull to refresh the bookings list." />
      </Screen>
    );
  }

  const stage = bookingStage(booking);
  const steps = progressSteps(booking);
  // Package list status not "Added" yet → finish the packing list on Ready to ship first.
  const needsPackingList = booking.repackingStatus === "Ready to Ship" && booking.packageListStatus !== "Added";
  const toPackageReady = { title: "Package ready", onPress: () => navigation.navigate("ReadyToShip", { bookingId: booking.id }) };
  const currentIndex = steps.findIndex((s) => !s.done);
  const senderInfo = lookup.map.get(booking.sender.id);
  const receiverInfo = lookup.map.get(booking.receiver.id);
  const senderPlace = lookup.senderPlace(booking);
  const receiverPlace = lookup.receiverPlace(booking);
  const extra = booking.brandHandlingCharge + booking.pickupCharge + booking.bundleHandlingCharge;
  const busy = mutatingId === booking.id;

  const run = async (action: () => Promise<{ meta: { requestStatus: string }; payload?: unknown }>) => {
    const result = await action();
    if (result.meta.requestStatus === "rejected") Alert.alert("Couldn't update", String(result.payload ?? "Please try again."));
  };

  const summary = bookingSummary(booking, senderPlace, receiverPlace);
  const share = () => {
    setShareOpen(false);
    void Share.share({ title: `Booking ${booking.code}`, message: summary });
  };

  const downloadInvoice = async () => {
    if (!invoice) return setNoInvoiceOpen(true);
    setDownloading(true);
    try {
      await downloadInvoicePdf(invoice, booking, {
        name: booking.receiver.name,
        lines: [receiverPlace, receiverInfo?.whatsapp ? `Ph: ${receiverInfo.whatsapp}` : ""],
      }, invoiceExtras);
    } catch (e) {
      Alert.alert("Couldn't create the PDF", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  /** The booking as an Introlines Goods Received Note PDF, for the share sheet. */
  const shareDetailsPdf = async () => {
    const phone = (p?: string) => (p ? `Ph: ${p}` : "");
    const bundles = booking.actualBundle || booking.bundleCount;
    setSharingPdf(true);
    try {
      await downloadGoodsReceivedPdf(`${booking.code}-goods-received.pdf`, {
        bookingId: booking.code,
        date: fullDate(booking.date),
        shipmentMode: "By Sea",
        sender: { name: booking.sender.name, lines: [senderPlace, phone(booking.sender.whatsapp || senderInfo?.whatsapp)] },
        receiver: { name: booking.receiver.name, lines: [receiverPlace, phone(booking.receiver.whatsapp || receiverInfo?.whatsapp)] },
        destination: receiverPlace || "-",
        bundles: `${bundles}${booking.bundleType ? ` ${booking.bundleType}` : ""}`,
        bundleMark: booking.code,
      });
    } catch (e) {
      Alert.alert("Couldn't create the PDF", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setSharingPdf(false);
    }
  };

  // iOS can't present a modal while another is still sliding away, so open the next one after the menu closes.
  const fromMenu = (open: () => void) => {
    setMenuOpen(false);
    setTimeout(open, 300);
  };

  const confirmDelete = async () => {
    setDeleteError(null);
    const res = await dispatch(deleteBooking(booking.id));
    if (deleteBooking.fulfilled.match(res)) {
      setDeleteOpen(false);
      navigation.goBack();
    } else setDeleteError(res.payload ?? "Couldn't delete the booking. Please try again.");
  };

  const openChat = (phone?: string) => {
    const n = digits(phone).replace(/^\+/, "");
    if (!n) return Alert.alert("No WhatsApp number", "Add one on the customer record.");
    void Linking.openURL(`https://wa.me/${n}`);
  };
  const call = (phone?: string) => {
    const n = digits(phone);
    if (!n) return Alert.alert("No phone number", "Add one on the customer record.");
    void Linking.openURL(`tel:${n}`);
  };


  const primary = (() => {
    switch (stage) {
      // Repacking Required → the Repacking workspace builds its bundles and marks it Ready to Ship.
      case "repacking":
        return { title: "Repacking", onPress: () => navigation.navigate("Repacking", { bookingId: booking.id }) };
      // Ready to Ship → every bundle needs a packing list (Ready to ship workspace) before it can go to stuffing.
      // Packed and ready (or already queued): stuffing happens elsewhere, so just offer a way back.
      case "ready":
      case "readyToStuff":
        return needsPackingList ? toPackageReady : { title: "Go back", icon: undefined, onPress: () => navigation.goBack() };
      default:
        return { title: "Download invoice", icon: Download, onPress: downloadInvoice, loading: downloading };
    }
  })();

  return (
    <Screen>
      <NavHeader
        left={back}
        title={
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
            <Txt size={17} weight="bold">
              Booking
            </Txt>
            <Txt size={14} mono weight="semibold" color={t.code}>
              {booking.code}
            </Txt>
          </View>
        }
        right={<IconButton icon={EllipsisVertical} onPress={() => setMenuOpen(true)} accessibilityLabel="More actions" />}
      />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        {/* Progress timeline */}
        <Card style={{ marginTop: 6 }}>
          <View style={styles.timeline}>
            {steps.map((step, i) => {
              const done = step.done;
              const current = i === currentIndex;
              return (
                <React.Fragment key={step.key}>
                  {i > 0 && <View style={[styles.connector, { backgroundColor: done || current ? t.primary : t.border }]} />}
                  <View style={{ alignItems: "center", width: 64 }}>
                    <View
                      style={[
                        styles.node,
                        done && { backgroundColor: t.primary, borderColor: t.primary },
                        current && { borderColor: t.primary, backgroundColor: t.primarySoft },
                        !done && !current && { borderColor: t.border, backgroundColor: t.surfaceAlt },
                      ]}
                    >
                      {done ? <Check size={13} color={t.onPrimary} strokeWidth={3} /> : current ? <View style={[styles.nodeDot, { backgroundColor: t.primary }]} /> : null}
                    </View>
                    <Txt size={11} weight={current ? "bold" : "medium"} muted={!current && !done} align="center" style={{ marginTop: 6 }}>
                      {step.label}
                    </Txt>
                  </View>
                </React.Fragment>
              );
            })}
          </View>
          <Txt size={12} muted align="center" style={{ marginTop: 12 }}>
            Booked {fullDate(booking.date)}
            {booking.pickupOption ? ` · Pickup LR ${booking.pickupOption}` : ""}
          </Txt>
        </Card>

        {/* Contacts */}
        <Card padded={false} style={{ marginTop: 12 }}>
          <ContactRow
            role={`Sender${senderPlace ? ` · ${senderPlace}` : ""}`}
            name={booking.sender.name}
            action={<IconButton icon={MessageCircle} size={38} onPress={() => openChat(booking.sender.whatsapp || senderInfo?.whatsapp)} accessibilityLabel="WhatsApp sender" />}
          />
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.border }} />
          <ContactRow
            role={`Receiver${receiverPlace ? ` · ${receiverPlace}` : ""}`}
            name={booking.receiver.name}
            action={<IconButton icon={Phone} size={38} onPress={() => call(booking.receiver.whatsapp || receiverInfo?.whatsapp || receiverInfo?.alternativeNo)} accessibilityLabel="Call receiver" />}
          />
        </Card>

        {/* Shipment */}
        <SectionTitle title="Shipment" />
        <Card padded={false}>
          <View style={styles.gridRow}>
            <GridCell label="Bundles" value={String(booking.bundleCount)} extra={booking.actualBundle ? `· actual ${booking.actualBundle}` : undefined} />
            <GridCell label="Bundle type" value={booking.bundleType || "—"} divider />
          </View>
          <View style={[styles.gridRow, { borderTopWidth: StyleSheet.hairlineWidth, borderColor: t.border }]}>
            <GridCell label="Product" value={booking.productType || "—"} />
            <GridCell label="Bill option" value={booking.billOption || "—"} divider />
          </View>
        </Card>

        {/* Charges */}
        <SectionTitle title="Charges" />
        <Card>
          <ChargeRow label="Brand handling" value={booking.brandHandlingCharge} note={booking.productType === "Branded" ? undefined : "Branded only"} />
          <ChargeRow label="Pickup charge" value={booking.pickupCharge} note={booking.billOption === "Without Bill" ? undefined : "Without bill only"} />
          <ChargeRow label="Bundle handling" value={booking.bundleHandlingCharge} note={booking.bundleCount < 5 ? undefined : "Under 5 bundles"} />
          <DashedDivider />
          <View style={styles.chargeRow}>
            <Txt size={14} weight="bold">
              Extra charges
            </Txt>
            <Txt size={20} weight="bold">
              {money(extra)}
            </Txt>
          </View>
        </Card>
        <Txt size={11.5} soft align="center" style={{ marginTop: 12 }}>
          Freight is billed on the invoice once the booking is stuffed · {shortDate(booking.date)}
        </Txt>
      </ScrollView>

      {/* Next action */}
      <View style={[styles.bottomBar, { backgroundColor: t.surface, borderColor: t.border, paddingBottom: insets.bottom + 12 }]}>
        <IconButton
          icon={sharingPdf ? Loader : Download}
          size={54}
          onPress={sharingPdf ? undefined : shareDetailsPdf}
          accessibilityLabel="Share booking details as PDF"
        />
        <Button
          title={primary.title}
          icon={"icon" in primary ? primary.icon : ArrowRight}
          onPress={primary.onPress}
          loading={busy || ("loading" in primary && !!primary.loading)}
          style={{ flex: 1 }}
        />
      </View>

      <ActionSheet
        visible={menuOpen}
        title={`Booking ${booking.code}`}
        subtitle={`${booking.sender.name} → ${booking.receiver.name}`}
        onClose={() => setMenuOpen(false)}
        actions={[
          {
            key: "share",
            label: "Share summary",
            description: "Send the booking details via WhatsApp, email…",
            icon: Share2,
            onPress: () => fromMenu(() => setShareOpen(true)),
          },
          {
            key: "delete",
            label: "Delete booking",
            description: "Remove it permanently",
            icon: Trash2,
            destructive: true,
            onPress: () =>
              fromMenu(() => {
                setDeleteError(null);
                setDeleteOpen(true);
              }),
          },
        ]}
      />

      <BottomSheet visible={shareOpen} title="Share summary" subtitle={`Booking ${booking.code}`} onClose={() => setShareOpen(false)}>
        <ScrollView style={[styles.summary, { backgroundColor: t.surfaceAlt, borderColor: t.border }]} contentContainerStyle={{ padding: 14 }}>
          <Txt size={13.5} style={{ lineHeight: 21 }} selectable>
            {summary}
          </Txt>
        </ScrollView>
        <View style={styles.sheetActions}>
          <Button title="Cancel" variant="secondary" onPress={() => setShareOpen(false)} height={48} style={{ flex: 1 }} />
          <Button title="Share" icon={Share2} onPress={share} height={48} style={{ flex: 1 }} />
        </View>
      </BottomSheet>

      <ConfirmDialog
        visible={noInvoiceOpen}
        icon={FileText}
        tone="warning"
        title="No invoice yet"
        message={`${booking.code} hasn't been invoiced. Invoices are generated after the booking is stuffed, from Invoicing on the web console.`}
        cancelLabel="Close"
        confirmLabel="Invoices"
        onCancel={() => setNoInvoiceOpen(false)}
        onConfirm={() => {
          setNoInvoiceOpen(false);
          navigation.navigate("Main", { screen: "More", params: { screen: "Finance", params: { tab: "invoices" }, initial: false } });
        }}
      />

      <ConfirmDialog
        visible={deleteOpen}
        icon={Trash2}
        title="Delete booking?"
        message={`${booking.code} will be removed permanently. This can't be undone.`}
        confirmLabel="Delete"
        destructive
        loading={mutatingId === booking.id}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={confirmDelete}
      >
        {deleteError && (
          <Txt size={13} color={t.tones.danger.fg} align="center" style={{ marginTop: 12 }}>
            {deleteError}
          </Txt>
        )}
      </ConfirmDialog>
    </Screen>
  );
}

function ContactRow({ role, name, action }: { role: string; name: string; action: React.ReactNode }) {
  return (
    <View style={styles.contact}>
      <Avatar name={name || "?"} size={42} />
      <View style={{ flex: 1, marginHorizontal: 12 }}>
        <Txt size={12} muted numberOfLines={1}>
          {role}
        </Txt>
        <Txt size={15.5} weight="bold" numberOfLines={1}>
          {name || "—"}
        </Txt>
      </View>
      {action}
    </View>
  );
}

function GridCell({ label, value, extra, divider }: { label: string; value: string; extra?: string; divider?: boolean }) {
  const t = useTheme();
  return (
    <View style={[styles.cell, divider && { borderLeftWidth: StyleSheet.hairlineWidth, borderColor: t.border }]}>
      <Txt size={12} muted>
        {label}
      </Txt>
      <Txt size={15} weight="bold" style={{ marginTop: 4 }}>
        {value}
        {extra ? (
          <Txt size={12} muted>
            {"  "}
            {extra}
          </Txt>
        ) : null}
      </Txt>
    </View>
  );
}

function ChargeRow({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <View style={styles.chargeRow}>
      <View>
        <Txt size={14} muted>
          {label}
        </Txt>
        {note && value === 0 ? (
          <Txt size={11} soft>
            {note}
          </Txt>
        ) : null}
      </View>
      <Txt size={14.5} weight="semibold">
        {money(value)}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  timeline: { flexDirection: "row", alignItems: "flex-start", justifyContent: "center" },
  summary: { maxHeight: 320, borderRadius: 14, borderWidth: 1 },
  sheetActions: { flexDirection: "row", gap: 10, marginTop: 14 },
  connector: { flex: 1, height: 2, marginTop: 12, borderRadius: 1, marginHorizontal: -14 },
  node: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  nodeDot: { width: 8, height: 8, borderRadius: 4 },
  contact: { flexDirection: "row", alignItems: "center", padding: 14 },
  gridRow: { flexDirection: "row" },
  cell: { flex: 1, padding: 14 },
  chargeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 7 },
  bottomBar: { flexDirection: "row", gap: 12, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
