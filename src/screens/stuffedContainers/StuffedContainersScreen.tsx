/**
 * Containers (finance mode, More → Masters) — the web console's Stuffing →
 * "Stuffed list", same as the Stuffing tab's: the CONTAINER LIST PDF (header), and each
 * container dropping down its bookings (charges, bundles) with their PDFs.
 */
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, TextInput, View } from "react-native";
import { ChevronLeft, Download, Search, X } from "lucide-react-native";
import { IconButton } from "@/components/primitives";
import { NavHeader, Screen } from "@/components/Screen";
import { useRefresh } from "@/hooks/useBootstrapData";
import type { MoreScreenProps } from "@/navigation/types";
import { useAppDispatch } from "@/store/hooks";
import { fetchBookings } from "@/store/slices/bookingsSlice";
import { fetchContainers } from "@/store/slices/containersSlice";
import { fetchFinance } from "@/store/slices/financeSlice";
import { ensureMaster } from "@/store/ensure";
import { fonts, radius } from "@/theme/fonts";
import { useTheme } from "@/theme/ThemeProvider";
import { downloadContainerListPdf, StuffedListView, useStuffedRows } from "./StuffedListView";

export function StuffedContainersScreen({ navigation }: MoreScreenProps<"StuffedContainers">) {
  const t = useTheme();
  const dispatch = useAppDispatch();
  const [query, setQuery] = useState("");
  const [downloading, setDownloading] = useState(false);
  const { rows } = useStuffedRows(query);

  /** CONTAINER LIST PDF of the containers shown (respects the search). */
  const downloadList = async () => {
    if (rows.length === 0) return Alert.alert("Nothing to download", "No stuffed containers to list.");
    setDownloading(true);
    try {
      await downloadContainerListPdf(rows, query);
    } catch (e) {
      Alert.alert("Couldn't create the PDF", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    dispatch(ensureMaster("customers"));
    dispatch(ensureMaster("pricing"));
    dispatch(ensureMaster("products"));
    dispatch(ensureMaster("fabrics"));
  }, [dispatch]);

  const load = useCallback(() => Promise.all([dispatch(fetchContainers()), dispatch(fetchBookings()), dispatch(fetchFinance())]), [dispatch]);
  const { refreshing, onRefresh } = useRefresh(load);

  return (
    <Screen>
      <NavHeader
        left={<IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} accessibilityLabel="Back" />}
        title="Containers"
        right={
          downloading ? (
            <ActivityIndicator color={t.primary} style={{ width: 40 }} />
          ) : (
            <IconButton icon={Download} onPress={downloadList} accessibilityLabel="Download container list PDF" />
          )
        }
      />
      <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
        <View style={[styles.search, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Search size={17} color={t.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search container or booking ID"
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
      <StuffedListView query={query} refreshing={refreshing} onRefresh={onRefresh} showDownload={false} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: "row", alignItems: "center", gap: 10, height: 46, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: 14 },
  searchInput: { flex: 1, fontSize: 15, fontFamily: fonts.medium, paddingVertical: 0 },
});
