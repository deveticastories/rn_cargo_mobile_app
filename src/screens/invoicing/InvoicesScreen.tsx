/**
 * Invoices — the web console's Invoicing → "Generate invoice": choose a
 * stuffed container and one of its bookings, check the route price, charges
 * and receiver discount, pick a delivery partner and generate the invoice PDF
 * (an existing invoice is just reprinted). Every invoice so far is listed below.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Download, FileText } from "lucide-react-native";
import { errorMessage } from "@/api/client";
import { Button } from "@/components/Button";
import { Card, DashedDivider, IconTile, SectionTitle } from "@/components/primitives";
import { LargeHeader, Notice, Screen } from "@/components/Screen";
import { SelectField } from "@/components/SelectSheet";
import { TextField } from "@/components/TextField";
import { Txt } from "@/components/Txt";
import { useRefresh } from "@/hooks/useBootstrapData";
import { useCustomerLookup } from "@/hooks/useCustomerLookup";
import { useTabScrollReset } from "@/hooks/useTabScrollReset";
import { financeService } from "@/services/financeService";
import { num, str } from "@/services/mappers";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchBookings } from "@/store/slices/bookingsSlice";
import { fetchContainers } from "@/store/slices/containersSlice";
import { fetchFinance } from "@/store/slices/financeSlice";
import { fetchMaster, saveMaster } from "@/store/slices/mastersSlice";
import { useTheme } from "@/theme/ThemeProvider";
import type { BackendDoc, Booking, Invoice } from "@/types";
import { fullDate, money } from "@/utils/format";
import { downloadInvoicePdf } from "@/utils/invoicePdf";

/** Same aliases as the web console's canonicalPlace, so "Dubai" or "U.A.E" still match the UAE route. */
const PLACE_ALIASES: Record<string, string> = { india: "India", uae: "UAE", "u.a.e": "UAE", "u.a.e.": "UAE", "united arab emirates": "UAE", dubai: "UAE" };
const canonicalPlace = (v: unknown) => {
  const s = str(v).trim().replace(/\s+/g, " ");
  return PLACE_ALIASES[s.toLowerCase()] ?? s;
};
const isIndiaToUae = (p: BackendDoc) => canonicalPlace(p.from) === "India" && canonicalPlace(p.to) === "UAE";

export function InvoicesScreen() {
  const t = useTheme();
  const dispatch = useAppDispatch();
  const bookings = useAppSelector((s) => s.bookings.items);
  const { items: containers, stuffings } = useAppSelector((s) => s.containers);
  const invoices = useAppSelector((s) => s.finance.invoices);
  const financeError = useAppSelector((s) => s.finance.error);
  const pricing = useAppSelector((s) => s.masters.pricing.items);
  const partners = useAppSelector((s) => s.masters.deliveryPartners.items);
  const customers = useAppSelector((s) => s.masters.customers.items);
  const lookup = useCustomerLookup();

  const [containerId, setContainerId] = useState("");
  const [bookingId, setBookingId] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [savingPrice, setSavingPrice] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [printingId, setPrintingId] = useState<string | null>(null);

  useEffect(() => {
    dispatch(fetchMaster("pricing"));
    dispatch(fetchMaster("deliveryPartners"));
    dispatch(fetchMaster("customers"));
  }, [dispatch]);

  const load = useCallback(
    () => Promise.all([dispatch(fetchFinance()), dispatch(fetchContainers()), dispatch(fetchBookings()), dispatch(fetchMaster("pricing"))]),
    [dispatch]
  );
  const { refreshing, onRefresh } = useRefresh(load);
  const scrollRef = useRef<ScrollView>(null);
  useTabScrollReset(scrollRef);

  // Only containers that have been stuffed can be invoiced, and only their bookings.
  const stuffedContainers = useMemo(() => containers.filter((c) => stuffings.some((st) => st.container === c.id)), [containers, stuffings]);
  const containerBookings = useMemo(() => {
    const ids = new Set(stuffings.filter((st) => st.container === containerId).flatMap((st) => st.bookings));
    return bookings.filter((b) => ids.has(b.id));
  }, [stuffings, bookings, containerId]);

  const container = stuffedContainers.find((c) => c.id === containerId);
  const booking = containerBookings.find((b) => b.id === bookingId);
  const invoice = booking ? invoices.find((i) => i.bookingId === booking.id) : undefined;

  // The same figures the web form previews (cargo-backend computes the saved ones).
  const route = booking ? pricing.find((p) => isIndiaToUae(p) && str(p.uom) === booking.bundleType) : undefined;
  const pricedUnits = pricing.filter((p) => isIndiaToUae(p) && str(p.uom) !== booking?.bundleType).map((p) => str(p.uom));
  const rate = route ? num(route.price) : 0;
  const qty = booking ? booking.actualBundle || 0 : 0;
  const subtotal = rate * qty;
  const additional = booking ? booking.pickupCharge + booking.brandHandlingCharge : 0;
  const discount = booking ? num(customers.find((c) => c._id === booking.receiver.id)?.discount) : 0;
  const problem = !booking
    ? ""
    : qty <= 0
      ? "Repacking hasn't been confirmed for this booking yet — the invoice needs its final bundle count."
      : !route
        ? `No India → UAE price for "${booking.bundleType || "this unit"}" yet${pricedUnits.length ? ` (priced so far: ${pricedUnits.join(", ")})` : ""}.`
        : discount > subtotal + additional
          ? "The receiver's discount is larger than the invoice amount."
          : "";

  const receiverParty = (b?: Booking) => ({
    name: b?.receiver.name ?? "",
    lines: b ? [lookup.receiverPlace(b), lookup.map.get(b.receiver.id)?.whatsapp ? `Ph: ${lookup.map.get(b.receiver.id)?.whatsapp}` : ""] : [],
  });

  const printInvoice = async (inv: Invoice) => {
    const b = bookings.find((x) => x.id === inv.bookingId);
    await downloadInvoicePdf(inv, b, receiverParty(b));
  };

  const generate = async () => {
    if (!booking || !container) return Alert.alert("Choose a booking first.");
    setGenerating(true);
    try {
      if (invoice) {
        await printInvoice(invoice);
        return;
      }
      if (!partnerId) return Alert.alert("Choose a delivery partner.");
      const created = await financeService.createInvoice({ containerId: container.id, bookingId: booking.id, deliveryPartnerId: partnerId });
      await dispatch(fetchFinance());
      await printInvoice(created);
    } catch (e) {
      Alert.alert("Couldn't save the invoice", errorMessage(e, "Failed to save the invoice."));
    } finally {
      setGenerating(false);
    }
  };

  const addPrice = async () => {
    if (!booking?.bundleType || !(Number(newPrice) > 0)) return;
    setSavingPrice(true);
    const result = await dispatch(saveMaster({ key: "pricing", values: { from: "India", to: "UAE", uom: booking.bundleType, price: newPrice } }));
    setSavingPrice(false);
    if (saveMaster.rejected.match(result)) Alert.alert("Couldn't save the price", String(result.payload ?? "Please try again."));
    else setNewPrice("");
  };

  const reprint = async (inv: Invoice) => {
    setPrintingId(inv.id);
    try {
      await printInvoice(inv);
    } catch (e) {
      Alert.alert("Couldn't create the PDF", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setPrintingId(null);
    }
  };

  const sortedInvoices = useMemo(() => [...invoices].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")), [invoices]);

  return (
    <Screen>
      <LargeHeader title="Invoices" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 30 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} />}
      >
        {financeError && <Notice message={financeError} onRetry={() => dispatch(fetchFinance())} />}

        <Card>
          <Txt size={16} weight="bold">
            Generate invoice
          </Txt>
          <Txt size={12.5} muted style={{ marginTop: 2, marginBottom: 14 }}>
            Amounts are calculated by the server from the booking, its route price and the receiver's discount.
          </Txt>

          <SelectField
            label="Container"
            placeholder="Choose a container"
            value={containerId}
            options={stuffedContainers.map((c) => ({ value: c.id, label: c.code, sublabel: c.company }))}
            onChange={(v) => {
              setContainerId(v);
              setBookingId("");
              setPartnerId("");
            }}
            emptyText="No stuffed containers yet."
          />
          {container && (
            <SelectField
              label="Booking ID"
              placeholder="Choose booking ID"
              value={bookingId}
              options={containerBookings.map((b) => ({ value: b.id, label: b.code, sublabel: `${b.sender.name} → ${b.receiver.name}` }))}
              onChange={(v) => {
                setBookingId(v);
                setPartnerId("");
                setNewPrice("");
              }}
              emptyText="No bookings in this container."
            />
          )}

          {booking && (
            <>
              <View style={{ marginVertical: 4 }}>
                <TotalRow
                  label={`Route price (${route ? `${canonicalPlace(route.from)} → ${canonicalPlace(route.to)}, per ${str(route.uom)}` : "no route matched"})`}
                  value={`${money(invoice ? (qty ? invoice.subtotal / qty : 0) : rate)} × ${qty}`}
                />
                <TotalRow label="Subtotal" value={money(invoice?.subtotal ?? subtotal)} />
                <TotalRow label="Additional charges (pickup + brand handling)" value={money(invoice?.additionalCharges ?? additional)} />
                <TotalRow label="Receiver discount" value={`-${money(invoice?.receivableDiscount ?? discount)}`} />
              </View>

              {invoice ? (
                <TextField label="Delivery partner" value={invoice.deliveryPartner ?? ""} editable={false} />
              ) : (
                <SelectField
                  label="Delivery partner"
                  placeholder="Choose delivery partner"
                  value={partnerId}
                  options={partners.filter((p) => p.status !== false).map((p) => ({ value: p._id, label: str(p.name) }))}
                  onChange={setPartnerId}
                  emptyText="No delivery partners yet — add one under More → Delivery partners."
                />
              )}

              <DashedDivider />
              <TotalRow label="Total" value={money(invoice?.amount ?? subtotal + additional - discount)} strong />

              {invoice ? (
                <Txt size={12.5} muted style={{ marginTop: 6 }}>
                  Already invoiced as <Txt size={12.5} weight="bold">{invoice.code}</Txt>
                  {invoice.createdAt ? ` on ${fullDate(invoice.createdAt)}` : ""} — downloading reprints the saved invoice.
                </Txt>
              ) : problem ? (
                <Txt size={12.5} color={t.tones.danger.fg} style={{ marginTop: 6 }}>
                  {problem}
                </Txt>
              ) : null}

              {!invoice && qty > 0 && !route && booking.bundleType && (
                <View style={styles.priceRow}>
                  <View style={{ flex: 1 }}>
                    <TextField
                      label={`India → UAE price per ${booking.bundleType}`}
                      value={newPrice}
                      onChangeText={(v) => setNewPrice(v.replace(/[^\d.]/g, ""))}
                      keyboardType="decimal-pad"
                      placeholder="Price"
                    />
                  </View>
                  <Button title="Add price" variant="secondary" height={50} onPress={addPrice} loading={savingPrice} disabled={!(Number(newPrice) > 0)} style={{ marginBottom: 14 }} />
                </View>
              )}

              <Button
                title={invoice ? "Download invoice PDF" : "Generate & download invoice PDF"}
                icon={Download}
                onPress={generate}
                loading={generating}
                disabled={!invoice && (!!problem || !partnerId)}
                style={{ marginTop: 12 }}
              />
              {!invoice && !problem && !partnerId && (
                <Txt size={12} muted align="center" style={{ marginTop: 6 }}>
                  Choose a delivery partner to generate the invoice.
                </Txt>
              )}
            </>
          )}
        </Card>

        <SectionTitle title="Invoices" />
        <Card padded={false}>
          {sortedInvoices.length === 0 ? (
            <Txt muted align="center" style={{ padding: 24 }}>
              No invoices yet.
            </Txt>
          ) : (
            sortedInvoices.map((inv, i) => (
              <View key={inv.id} style={[styles.invoiceRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: t.border }]}>
                <IconTile icon={FileText} tone="info" size={40} />
                <View style={{ flex: 1, marginHorizontal: 12 }}>
                  <Txt size={14} weight="bold" mono>
                    {inv.code}
                  </Txt>
                  <Txt size={12} muted numberOfLines={1}>
                    {[inv.bookingCode, inv.container, inv.deliveryPartner].filter(Boolean).join(" · ")}
                  </Txt>
                  <Txt size={12} muted>
                    {inv.createdAt ? fullDate(inv.createdAt) : "—"}
                  </Txt>
                </View>
                <View style={{ alignItems: "flex-end", gap: 6 }}>
                  <Txt size={14} weight="bold">
                    {money(inv.amount)}
                  </Txt>
                  <Pressable onPress={() => reprint(inv)} disabled={printingId === inv.id} hitSlop={8} style={styles.pdfBtn} accessibilityLabel={`Download ${inv.code} PDF`}>
                    {printingId === inv.id ? <ActivityIndicator size="small" color={t.primary} /> : <Download size={14} color={t.primary} />}
                    <Txt size={12.5} weight="semibold" color={t.primary}>
                      PDF
                    </Txt>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </Card>
      </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function TotalRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.totalRow}>
      <Txt size={strong ? 15 : 13} weight={strong ? "bold" : "regular"} muted={!strong} style={{ flex: 1, marginRight: 12 }}>
        {label}
      </Txt>
      <Txt size={strong ? 17 : 13.5} weight={strong ? "bold" : "semibold"}>
        {value}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  priceRow: { flexDirection: "row", alignItems: "flex-end", gap: 10, marginTop: 8 },
  invoiceRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 14 },
  pdfBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
});
