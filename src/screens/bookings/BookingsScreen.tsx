/** 03 · Bookings — search, status filter chips, sender → receiver cards. */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Search, SlidersHorizontal, X } from "lucide-react-native";
import { BookingCard } from "@/components/BookingViews";
import { Chip, IconButton } from "@/components/primitives";
import { EmptyView, LargeHeader, LoadingView, Notice, Screen } from "@/components/Screen";
import { SelectSheet } from "@/components/SelectSheet";
import { useRefresh } from "@/hooks/useBootstrapData";
import { useCustomerLookup } from "@/hooks/useCustomerLookup";
import { useTabScrollReset } from "@/hooks/useTabScrollReset";
import type { BookingFilter, TabScreenProps } from "@/navigation/types";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { bookingStage, selectBookingStats, selectBookingsSorted } from "@/store/selectors";
import { fetchBookings } from "@/store/slices/bookingsSlice";
import { fetchMaster } from "@/store/slices/mastersSlice";
import { fonts, radius } from "@/theme/fonts";
import { useTheme } from "@/theme/ThemeProvider";
import type { Booking } from "@/types";
import { parseDate } from "@/utils/format";

type SortKey = "newest" | "oldest" | "bundles";
const SORT_LABELS: Record<SortKey, string> = { newest: "Newest first", oldest: "Oldest first", bundles: "Most bundles" };

function matchesFilter(b: Booking, filter: BookingFilter): boolean {
  if (filter === "all") return true;
  const stage = bookingStage(b);
  // "Ready" covers everything ready to ship that isn't stuffed yet, including bookings already queued for stuffing.
  if (filter === "ready") return stage === "ready" || stage === "readyToStuff";
  return stage === filter;
}

export function BookingsScreen({ navigation, route }: TabScreenProps<"Bookings">) {
  const t = useTheme();
  const dispatch = useAppDispatch();
  const sorted = useAppSelector(selectBookingsSorted);
  const stats = useAppSelector(selectBookingStats);
  const { status, error } = useAppSelector((s) => s.bookings);
  const lookup = useCustomerLookup();

  const [filter, setFilter] = useState<BookingFilter>(route.params?.filter ?? "all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [sortOpen, setSortOpen] = useState(false);

  // Dashboard shortcuts navigate here with a filter.
  useEffect(() => {
    if (route.params?.filter) setFilter(route.params.filter);
  }, [route.params?.filter]);

  const load = useCallback(() => Promise.all([dispatch(fetchBookings()), dispatch(fetchMaster("customers"))]), [dispatch]);
  const { refreshing, onRefresh } = useRefresh(load);
  const listRef = useRef<FlatList<Booking>>(null);
  useTabScrollReset(listRef);

  const data = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = sorted.filter((b) => matchesFilter(b, filter));
    if (q) {
      list = list.filter((b) =>
        [b.code, b.sender.name, b.receiver.name, lookup.senderPlace(b), lookup.receiverPlace(b), b.pickupOption]
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    }
    // `sorted` is newest-created first; a stable sort by booking date keeps that order for same-day bookings.
    const time = (b: Booking) => parseDate(b.date)?.getTime() ?? 0;
    if (sort === "newest") return [...list].sort((a, b) => time(b) - time(a));
    if (sort === "oldest") return [...list].reverse().sort((a, b) => time(a) - time(b));
    return [...list].sort((a, b) => (b.actualBundle || b.bundleCount) - (a.actualBundle || a.bundleCount));
  }, [sorted, filter, query, sort, lookup]);

  const chips: { key: BookingFilter; label: string; count: number }[] = [
    { key: "all", label: "All", count: stats.total },
    { key: "repacking", label: "Repacking", count: stats.counts.repacking },
    { key: "ready", label: "Ready", count: stats.counts.ready + stats.counts.readyToStuff },
    { key: "readyToStuff", label: "To stuff", count: stats.counts.readyToStuff },
    { key: "stuffed", label: "Stuffed", count: stats.counts.stuffed },
  ];

  return (
    <Screen>
      <LargeHeader title="Bookings" right={<IconButton icon={SlidersHorizontal} onPress={() => setSortOpen(true)} accessibilityLabel="Sort" />} />

      <View style={styles.searchWrap}>
        <View style={[styles.search, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Search size={17} color={t.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search code, sender, receiver…"
            placeholderTextColor={t.textSoft}
            style={[styles.searchInput, { color: t.text }]}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {query ? (
            <Pressable onPress={() => setQuery("")} hitSlop={10} accessibilityLabel="Clear search">
              <X size={16} color={t.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {chips.map((c) => (
            <Chip key={c.key} label={c.label} count={c.count} active={filter === c.key} onPress={() => setFilter(c.key)} />
          ))}
        </ScrollView>
      </View>

      {status === "loading" && sorted.length === 0 ? (
        <LoadingView label="Loading bookings…" />
      ) : (
        <FlatList
          ref={listRef}
          data={data}
          keyExtractor={(b) => b.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} />}
          ListHeaderComponent={error ? <Notice message={error} onRetry={() => dispatch(fetchBookings())} /> : null}
          ListEmptyComponent={
            <EmptyView
              title={query ? "No matching bookings" : "No bookings here"}
              message={query ? "Try a different code or name." : "Tap + to create a booking."}
            />
          }
          renderItem={({ item }) => (
            <BookingCard
              booking={item}
              senderPlace={lookup.senderPlace(item)}
              receiverPlaceText={lookup.receiverPlace(item)}
              onPress={() => navigation.navigate("BookingDetail", { id: item.id })}
            />
          )}
        />
      )}

      <SelectSheet
        visible={sortOpen}
        title="Sort bookings"
        value={sort}
        options={(Object.keys(SORT_LABELS) as SortKey[]).map((k) => ({ value: k, label: SORT_LABELS[k] }))}
        onClose={() => setSortOpen(false)}
        onSelect={(v) => {
          setSort(v as SortKey);
          setSortOpen(false);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchWrap: { paddingHorizontal: 20 },
  search: { flexDirection: "row", alignItems: "center", gap: 10, height: 48, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: 14 },
  searchInput: { flex: 1, fontSize: 15, fontFamily: fonts.medium, paddingVertical: 0 },
  chips: { paddingHorizontal: 20, paddingVertical: 14 },
  list: { paddingHorizontal: 20, paddingBottom: 30, flexGrow: 1 },
});
