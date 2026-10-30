/**
 * Stuffing — the web console's stuffing pages in one tab:
 *   Ready to stuff: fully packed bookings; select some and "Go to stuffing".
 *   Stuffing: the queue sent from Ready to stuff; pick a container, select
 *   bookings and "Submit stuffing" (or send one back).
 *   Stuffed list: every stuffing (container, bookings, date), downloadable as a PDF.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { ArrowLeftRight, Check, Download, FileText, Package, Search, Undo2, X } from "lucide-react-native";
import { Button } from "@/components/Button";
import { Card, Chip } from "@/components/primitives";
import { EmptyView, LargeHeader, LoadingView, Notice, Screen } from "@/components/Screen";
import { SelectField } from "@/components/SelectSheet";
import { Txt } from "@/components/Txt";
import { useRefresh } from "@/hooks/useBootstrapData";
import { packageService } from "@/services/packageService";
import { str } from "@/services/mappers";
import { ensureMaster } from "@/store/ensure";
import { useTabScrollReset } from "@/hooks/useTabScrollReset";
import type { TabScreenProps } from "@/navigation/types";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAwaitingStuffing, selectPackingByBooking, selectReadyToStuff, selectStuffableContainers } from "@/store/selectors";
import { fetchBookings, sendBackFromStuffing, sendManyToStuffing } from "@/store/slices/bookingsSlice";
import { fetchContainers, loadIntoContainer } from "@/store/slices/containersSlice";
import { fetchFinance } from "@/store/slices/financeSlice";
import { DownloadTile, StuffedListView } from "@/screens/stuffedContainers/StuffedListView";
import { fonts, radius } from "@/theme/fonts";
import { useTheme } from "@/theme/ThemeProvider";
import type { Booking } from "@/types";
import { fullDate, shortDate } from "@/utils/format";
import { downloadTablePdf } from "@/utils/tablePdf";

type Tab = "ready" | "stuffing" | "stuffed";

const TAB_LABEL: Record<Tab, string> = { ready: "Ready to stuff", stuffing: "Stuffing", stuffed: "Stuffed list" };

const bundlesOf = (b: Booking) => b.actualBundle || b.bundleCount;

export function StuffingScreen({ navigation }: TabScreenProps<"Stuffing">) {
  const t = useTheme();
  const dispatch = useAppDispatch();
  const ready = useAppSelector(selectReadyToStuff);
  const awaiting = useAppSelector(selectAwaitingStuffing);
  const packing = useAppSelector(selectPackingByBooking);
  const stuffable = useAppSelector(selectStuffableContainers);
  const { stuffings, status, error, stuffingStatus } = useAppSelector((s) => s.containers);
  const bookingsStatus = useAppSelector((s) => s.bookings.status);
  const mutatingId = useAppSelector((s) => s.bookings.mutatingId);

  // Product, fabric and pricing names for the Stuffed list's booking details.
  useEffect(() => {
    dispatch(ensureMaster("products"));
    dispatch(ensureMaster("fabrics"));
    dispatch(ensureMaster("pricing"));
  }, [dispatch]);

  const [tab, setTab] = useState<Tab>("ready");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Record<Tab, string[]>>({ ready: [], stuffing: [], stuffed: [] });
  const [containerId, setContainerId] = useState("");
  const [moving, setMoving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const load = useCallback(() => Promise.all([dispatch(fetchContainers()), dispatch(fetchBookings()), dispatch(fetchFinance())]), [dispatch]);
  const { refreshing, onRefresh } = useRefresh(load);
  const listRef = useRef<FlatList<Booking>>(null);
  useTabScrollReset(listRef);

  const source = tab === "ready" ? ready : tab === "stuffing" ? awaiting : [];
  const data = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? source.filter((b) => [b.code, b.sender.name, b.receiver.name].join(" ").toLowerCase().includes(q)) : source;
  }, [source, query]);

  // Only count selections that are still in the list (a refresh may have moved them on).
  const picked = selected[tab].filter((id) => source.some((b) => b.id === id));
  const allPicked = data.length > 0 && data.every((b) => picked.includes(b.id));
  const setPicked = (ids: string[]) => setSelected((s) => ({ ...s, [tab]: ids }));
  const toggle = (id: string) => setPicked(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]);
  const toggleAll = () => {
    const ids = data.map((b) => b.id);
    setPicked(allPicked ? picked.filter((id) => !ids.includes(id)) : [...new Set([...picked, ...ids])]);
  };

  const switchTab = (next: Tab) => {
    setTab(next);
    setQuery("");
    setActionError(null);
  };

  const goToStuffing = async () => {
    setMoving(true);
    setActionError(null);
    const result = await dispatch(sendManyToStuffing(picked));
    setMoving(false);
    if (sendManyToStuffing.rejected.match(result)) return setActionError(result.payload ?? "Couldn't move the bookings to stuffing.");
    setSelected((s) => ({ ...s, ready: [] }));
    switchTab("stuffing");
  };

  const container = stuffable.find((c) => c.id === containerId);
  const submitStuffing = async () => {
    if (!container) return setActionError("Choose a container first.");
    setActionError(null);
    const result = await dispatch(loadIntoContainer({ containerId: container.id, bookingIds: picked }));
    if (loadIntoContainer.rejected.match(result)) return setActionError(result.payload ?? "Couldn't submit the stuffing.");
    Alert.alert("Stuffing completed", `${picked.length} booking${picked.length === 1 ? "" : "s"} stuffed into ${container.code}.`);
    setSelected((s) => ({ ...s, stuffing: [] }));
    setContainerId("");
  };

  // Ready to stuff downloads cover the ticked bookings only.
  const readyScope = ready.filter((b) => picked.includes(b.id));
  const packages = useAppSelector((s) => s.containers.packages);
  const products = useAppSelector((s) => s.masters.products.items);
  /** Bundle mark of each saved bundle: every bundle across all packing lists numbered in id order, like the web. */
  const markOf = useMemo(() => {
    const ids = packages.flatMap((p) => p.bundles.map((x) => x.id)).filter(Boolean).sort();
    return new Map(ids.map((id, i) => [id, i + 1]));
  }, [packages]);

  /** Container packing list: one row per product line with its bundle mark, quantity and the bundle's weights. */
  const downloadContainerPackingList = async () => {
    const list = readyScope;
    if (list.length === 0) return;
    setDownloading("containerPacking");
    try {
      const lists = await Promise.all(list.map((b) => packageService.getByBooking(b.id).catch(() => null)));
      const productName = (id?: string) => (id ? str(products.find((p) => p._id === id)?.name) : "") || "-";
      const bundles = lists
        .flatMap((l) => l?.bundles ?? [])
        .map((bundle) => ({ bundle, mark: markOf.get(bundle.id) ?? 0 }))
        .sort((a, b) => a.mark - b.mark);
      let qty = 0;
      let net = 0;
      let gross = 0;
      const body = bundles.flatMap(({ bundle, mark }, n) => {
        net += bundle.netWeight || 0;
        gross += bundle.grossWeight || 0;
        const lines = bundle.lines.length ? bundle.lines : [{ productId: "", quantity: 0 }];
        // Mark and weights belong to the bundle, so they print on its first product line only.
        return lines.map((l, i) => {
          qty += Number(l.quantity) || 0;
          return [
            i === 0 ? String(n + 1) : "",
            i === 0 ? (mark ? String(mark) : "-") : "",
            productName(l.productId),
            l.quantity ? String(l.quantity) : "-",
            i === 0 ? `${bundle.netWeight || 0} kg` : "",
            i === 0 ? `${bundle.grossWeight || 0} kg` : "",
          ];
        });
      });
      await downloadTablePdf("container-packing-list.pdf", {
        title: "CONTAINER PACKING LIST",
        info: [
          ["No. of Bookings", String(list.length)],
          ["No. of Bundles", String(bundles.length)],
          ["Generated On", fullDate(new Date().toISOString())],
        ],
        head: ["Sl No", "Bundle Mark", "Product Name", "Quantity", "N.Wt", "Gr.Wt"],
        body,
        foot: ["", "", "Total", String(qty), `${Math.round(net * 100) / 100} kg`, `${Math.round(gross * 100) / 100} kg`],
      });
    } catch (e) {
      Alert.alert("Couldn't create the PDF", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setDownloading(null);
    }
  };

  /** Ready to stuff list: booking, sender, receiver, bundle count, bundle marks and booking date. */
  const downloadReadyList = async () => {
    const list = readyScope;
    if (list.length === 0) return;
    const total = list.reduce((n, b) => n + bundlesOf(b), 0);
    setDownloading("readyList");
    try {
      await downloadTablePdf("ready-to-stuff.pdf", {
        title: "READY TO STUFF",
        info: [
          ["No. of Bookings", String(list.length)],
          ["No. of Bundles", String(total)],
          ["Generated On", fullDate(new Date().toISOString())],
        ],
        head: ["Sl No", "Booking ID", "Sender", "Receiver", "Bundle Count", "Bundle Mark", "Booking Date"],
        body: list.map((b, i) => [
          String(i + 1),
          b.code,
          b.sender.name || "-",
          b.receiver.name || "-",
          String(bundlesOf(b)),
          packing.get(b.id)?.marks.join(", ") || "-",
          fullDate(b.date),
        ]),
        foot: ["", "", "", "Total", String(total), "", ""],
      });
    } catch (e) {
      Alert.alert("Couldn't create the PDF", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setDownloading(null);
    }
  };

  const sendBack = async (b: Booking) => {
    setActionError(null);
    const result = await dispatch(sendBackFromStuffing(b.id));
    if (sendBackFromStuffing.rejected.match(result)) setActionError(result.payload ?? "Couldn't send the booking back.");
  };

  const loading = (status === "loading" || bookingsStatus === "loading") && source.length === 0;
  const submitting = stuffingStatus === "loading";
  const totalBundles = data.reduce((n, b) => n + bundlesOf(b), 0);

  return (
    <Screen>
      <LargeHeader title="Stuffing" />
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label={TAB_LABEL.ready} count={ready.length} active={tab === "ready"} onPress={() => switchTab("ready")} />
          <Chip label={TAB_LABEL.stuffing} count={awaiting.length} active={tab === "stuffing"} onPress={() => switchTab("stuffing")} />
          <Chip label={TAB_LABEL.stuffed} count={stuffings.length} active={tab === "stuffed"} onPress={() => switchTab("stuffed")} />
        </ScrollView>
      </View>
      <View style={{ paddingHorizontal: 20, marginBottom: 8 }}>
        <View style={[styles.search, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Search size={17} color={t.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={tab === "stuffed" ? "Search container or booking ID" : "Search booking ID, sender, receiver"}
            placeholderTextColor={t.textSoft}
            style={[styles.searchInput, { color: t.text }]}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query ? (
            <Pressable onPress={() => setQuery("")} hitSlop={10} accessibilityLabel="Clear search">
              <X size={16} color={t.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {tab === "stuffed" ? (
        <StuffedListView query={query} refreshing={refreshing} onRefresh={onRefresh} />
      ) : loading ? (
        <LoadingView label="Loading stuffing…" />
      ) : (
        <FlatList
          ref={listRef}
          data={data}
          keyExtractor={(b) => b.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} />}
          ListHeaderComponent={
            <>
              {error && <Notice message={error} onRetry={() => dispatch(fetchContainers())} />}
              {actionError && <Notice message={actionError} tone="danger" />}
              {tab === "stuffing" && (
                <SelectField
                  label="Container"
                  placeholder="Choose a container"
                  value={containerId}
                  onChange={setContainerId}
                  options={stuffable.map((c) => ({ value: c.id, label: `${c.code} — ${c.company}` }))}
                  emptyText="No containers free for stuffing. Create one on the web console first."
                />
              )}
              {tab === "ready" && data.length > 0 && (
                <Card style={{ marginBottom: 6 }} padded={false}>
                  <View style={{ padding: 12 }}>
                    <View style={styles.downloadsHead}>
                      <Txt size={14} weight="bold">
                        Downloads
                      </Txt>
                      <Txt size={12.5} muted>
                        {picked.length ? `${picked.length} selected` : "Select bookings below"}
                      </Txt>
                    </View>
                    <View style={styles.downloads}>
                      <DownloadTile
                        icon={Package}
                        title="Container packing list"
                        note="Mark, product, qty, weights"
                        onPress={downloadContainerPackingList}
                        busy={downloading === "containerPacking"}
                        disabled={picked.length === 0 || downloading !== null}
                      />
                      <DownloadTile
                        icon={FileText}
                        title="Download PDF"
                        note="Bookings, bundles, marks, dates"
                        onPress={downloadReadyList}
                        busy={downloading === "readyList"}
                        disabled={picked.length === 0 || downloading !== null}
                      />
                    </View>
                  </View>
                </Card>
              )}
              {data.length > 0 && (
                <View style={styles.listHead}>
                  <Txt size={13} weight="semibold" muted>
                    {tab === "ready" ? `${data.length} booking${data.length === 1 ? "" : "s"} · ${totalBundles} bundles` : ""}
                  </Txt>
                  <Pressable onPress={toggleAll} hitSlop={8} style={styles.selectAll} accessibilityRole="checkbox" accessibilityState={{ checked: allPicked }}>
                    <Checkbox checked={allPicked} />
                    <Txt size={13} weight="semibold">
                      {allPicked ? "Deselect all" : "Select all"}
                    </Txt>
                  </Pressable>
                </View>
              )}
            </>
          }
          ListEmptyComponent={
            query ? (
              <EmptyView title="No matching bookings" message="Try a different booking ID or name." />
            ) : tab === "ready" ? (
              <EmptyView title="Nothing ready to stuff" message="Bookings show up here once every bundle is on their packing list." />
            ) : (
              <EmptyView title="No bookings waiting" message='Select them on Ready to stuff and tap "Go to stuffing".' />
            )
          }
          renderItem={({ item }) => (
            <SelectableBooking
              booking={item}
              checked={picked.includes(item.id)}
              onToggle={() => toggle(item.id)}
              onOpen={() => navigation.navigate("BookingDetail", { id: item.id })}
              marks={tab === "ready" ? packing.get(item.id)?.marks : undefined}
              onSendBack={tab === "stuffing" ? () => sendBack(item) : undefined}
              sendingBack={mutatingId === item.id}
              disabled={submitting}
            />
          )}
        />
      )}

      {tab !== "stuffed" && source.length > 0 && (
        <View style={[styles.footer, { backgroundColor: t.bg, borderTopColor: t.border, paddingBottom: 12 }]}>
          {tab === "ready" ? (
            <Button
              title={`Go to stuffing${picked.length ? ` (${picked.length})` : ""}`}
              icon={ArrowLeftRight}
              onPress={goToStuffing}
              loading={moving}
              disabled={picked.length === 0}
            />
          ) : (
            <Button
              title={`Submit stuffing${picked.length ? ` (${picked.length})` : ""}`}
              icon={ArrowLeftRight}
              onPress={submitStuffing}
              loading={submitting}
              disabled={picked.length === 0 || !containerId}
            />
          )}
        </View>
      )}
    </Screen>
  );
}

function Checkbox({ checked }: { checked: boolean }) {
  const t = useTheme();
  return (
    <View style={[styles.checkbox, { borderColor: checked ? t.primary : t.borderStrong, backgroundColor: checked ? t.primary : t.surface }]}>
      {checked && <Check size={14} color={t.onPrimary} strokeWidth={3} />}
    </View>
  );
}

/** Booking row with a checkbox: tap to select, long-press to open the booking. */
function SelectableBooking({
  booking: b,
  checked,
  onToggle,
  onOpen,
  marks,
  onSendBack,
  sendingBack,
  disabled,
}: {
  booking: Booking;
  checked: boolean;
  onToggle: () => void;
  onOpen: () => void;
  marks?: number[];
  onSendBack?: () => void;
  sendingBack: boolean;
  disabled: boolean;
}) {
  const t = useTheme();
  const n = bundlesOf(b);
  return (
    <Pressable
      onPress={onToggle}
      onLongPress={onOpen}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityHint="Long-press to open the booking"
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: t.surface, borderColor: checked ? t.primary : t.border, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <Checkbox checked={checked} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <View style={styles.rowTop}>
          <Txt mono size={12.5} weight="semibold" color={t.code}>
            {b.code}
          </Txt>
          <Txt size={12} muted>
            {n} bundle{n === 1 ? "" : "s"} · {shortDate(b.date)}
          </Txt>
        </View>
        <Txt size={14.5} weight="bold" numberOfLines={1} style={{ marginTop: 4 }}>
          {b.sender.name || "—"} → {b.receiver.name || "—"}
        </Txt>
        {marks && (
          <Txt size={12} muted numberOfLines={1} style={{ marginTop: 2 }}>
            Bundle marks: {marks.length ? marks.join(", ") : "—"}
          </Txt>
        )}
        {onSendBack && (
          <Pressable onPress={onSendBack} disabled={sendingBack || disabled} hitSlop={6} style={styles.sendBack} accessibilityLabel={`Send ${b.code} back to Ready to stuff`}>
            {sendingBack ? <ActivityIndicator size="small" color={t.primary} /> : <Undo2 size={14} color={t.primary} />}
            <Txt size={12.5} weight="semibold" color={t.primary}>
              Send back
            </Txt>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chips: { paddingHorizontal: 20, paddingVertical: 12 },
  search: { flexDirection: "row", alignItems: "center", gap: 10, height: 46, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: 14 },
  searchInput: { flex: 1, fontSize: 15, fontFamily: fonts.medium, paddingVertical: 0 },
  list: { paddingHorizontal: 20, paddingBottom: 30, flexGrow: 1 },
  listHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4, marginBottom: 10 },
  selectAll: { flexDirection: "row", alignItems: "center", gap: 8 },
  checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "flex-start", padding: 14, borderRadius: radius.lg, borderWidth: 1, marginBottom: 10 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sendBack: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginTop: 8 },
  footer: { paddingHorizontal: 20, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  downloadsHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  downloads: { gap: 8 },
});
