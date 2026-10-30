/**
 * The web console's Stuffing → "Stuffed list", shared by the Stuffing tab and
 * the finance Containers screen: the CONTAINER LIST PDF, then one card per
 * stuffing (newest first) that drops down its bookings — each expanding to its
 * charges and bundles — with the container booking list PDF.
 */
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { ChevronDown, ChevronUp, Download, FileText, Ship } from "lucide-react-native";
import { Card, IconTile } from "@/components/primitives";
import { EmptyView, LoadingView, Notice } from "@/components/Screen";
import { Txt } from "@/components/Txt";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchContainers } from "@/store/slices/containersSlice";
import { radius } from "@/theme/fonts";
import { useTheme } from "@/theme/ThemeProvider";
import { fullDate } from "@/utils/format";
import { downloadTablePdf } from "@/utils/tablePdf";
import { StuffedBookingCard } from "./StuffedContainerScreen";
import { downloadContainerBookingList, useStuffedData, type StuffedBooking, type StuffedRow } from "./useStuffedData";

type IconType = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

/** A download option: icon, title and what the PDF contains. */
export function DownloadTile({
  icon: Icon,
  title,
  note,
  onPress,
  busy,
  disabled,
}: {
  icon: IconType;
  title: string;
  note: string;
  onPress: () => void;
  busy: boolean;
  disabled: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`Download ${title} PDF`}
      style={({ pressed }) => [
        styles.tile,
        { borderColor: t.border, backgroundColor: t.surfaceAlt, opacity: disabled && !busy ? 0.5 : pressed ? 0.85 : 1 },
      ]}
    >
      <View style={[styles.tileIcon, { backgroundColor: t.tones.info.bg }]}>
        <Icon size={18} color={t.tones.info.fg} />
      </View>
      <View style={{ flex: 1, marginHorizontal: 12 }}>
        <Txt size={14.5} weight="bold">
          {title}
        </Txt>
        <Txt size={12} muted numberOfLines={1} style={{ marginTop: 1 }}>
          {busy ? "Preparing PDF…" : note}
        </Txt>
      </View>
      {busy ? <ActivityIndicator size="small" color={t.primary} /> : <Download size={20} color={t.primary} />}
    </Pressable>
  );
}

/** Stuffed containers matching the search (container ID, name or any booking ID inside), newest first. */
export function useStuffedRows(query: string) {
  const allBookings = useAppSelector((s) => s.bookings.items);
  const { rows: all, bookingRow } = useStuffedData();
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((r) =>
      [r.containerCode, r.containerName, ...r.bookingIds.map((id) => allBookings.find((b) => b.id === id)?.code ?? "")].join(" ").toLowerCase().includes(q)
    );
  }, [all, allBookings, query]);
  return { rows, all, bookingRow };
}

/** The "CONTAINER LIST" PDF: one row per stuffed container shown, newest first. */
export function downloadContainerListPdf(rows: StuffedRow[], query: string) {
  const totalBookings = rows.reduce((n, r) => n + r.bookingIds.length, 0);
  return downloadTablePdf("container-list.pdf", {
    title: "CONTAINER LIST",
    info: [
      ["No. of Containers", String(rows.length)],
      ["No. of Bookings", String(totalBookings)],
      ["Generated On", fullDate(new Date().toISOString())],
      ...(query.trim() ? ([["Filter", query.trim()]] as [string, string][]) : []),
    ],
    head: ["Sl No", "Container ID", "Container Name", "No. of Bookings", "Stuffed Date"],
    body: rows.map((r, i) => [String(i + 1), r.containerCode, r.containerName, String(r.bookingIds.length), r.stuffedDate ? fullDate(r.stuffedDate) : "-"]),
    foot: ["", "", "Total", String(totalBookings), ""],
  });
}

export function StuffedListView({
  query,
  refreshing,
  onRefresh,
  showDownload = true,
}: {
  query: string;
  refreshing: boolean;
  onRefresh: () => void;
  /** Show the Container list PDF tile above the list (off when the screen has its own download button). */
  showDownload?: boolean;
}) {
  const t = useTheme();
  const dispatch = useAppDispatch();
  const { status, error } = useAppSelector((s) => s.containers);
  const { rows, all, bookingRow } = useStuffedRows(query);
  const [openStuffing, setOpenStuffing] = useState<string | null>(null);
  const [openBooking, setOpenBooking] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  /** Runs one PDF download, tracking it by key for the spinners. */
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

  const downloadStuffedList = () => run("stuffed", () => downloadContainerListPdf(rows, query));

  if (status === "loading" && all.length === 0) return <LoadingView label="Loading containers…" />;

  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => r.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} />}
      ListHeaderComponent={
        <>
          {error && <Notice message={error} onRetry={() => dispatch(fetchContainers())} />}
          {showDownload && rows.length > 0 && (
            <Card style={{ marginBottom: 12 }} padded={false}>
              <View style={{ padding: 12 }}>
                <DownloadTile
                  icon={FileText}
                  title="Container list"
                  note={`${rows.length} container${rows.length === 1 ? "" : "s"} · PDF`}
                  onPress={downloadStuffedList}
                  busy={downloading === "stuffed"}
                  disabled={downloading !== null}
                />
              </View>
            </Card>
          )}
        </>
      }
      ListEmptyComponent={
        query ? (
          <EmptyView title="No matching containers" message="Try a different container or booking ID." />
        ) : (
          <EmptyView title="Nothing stuffed yet" message='Containers show up here after "Submit stuffing".' />
        )
      }
      renderItem={({ item, index }) => (
        <StuffedContainerCard
          row={item}
          slNo={index + 1}
          open={openStuffing === item.id}
          onToggle={() => setOpenStuffing(openStuffing === item.id ? null : item.id)}
          bookings={openStuffing === item.id ? item.bookingIds.map(bookingRow) : []}
          openBooking={openBooking}
          onToggleBooking={(id) => setOpenBooking(openBooking === id ? null : id)}
          downloading={downloading}
          run={run}
          onDownload={() => run(`manifest-${item.id}`, () => downloadContainerBookingList(item, item.bookingIds.map(bookingRow)))}
        />
      )}
    />
  );
}

/** One stuffing: container, date and counts; tap to drop down its bookings and the container booking list PDF. */
function StuffedContainerCard({
  row,
  slNo,
  open,
  onToggle,
  bookings,
  openBooking,
  onToggleBooking,
  downloading,
  run,
  onDownload,
}: {
  row: StuffedRow;
  slNo: number;
  open: boolean;
  onToggle: () => void;
  bookings: StuffedBooking[];
  openBooking: string | null;
  onToggleBooking: (bookingId: string) => void;
  downloading: string | null;
  run: (key: string, task: () => Promise<void>) => Promise<void>;
  onDownload: () => void;
}) {
  const t = useTheme();
  const Chevron = open ? ChevronUp : ChevronDown;
  const n = row.bookingIds.length;
  return (
    <Card style={{ marginBottom: 10 }} padded={false}>
      <Pressable onPress={onToggle} style={styles.head} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <IconTile icon={Ship} tone="purple" size={44} />
        <View style={{ flex: 1, marginHorizontal: 12 }}>
          <Txt mono size={14} weight="bold" color={t.code}>
            {slNo}. {row.containerCode}
          </Txt>
          <Txt size={12.5} muted numberOfLines={1}>
            {row.containerName}
          </Txt>
          <Txt size={12} muted style={{ marginTop: 2 }}>
            {n} booking{n === 1 ? "" : "s"} · Stuffed {row.stuffedDate ? fullDate(row.stuffedDate) : "—"}
          </Txt>
        </View>
        <Chevron size={20} color={t.textMuted} />
      </Pressable>

      {open && (
        <View style={[styles.dropdown, { borderTopColor: t.border }]}>
          <Pressable
            onPress={onDownload}
            disabled={downloading !== null}
            style={({ pressed }) => [styles.manifest, { backgroundColor: t.surfaceAlt, borderColor: t.border, opacity: pressed ? 0.85 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel="Download container booking list PDF"
          >
            <FileText size={16} color={t.primary} />
            <Txt size={13} weight="semibold" color={t.primary} style={{ flex: 1 }}>
              Container booking list
            </Txt>
            {downloading === `manifest-${row.id}` ? <ActivityIndicator size="small" color={t.primary} /> : <Download size={16} color={t.primary} />}
          </Pressable>

          {bookings.length === 0 ? (
            <Txt size={13} muted style={{ padding: 16 }}>
              No bookings recorded for this stuffing.
            </Txt>
          ) : (
            <View style={{ paddingHorizontal: 12 }}>
              {bookings.map((b, i) => (
                <StuffedBookingCard
                  key={b.id}
                  slNo={i + 1}
                  item={b}
                  row={row}
                  containerInfo={[
                    ["Container ID", row.containerCode],
                    ["Container Name", row.containerName],
                  ]}
                  open={openBooking === b.id}
                  onToggle={() => onToggleBooking(b.id)}
                  downloading={downloading}
                  run={run}
                />
              ))}
            </View>
          )}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 20, paddingBottom: 30, flexGrow: 1 },
  tile: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10 },
  tileIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  head: { flexDirection: "row", alignItems: "center", padding: 14 },
  dropdown: { borderTopWidth: StyleSheet.hairlineWidth * 2 },
  manifest: { flexDirection: "row", alignItems: "center", gap: 10, margin: 12, paddingHorizontal: 12, height: 42, borderRadius: radius.md, borderWidth: 1 },
});
