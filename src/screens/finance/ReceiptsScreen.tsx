/** Receipts — the web console's Receipt entry list, newest first. New entries come from the tab bar's + button. */
import React, { useCallback, useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, TextInput, View } from "react-native";
import { ChevronLeft, Search, X } from "lucide-react-native";
import { Card, IconButton } from "@/components/primitives";
import { ReceiptRow } from "@/components/ReceiptRow";
import { EmptyView, LoadingView, NavHeader, Notice, Screen } from "@/components/Screen";
import { useRefresh } from "@/hooks/useBootstrapData";
import type { MoreScreenProps } from "@/navigation/types";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectReceiptRows } from "@/store/selectors";
import { fetchBookings } from "@/store/slices/bookingsSlice";
import { fetchFinance } from "@/store/slices/financeSlice";
import { fonts, radius } from "@/theme/fonts";
import { useTheme } from "@/theme/ThemeProvider";

export function ReceiptsScreen({ navigation }: MoreScreenProps<"Receipts">) {
  const t = useTheme();
  const dispatch = useAppDispatch();
  const rows = useAppSelector(selectReceiptRows);
  const { status, error } = useAppSelector((s) => s.finance);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback(() => Promise.all([dispatch(fetchFinance()), dispatch(fetchBookings())]), [dispatch]);
  const { refreshing, onRefresh } = useRefresh(load);

  const data = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rows.filter(({ receipt: r, party }) => `${r.invoiceNo} ${r.code} ${party}`.toLowerCase().includes(q)) : rows;
  }, [rows, query]);

  return (
    <Screen>
      <NavHeader
        left={<IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} accessibilityLabel="Back" />}
        title="Receipts"
        right={
          <IconButton
            icon={searching ? X : Search}
            onPress={() => {
              setSearching((s) => !s);
              setQuery("");
            }}
            accessibilityLabel={searching ? "Close search" : "Search receipts"}
          />
        }
      />
      {searching && (
        <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
          <View style={[styles.search, { backgroundColor: t.surface, borderColor: t.border }]}>
            <Search size={17} color={t.textMuted} />
            <TextInput
              autoFocus
              value={query}
              onChangeText={setQuery}
              placeholder="Invoice number or customer"
              placeholderTextColor={t.textSoft}
              style={{ flex: 1, color: t.text, fontFamily: fonts.medium, fontSize: 15 }}
            />
          </View>
        </View>
      )}

      {status === "loading" && rows.length === 0 ? (
        <LoadingView label="Loading receipts…" />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(row) => row.receipt.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 30, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} />}
          ListHeaderComponent={error ? <Notice message={error} onRetry={() => dispatch(fetchFinance())} /> : null}
          ListEmptyComponent={<EmptyView title={query ? "No matching receipts" : "No receipts yet"} message={query ? undefined : "Tap + to add a receipt entry."} />}
          renderItem={({ item }) => (
            <Card padded={false} style={{ marginBottom: 10 }}>
              <ReceiptRow row={item} last />
            </Card>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: "row", alignItems: "center", gap: 10, height: 46, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: 14 },
});
