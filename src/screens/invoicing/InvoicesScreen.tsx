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
import { num, refField, refId, str } from "@/services/mappers";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectPackingByBooking } from "@/store/selectors";
import { fetchBookings } from "@/store/slices/bookingsSlice";
import { fetchContainers } from "@/store/slices/containersSlice";
import { fetchFinance } from "@/store/slices/financeSlice";
import { fetchMaster, saveMaster } from "@/store/slices/mastersSlice";
import { ensureMaster } from "@/store/ensure";
import { useTheme } from "@/theme/ThemeProvider";
import type { BackendDoc, Booking, Invoice } from "@/types";
import { fullDate, money } from "@/utils/format";
import { downloadInvoicePdf } from "@/utils/invoicePdf";
import { canonicalPlace, isIndiaToUae } from "@/utils/pricing";
import { docToFormValues, MASTERS } from "@/features/masters/config";

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
  const countries = useAppSelector((s) => s.masters.countries.items);
  const products = useAppSelector((s) => s.masters.products.items);
  const packing = useAppSelector(selectPackingByBooking);
  const lookup = useCustomerLookup();

  const [containerId, setContainerId] = useState("");
  const [bookingId, setBookingId] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [savingPrice, setSavingPrice] = useState(false);
  const [newCharge, setNewCharge] = useState("");
  // Chosen delivery partner; empty means the suggested one.
  const [partnerId, setPartnerId] = useState("");
  const [savingCharge, setSavingCharge] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [printingId, setPrintingId] = useState<string | null>(null);

  useEffect(() => {
    dispatch(ensureMaster("pricing"));
    dispatch(ensureMaster("deliveryPartners"));
    dispatch(ensureMaster("customers"));
    dispatch(ensureMaster("countries"));
    dispatch(ensureMaster("products"));
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
  // Delivery partner: choosable like the web (until the invoice exists). It starts on the active partner
  // serving the receiver's country (from India when there's a choice); other active partners follow.
  const countryName = (ref: unknown) => canonicalPlace(refField(ref, "name") ?? countries.find((c) => c._id === refId(ref))?.name);
  const receiverCountry = booking ? canonicalPlace(lookup.receiverCountry(booking)) : "";
  const activePartners = partners.filter((p) => p.status !== false);
  const matchingPartners = receiverCountry ? activePartners.filter((p) => countryName(p.toCountry) === receiverCountry) : [];
  const suggestedPartner = matchingPartners.find((p) => countryName(p.from) === "India") ?? matchingPartners[0];
  const partner = activePartners.find((p) => p._id === partnerId) ?? suggestedPartner;
  const partnerChoices = [...matchingPartners, ...activePartners.filter((p) => !matchingPartners.includes(p))].map((p) => ({
    value: p._id,
    label: str(p.name),
    sublabel: [`${countryName(p.from) || "—"} → ${countryName(p.toCountry) || "—"}`, p.charge !== undefined && p.charge !== null && String(p.charge) !== "" ? money(num(p.charge)) : "no charge yet"].join(" · "),
  }));
  // The charge lives on the delivery partner; when the partner has none yet it's entered here once.
  const partnerHasCharge = partner !== undefined && partner.charge !== undefined && partner.charge !== null && String(partner.charge) !== "";
  const deliveryCharge = invoice ? invoice.deliveryCharge : partnerHasCharge ? num(partner!.charge) : undefined;
  const needsCharge = !invoice && partner !== undefined && !partnerHasCharge;
  const problem = !booking
    ? ""
    : !invoice && !partner
      ? activePartners.length
        ? "Choose a delivery partner."
        : "No active delivery partners yet — add one under More → Delivery."
      : qty <= 0
        ? "Repacking hasn't been confirmed for this booking yet — the invoice needs its final bundle count."
        : !route
          ? `No India → UAE price for "${booking.bundleType || "this unit"}" yet${pricedUnits.length ? ` (priced so far: ${pricedUnits.join(", ")})` : ""}.`
          : discount > subtotal + additional
            ? "The receiver's discount is larger than the invoice amount."
            : needsCharge
              ? `Add ${str(partner?.name) || "the delivery partner"}'s charge below before generating the invoice.`
              : "";

  const receiverParty = (b?: Booking) => ({
    name: b?.receiver.name ?? "",
    lines: b
      ? [lookup.receiverPlace(b), lookup.map.get(b.receiver.id)?.whatsapp ? `Ph: ${lookup.map.get(b.receiver.id)?.whatsapp}` : ""]
      : [],
  });

  const printInvoice = async (inv: Invoice) => {
    const b = bookings.find((x) => x.id === inv.bookingId);
    await downloadInvoicePdf(inv, b, receiverParty(b), {
      marks: (packing.get(inv.bookingId)?.marks ?? []).join(", "),
      productName: (id) => str(products.find((p) => p._id === id)?.name),
    });
  };

  const generate = async () => {
    if (!booking || !container) return Alert.alert("Choose a booking first.");
    setGenerating(true);
    try {
      if (invoice) {
        await printInvoice(invoice);
        return;
      }
      if (!partner) return;
      const created = await financeService.createInvoice({
        containerId: container.id,
        bookingId: booking.id,
        deliveryPartnerId: partner._id,
      });
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
    const result = await dispatch(
      saveMaster({ key: "pricing", values: { from: "India", to: "UAE", uom: booking.bundleType, price: newPrice } })
    );
    setSavingPrice(false);
    if (saveMaster.rejected.match(result)) Alert.alert("Couldn't save the price", String(result.payload ?? "Please try again."));
    else setNewPrice("");
  };

  /** Saves the delivery partner's charge (only offered while it has none); it's read-only here afterwards. */
  const addCharge = async () => {
    if (!partner || !(Number(newCharge) >= 0) || newCharge === "") return;
    setSavingCharge(true);
    const values = { ...docToFormValues(MASTERS.deliveryPartners, partner), charge: newCharge };
    const result = await dispatch(saveMaster({ key: "deliveryPartners", id: partner._id, values }));
    setSavingCharge(false);
    if (saveMaster.rejected.match(result)) Alert.alert("Couldn't save the charge", String(result.payload ?? "Please try again."));
    else setNewCharge("");
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
                  setNewPrice("");
                  setNewCharge("");
                  setPartnerId("");
                }}
                emptyText="No bookings in this container."
              />
            )}

            {booking && (
              <>
                <View style={{ marginVertical: 4 }}>
                  <TotalRow label="Receiver" value={booking.receiver.name || "—"} />
                  <TotalRow label="Receiver country" value={lookup.receiverCountry(booking) || "—"} />
                  <TotalRow
                    label={`Route price (${route ? `${canonicalPlace(route.from)} → ${canonicalPlace(route.to)}, per ${str(route.uom)}` : "no route matched"})`}
                    value={`${money(invoice ? (qty ? invoice.subtotal / qty : 0) : rate)} × ${qty}`}
                  />
                  <TotalRow label="Subtotal" value={money(invoice?.subtotal ?? subtotal)} />
                  <TotalRow label="Additional charges (pickup + brand handling)" value={money(invoice?.additionalCharges ?? additional)} />
                  <TotalRow label="Receiver discount" value={`-${money(invoice?.receivableDiscount ?? discount)}`} />
                </View>

                {invoice ? (
                  <TextField label="Delivery partner" value={invoice.deliveryPartner || "—"} editable={false} hint="Already invoiced — can't be changed." />
                ) : (
                  <SelectField
                    label="Delivery partner"
                    placeholder="Choose delivery partner"
                    value={partner?._id ?? ""}
                    options={partnerChoices}
                    onChange={(v) => {
                      setPartnerId(v);
                      setNewCharge("");
                    }}
                    emptyText="No active delivery partners — add one under More → Delivery."
                  />
                )}
                {deliveryCharge !== undefined && <TotalRow label="Delivery partner charges" value={money(deliveryCharge)} />}
                {needsCharge && (
                  <View style={styles.priceRow}>
                    <View style={{ flex: 1 }}>
                      <TextField
                        label="Delivery partner charge (AED)"
                        value={newCharge}
                        onChangeText={(v) => setNewCharge(v.replace(/[^\d.]/g, ""))}
                        keyboardType="decimal-pad"
                        placeholder="Charge"
                        hint="Saved to this partner once; it can't be changed here later."
                      />
                    </View>
                    <Button
                      title="Save"
                      variant="secondary"
                      height={50}
                      onPress={addCharge}
                      loading={savingCharge}
                      disabled={newCharge === "" || !(Number(newCharge) >= 0)}
                      style={{ marginBottom: 14 }}
                    />
                  </View>
                )}

                <DashedDivider />
                <TotalRow label="Total" value={money(invoice?.amount ?? subtotal + additional - discount)} strong />

                {invoice ? (
                  <Txt size={12.5} muted style={{ marginTop: 6 }}>
                    Already invoiced as{" "}
                    <Txt size={12.5} weight="bold">
                      {invoice.code}
                    </Txt>
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
                    <Button
                      title="Add price"
                      variant="secondary"
                      height={50}
                      onPress={addPrice}
                      loading={savingPrice}
                      disabled={!(Number(newPrice) > 0)}
                      style={{ marginBottom: 14 }}
                    />
                  </View>
                )}

                <Button
                  title={invoice ? "Download invoice PDF" : "Generate & download invoice PDF"}
                  icon={Download}
                  onPress={generate}
                  loading={generating}
                  disabled={!invoice && !!problem}
                  style={{ marginTop: 12 }}
                />
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
              sortedInvoices.map((inv, i) => {
                const b = bookings.find((x) => x.id === inv.bookingId);
                return (
                  <View
                    key={inv.id}
                    style={[styles.invoiceRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: t.border }]}
                  >
                    <IconTile icon={FileText} tone="info" size={40} />
                    <View style={{ flex: 1, marginHorizontal: 12 }}>
                      <Txt size={14} weight="bold" mono>
                        {inv.code}
                      </Txt>
                      <Txt size={12} muted numberOfLines={1}>
                        {[inv.bookingCode, inv.container, inv.deliveryPartner].filter(Boolean).join(" · ")}
                      </Txt>
                      {b && (
                        <Txt size={12} muted numberOfLines={1}>
                          To {[b.receiver.name, lookup.receiverCountry(b)].filter(Boolean).join(" · ")}
                        </Txt>
                      )}
                      {inv.deliveryCharge !== undefined && (
                        <Txt size={12} muted>
                          Delivery charges {money(inv.deliveryCharge)}
                        </Txt>
                      )}
                      <Txt size={12} muted>
                        {inv.createdAt ? fullDate(inv.createdAt) : "—"}
                      </Txt>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 6 }}>
                      <Txt size={14} weight="bold">
                        {money(inv.amount)}
                      </Txt>
                      <Pressable
                        onPress={() => reprint(inv)}
                        disabled={printingId === inv.id}
                        hitSlop={8}
                        style={styles.pdfBtn}
                        accessibilityLabel={`Download ${inv.code} PDF`}
                      >
                        {printingId === inv.id ? (
                          <ActivityIndicator size="small" color={t.primary} />
                        ) : (
                          <Download size={14} color={t.primary} />
                        )}
                        <Txt size={12.5} weight="semibold" color={t.primary}>
                          PDF
                        </Txt>
                      </Pressable>
                    </View>
                  </View>
                );
              })
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
