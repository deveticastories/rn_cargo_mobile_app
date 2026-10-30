/**
 * Delivery notes — the web console's Invoicing → "Generate delivery note":
 * choose a stuffed container, tick one or more of its bookings, check their
 * packing lists, and save a delivery note PDF per booking straight to Downloads.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Check, Download } from "lucide-react-native";
import { Button } from "@/components/Button";
import { Card } from "@/components/primitives";
import { LargeHeader, Screen } from "@/components/Screen";
import { SelectField } from "@/components/SelectSheet";
import { Txt } from "@/components/Txt";
import { useRefresh } from "@/hooks/useBootstrapData";
import { useCustomerLookup } from "@/hooks/useCustomerLookup";
import { useTabScrollReset } from "@/hooks/useTabScrollReset";
import { str } from "@/services/mappers";
import { packageService } from "@/services/packageService";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchBookings } from "@/store/slices/bookingsSlice";
import { fetchContainers } from "@/store/slices/containersSlice";
import { ensureMaster } from "@/store/ensure";
import { radius } from "@/theme/fonts";
import { useTheme } from "@/theme/ThemeProvider";
import type { BackendDoc, Booking } from "@/types";
import { fullDate } from "@/utils/format";
import { downloadPdfs } from "@/utils/downloads";
import { A4_PORTRAIT } from "@/utils/pdfFrame";
import { deliveryNoteHtml } from "@/utils/tablePdf";

type NoteRow = { bundleNo: string; product: string; qty: string };

export function DeliveryNotesScreen() {
  const t = useTheme();
  const dispatch = useAppDispatch();
  const bookings = useAppSelector((s) => s.bookings.items);
  const { items: containers, stuffings } = useAppSelector((s) => s.containers);
  const products = useAppSelector((s) => s.masters.products.items);
  const fabrics = useAppSelector((s) => s.masters.fabrics.items);
  const lookup = useCustomerLookup();

  const [containerId, setContainerId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  // Packing list rows per booking id, tagged with the product/fabric names they were built from.
  const [cache, setCache] = useState<Record<string, { names: string; rows: NoteRow[] }>>({});
  const inFlight = useRef(new Set<string>());
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    dispatch(ensureMaster("products"));
    dispatch(ensureMaster("fabrics"));
    dispatch(ensureMaster("customers"));
  }, [dispatch]);

  const load = useCallback(() => Promise.all([dispatch(fetchContainers()), dispatch(fetchBookings())]), [dispatch]);
  const { refreshing, onRefresh } = useRefresh(load);
  const scrollRef = useRef<ScrollView>(null);
  useTabScrollReset(scrollRef);

  const stuffedContainers = useMemo(() => containers.filter((c) => stuffings.some((st) => st.container === c.id)), [containers, stuffings]);
  const containerBookings = useMemo(() => {
    const ids = new Set(stuffings.filter((st) => st.container === containerId).flatMap((st) => st.bookings));
    return bookings.filter((b) => ids.has(b.id));
  }, [stuffings, bookings, containerId]);
  const picked = containerBookings.filter((b) => selected.includes(b.id));
  const single = picked.length === 1 ? picked[0] : undefined;

  const nameOf = useCallback((items: BackendDoc[], id?: string) => (id ? str(items.find((x) => x._id === id)?.name) : ""), []);

  const loadRows = useCallback(
    async (id: string): Promise<NoteRow[]> => {
      const list = await packageService.getByBooking(id).catch(() => null);
      return (list?.bundles ?? []).flatMap((b) =>
        b.lines.map((l) => ({
          bundleNo: String(b.bundleNo),
          product: [nameOf(products, l.productId), nameOf(fabrics, l.fabricId)].filter(Boolean).join(" - "),
          qty: String(l.quantity || ""),
        }))
      );
    },
    [products, fabrics, nameOf]
  );

  // Fetch the packing list of each ticked booking — again if product/fabric names have loaded since.
  const names = `${products.length}:${fabrics.length}`;
  useEffect(() => {
    for (const id of selected) {
      const key = `${id}@${names}`;
      if (cache[id]?.names === names || inFlight.current.has(key)) continue;
      inFlight.current.add(key);
      void loadRows(id).then((rows) => {
        inFlight.current.delete(key);
        setCache((m) => ({ ...m, [id]: { names, rows } }));
      });
    }
  }, [selected, names, cache, loadRows]);
  // Rows to show: the cached ones, even if names are still being refreshed.
  const rowsById = useMemo(() => Object.fromEntries(Object.entries(cache).map(([id, v]) => [id, v.rows])) as Record<string, NoteRow[]>, [cache]);

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const allPicked = containerBookings.length > 0 && picked.length === containerBookings.length;

  const party = (id: string, name: string) => {
    const c = lookup.map.get(id);
    return { name, lines: c ? [c.location, c.whatsapp ? `Ph: ${c.whatsapp}` : ""] : [] };
  };

  const download = async () => {
    if (picked.length === 0) return Alert.alert("Choose at least one booking first.");
    setDownloading(true);
    try {
      const files = await Promise.all(
        picked.map(async (b) => ({
          fileName: `${b.code}-delivery-note.pdf`,
          size: A4_PORTRAIT,
          html: deliveryNoteHtml({
            lrNo: b.code,
            bookingDate: fullDate(b.date),
            sender: party(b.sender.id, b.sender.name),
            receiver: party(b.receiver.id, b.receiver.name),
            rows: rowsById[b.id] ?? (await loadRows(b.id)),
          }),
        }))
      );
      // Saved to Downloads one file per booking, each with its own notification.
      await downloadPdfs(files);
    } catch (e) {
      Alert.alert("Couldn't create the PDF", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const itemCount = picked.reduce((n, b) => n + (rowsById[b.id]?.length ?? 0), 0);

  return (
    <Screen>
      <LargeHeader title="Delivery notes" />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 30 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} />}
      >
        <Card>
          <Txt size={16} weight="bold">
            Generate delivery note
          </Txt>
          <Txt size={12.5} muted style={{ marginTop: 2, marginBottom: 14 }}>
            Packing list, sender and booking date are pulled in automatically.
          </Txt>

          <SelectField
            label="Container"
            placeholder="Choose a container"
            value={containerId}
            options={stuffedContainers.map((c) => ({ value: c.id, label: c.code, sublabel: c.company }))}
            onChange={(v) => {
              setContainerId(v);
              setSelected([]);
            }}
            emptyText="No stuffed containers yet."
          />

          {containerId !== "" && (
            <>
              <View style={styles.listHead}>
                <Txt size={13} weight="semibold">
                  Booking IDs
                </Txt>
                {containerBookings.length > 0 && (
                  <Pressable onPress={() => setSelected(allPicked ? [] : containerBookings.map((b) => b.id))} hitSlop={8}>
                    <Txt size={13} weight="bold" color={t.primary}>
                      {allPicked ? "Clear all" : "Select all"}
                    </Txt>
                  </Pressable>
                )}
              </View>
              {containerBookings.length === 0 ? (
                <Txt size={13} muted>
                  No bookings in this container.
                </Txt>
              ) : (
                containerBookings.map((b) => <BookingOption key={b.id} booking={b} checked={selected.includes(b.id)} onPress={() => toggle(b.id)} />)
              )}
            </>
          )}

          {picked.length > 0 && (
            <View style={{ marginTop: 14 }}>
              {single && (
                <View style={{ marginBottom: 10, gap: 2 }}>
                  <Txt size={13}>
                    <Txt size={13} weight="bold">
                      Sender:
                    </Txt>{" "}
                    {single.sender.name}
                  </Txt>
                  <Txt size={13}>
                    <Txt size={13} weight="bold">
                      Booking date:
                    </Txt>{" "}
                    {fullDate(single.date)}
                  </Txt>
                </View>
              )}
              <Txt size={12.5} weight="semibold" muted style={{ marginBottom: 6 }}>
                Packing list ({itemCount} item{itemCount === 1 ? "" : "s"}
                {single ? "" : ` across ${picked.length} bookings`})
              </Txt>
              <View style={[styles.table, { borderColor: t.border }]}>
                <View style={[styles.tr, { backgroundColor: t.surfaceAlt }]}>
                  <Txt size={12} weight="bold" style={styles.colBundle}>
                    Bundle
                  </Txt>
                  <Txt size={12} weight="bold" style={{ flex: 1 }}>
                    Product
                  </Txt>
                  <Txt size={12} weight="bold" style={styles.colQty}>
                    Qty
                  </Txt>
                </View>
                {picked.map((b) => {
                  const rows = rowsById[b.id];
                  return (
                    <React.Fragment key={b.id}>
                      {!single && (
                        <View style={[styles.tr, { backgroundColor: t.primarySoft, borderTopColor: t.border }]}>
                          <Txt size={12} weight="semibold" color={t.primary} numberOfLines={1} style={{ flex: 1 }}>
                            {b.code} · {b.sender.name} → {b.receiver.name} · {fullDate(b.date)}
                          </Txt>
                        </View>
                      )}
                      {rows === undefined ? (
                        <View style={[styles.tr, { borderTopColor: t.border }]}>
                          <ActivityIndicator size="small" color={t.primary} />
                        </View>
                      ) : rows.length === 0 ? (
                        <View style={[styles.tr, { borderTopColor: t.border }]}>
                          <Txt size={12.5} muted>
                            No packing list recorded for this booking yet.
                          </Txt>
                        </View>
                      ) : (
                        rows.map((r, i) => (
                          <View key={i} style={[styles.tr, { borderTopColor: t.border }]}>
                            <Txt size={12.5} style={styles.colBundle}>
                              {r.bundleNo}
                            </Txt>
                            <Txt size={12.5} style={{ flex: 1 }}>
                              {r.product || "—"}
                            </Txt>
                            <Txt size={12.5} style={styles.colQty}>
                              {r.qty}
                            </Txt>
                          </View>
                        ))
                      )}
                    </React.Fragment>
                  );
                })}
              </View>
            </View>
          )}

          {selected.length > 0 && (
            <Button
              title={picked.length === 1 ? "Generate & download note PDF" : `Generate & download ${picked.length} note PDFs`}
              icon={Download}
              onPress={download}
              loading={downloading}
              style={{ marginTop: 14 }}
            />
          )}
        </Card>
      </ScrollView>
    </Screen>
  );
}

function BookingOption({ booking: b, checked, onPress }: { booking: Booking; checked: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={({ pressed }) => [styles.option, { borderColor: checked ? t.primary : t.border, backgroundColor: t.surface, opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={[styles.checkbox, { borderColor: checked ? t.primary : t.borderStrong, backgroundColor: checked ? t.primary : t.surface }]}>
        {checked && <Check size={14} color={t.onPrimary} strokeWidth={3} />}
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Txt mono size={12.5} weight="semibold" color={t.code}>
          {b.code}
        </Txt>
        <Txt size={13} numberOfLines={1}>
          {b.sender.name} → {b.receiver.name}
        </Txt>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  listHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  option: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: radius.md, borderWidth: 1, marginBottom: 8 },
  checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  table: { borderWidth: 1, borderRadius: 10, overflow: "hidden" },
  tr: { flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingHorizontal: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "transparent" },
  colBundle: { width: 60 },
  colQty: { width: 44, textAlign: "right" },
});
