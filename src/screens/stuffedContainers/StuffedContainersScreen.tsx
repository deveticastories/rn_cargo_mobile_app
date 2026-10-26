/**
 * Containers (More → Masters) — the web console's Stuffing → "Stuffed list":
 * every stuffed container with its name, booking count and stuffed date,
 * searchable, with the "STUFFED LIST" PDF. Tap one to see its bookings.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, TextInput, View } from "react-native";
import { ChevronLeft, ChevronRight, Download, Search, Ship, X } from "lucide-react-native";
import { Card, IconButton, IconTile } from "@/components/primitives";
import { EmptyView, LoadingView, NavHeader, Notice, Screen } from "@/components/Screen";
import { Txt } from "@/components/Txt";
import { useRefresh } from "@/hooks/useBootstrapData";
import type { MoreScreenProps } from "@/navigation/types";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchBookings } from "@/store/slices/bookingsSlice";
import { fetchContainers } from "@/store/slices/containersSlice";
import { fetchFinance } from "@/store/slices/financeSlice";
import { fetchMaster } from "@/store/slices/mastersSlice";
import { fonts, radius } from "@/theme/fonts";
import { useTheme } from "@/theme/ThemeProvider";
import { fullDate, todayISO } from "@/utils/format";
import { downloadTablePdf } from "@/utils/tablePdf";
import { useStuffedData, type StuffedRow } from "./useStuffedData";

export function StuffedContainersScreen({ navigation }: MoreScreenProps<"StuffedContainers">) {
  const t = useTheme();
  const dispatch = useAppDispatch();
  const { status, error } = useAppSelector((s) => s.containers);
  const { rows } = useStuffedData();
  const [query, setQuery] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    dispatch(fetchMaster("customers"));
    dispatch(fetchMaster("pricing"));
  }, [dispatch]);

  const load = useCallback(() => Promise.all([dispatch(fetchContainers()), dispatch(fetchBookings()), dispatch(fetchFinance())]), [dispatch]);
  const { refreshing, onRefresh } = useRefresh(load);

  // Search container ID or container name, like the web.
  const data = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rows.filter((r) => [r.containerCode, r.containerName].some((v) => v.toLowerCase().includes(q))) : rows;
  }, [rows, query]);

  const downloadPdf = async () => {
    if (data.length === 0) return;
    const totalBookings = data.reduce((n, r) => n + r.bookingIds.length, 0);
    setDownloading(true);
    try {
      await downloadTablePdf("stuffed-list.pdf", {
        title: "STUFFED LIST",
        info: [
          ["No. of Containers", String(data.length)],
          ["No. of Bookings", String(totalBookings)],
          ["Generated On", fullDate(todayISO())],
          ...(query.trim() ? ([["Filter", query.trim()]] as [string, string][]) : []),
        ],
        head: ["Sl No", "Container ID", "Container Name", "No. of Bookings", "Stuffed Date"],
        body: data.map((r, i) => [String(i + 1), r.containerCode, r.containerName, String(r.bookingIds.length), r.stuffedDate ? fullDate(r.stuffedDate) : "-"]),
        foot: ["", "", "Total", String(totalBookings), ""],
      });
    } catch (e) {
      Alert.alert("Couldn't create the PDF", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Screen>
      <NavHeader
        left={<IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} accessibilityLabel="Back" />}
        title="Containers"
        right={
          downloading ? (
            <ActivityIndicator color={t.primary} style={{ width: 40 }} />
          ) : (
            <IconButton icon={Download} onPress={downloadPdf} accessibilityLabel="Download stuffed list PDF" />
          )
        }
      />
      <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
        <View style={[styles.search, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Search size={17} color={t.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search container ID, container name"
            placeholderTextColor={t.textSoft}
            style={[styles.searchInput, { color: t.text }]}
            autoCorrect={false}
            autoCapitalize="characters"
          />
          {query ? (
            <Pressable onPress={() => setQuery("")} hitSlop={10} accessibilityLabel="Clear search">
              <X size={16} color={t.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {status === "loading" && rows.length === 0 ? (
        <LoadingView label="Loading containers…" />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 30, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} />}
          ListHeaderComponent={error ? <Notice message={error} onRetry={() => dispatch(fetchContainers())} /> : null}
          ListEmptyComponent={
            <EmptyView title={query ? "No matching containers" : "Nothing stuffed yet"} message={query ? `No stuffed containers match "${query}".` : undefined} />
          }
          renderItem={({ item, index }) => <StuffedCard row={item} slNo={index + 1} onPress={() => navigation.navigate("StuffedContainer", { stuffingId: item.id })} />}
        />
      )}
    </Screen>
  );
}

function StuffedCard({ row, slNo, onPress }: { row: StuffedRow; slNo: number; onPress: () => void }) {
  const t = useTheme();
  const n = row.bookingIds.length;
  return (
    <Card onPress={onPress} style={{ marginBottom: 10 }}>
      <View style={styles.row}>
        <IconTile icon={Ship} tone="purple" size={44} />
        <View style={{ flex: 1, marginHorizontal: 12 }}>
          <Txt mono size={14} weight="bold">
            {row.containerCode}
          </Txt>
          <Txt size={12.5} muted numberOfLines={1}>
            {row.containerName}
          </Txt>
          <Txt size={12} muted style={{ marginTop: 2 }}>
            {n} booking{n === 1 ? "" : "s"} · Stuffed {row.stuffedDate ? fullDate(row.stuffedDate) : "—"}
          </Txt>
        </View>
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <Txt size={11} soft>
            #{slNo}
          </Txt>
          <ChevronRight size={18} color={t.textMuted} />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: "row", alignItems: "center", gap: 10, height: 46, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: 14 },
  searchInput: { flex: 1, fontSize: 15, fontFamily: fonts.medium, paddingVertical: 0 },
  row: { flexDirection: "row", alignItems: "center" },
});
