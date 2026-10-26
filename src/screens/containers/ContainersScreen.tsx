/** 06 · Containers — voyage tracker, cut-off warnings, load progress. */
import React, { useCallback, useMemo, useState } from "react";
import { FlatList, RefreshControl, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Boxes, ChevronLeft, Search, Ship, X } from "lucide-react-native";
import { Badge, Card, Chip, IconButton, IconTile, ProgressBar, Stat } from "@/components/primitives";
import { EmptyView, LoadingView, NavHeader, Notice, Screen } from "@/components/Screen";
import { Txt } from "@/components/Txt";
import { useRefresh } from "@/hooks/useBootstrapData";
import type { RootScreenProps } from "@/navigation/types";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { containerPhase, selectBookingsPerContainer, voyageProgress, type ContainerPhase } from "@/store/selectors";
import { fetchBookings } from "@/store/slices/bookingsSlice";
import { fetchContainers } from "@/store/slices/containersSlice";
import { fonts, radius } from "@/theme/fonts";
import { useTheme } from "@/theme/ThemeProvider";
import type { Container } from "@/types";
import { clamp, daysFromToday, shortDate } from "@/utils/format";

type Tab = "atSea" | "loading" | "stuffed";

const TAB_LABEL: Record<Tab, string> = { atSea: "At sea", loading: "Loading", stuffed: "Stuffed" };

/** Which tab a container belongs to: at sea, loading at Kochi, or stuffed (waiting to sail / arrived). */
function tabOf(phase: ContainerPhase): Tab {
  if (phase === "atSea") return "atSea";
  if (phase === "loading") return "loading";
  return "stuffed";
}

/** Days before cut-off over which the loading bar fills up. */
const LOADING_WINDOW_DAYS = 14;

export function ContainersScreen({ navigation }: RootScreenProps<"Containers">) {
  const t = useTheme();
  const dispatch = useAppDispatch();
  const { items, status, error } = useAppSelector((s) => s.containers);
  const perContainer = useAppSelector(selectBookingsPerContainer);
  const readyToStuff = useAppSelector((s) => s.bookings.items.filter((b) => b.stuffStatus === "Ready to Stuff").length);
  const [tab, setTab] = useState<Tab>("atSea");
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback(() => Promise.all([dispatch(fetchContainers()), dispatch(fetchBookings())]), [dispatch]);
  const { refreshing, onRefresh } = useRefresh(load);

  const grouped = useMemo(() => {
    const groups: Record<Tab, Container[]> = { atSea: [], loading: [], stuffed: [] };
    for (const c of items) {
      if (c.status === "Inactive") continue;
      groups[tabOf(containerPhase(c))].push(c);
    }
    // Most urgent first: soonest arrival, soonest cut-off, soonest departure.
    const byDate = (key: keyof Container) => (a: Container, b: Container) =>
      String(a[key] ?? "9999").localeCompare(String(b[key] ?? "9999"));
    groups.atSea.sort(byDate("etaUae"));
    groups.loading.sort(byDate("cutOffDate"));
    groups.stuffed.sort(byDate("etdCok"));
    return groups;
  }, [items]);

  const data = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = grouped[tab];
    return q ? list.filter((c) => `${c.code} ${c.company} ${c.stuffingCode ?? ""}`.toLowerCase().includes(q)) : list;
  }, [grouped, tab, query]);

  return (
    <Screen>
      <NavHeader
        left={<IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} accessibilityLabel="Back" />}
        title="Containers"
        right={
          <IconButton
            icon={searching ? X : Search}
            onPress={() => {
              setSearching((s) => !s);
              setQuery("");
            }}
            accessibilityLabel={searching ? "Close search" : "Search containers"}
          />
        }
      />
      {searching && (
        <View style={{ paddingHorizontal: 20, marginBottom: 4 }}>
          <View style={[styles.search, { backgroundColor: t.surface, borderColor: t.border }]}>
            <Search size={17} color={t.textMuted} />
            <TextInput
              autoFocus
              value={query}
              onChangeText={setQuery}
              placeholder="Container code or line"
              placeholderTextColor={t.textSoft}
              style={{ flex: 1, color: t.text, fontFamily: fonts.medium, fontSize: 15 }}
              autoCapitalize="characters"
            />
          </View>
        </View>
      )}
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {(Object.keys(TAB_LABEL) as Tab[]).map((k) => (
            <Chip key={k} label={TAB_LABEL[k]} count={grouped[k].length} active={tab === k} onPress={() => setTab(k)} />
          ))}
        </ScrollView>
      </View>

      {status === "loading" && items.length === 0 ? (
        <LoadingView label="Loading containers…" />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 30, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} />}
          ListHeaderComponent={
            <>
              {error && <Notice message={error} onRetry={() => dispatch(fetchContainers())} />}
              {tab === "loading" && readyToStuff > 0 && (
                <Notice message={`${readyToStuff} booking${readyToStuff === 1 ? " is" : "s are"} waiting to be stuffed — submit them from the Stuffing tab.`} />
              )}
            </>
          }
          ListEmptyComponent={<EmptyView title={`Nothing ${TAB_LABEL[tab].toLowerCase()}`} message="Containers are created on the web console." />}
          renderItem={({ item }) => <ContainerCard container={item} bookings={perContainer.get(item.id)?.size ?? 0} />}
        />
      )}
    </Screen>
  );
}

function ContainerCard({ container: c, bookings }: { container: Container; bookings: number }) {
  const phase = containerPhase(c);
  const loading = phase === "loading";
  const subtitle = [c.company || "—", loading ? null : `${bookings} booking${bookings === 1 ? "" : "s"}`].filter(Boolean).join(" · ");

  return (
    <Card style={{ marginBottom: 12 }}>
      <View style={styles.head}>
        <IconTile icon={loading ? Boxes : Ship} tone={loading ? "success" : "info"} size={44} />
        <View style={{ flex: 1, marginHorizontal: 12 }}>
          <Txt mono size={13.5} weight="bold">
            {c.code}
          </Txt>
          <Txt size={12.5} muted numberOfLines={2}>
            {subtitle}
          </Txt>
        </View>
        {loading ? (
          <Badge label="Active" tone="success" size="sm" />
        ) : (
          <Badge label={phase === "arrived" ? "Arrived" : "Stuffed"} tone={phase === "arrived" ? "success" : "purple"} size="sm" />
        )}
      </View>

      {loading ? <LoadingBlock c={c} /> : <VoyageBlock c={c} phase={phase} />}
    </Card>
  );
}

function VoyageBlock({ c, phase }: { c: Container; phase: ContainerPhase }) {
  const t = useTheme();
  const progress = phase === "arrived" ? 1 : phase === "stuffed" ? 0 : voyageProgress(c) ?? 0;
  const toEta = daysFromToday(c.etaUae);
  const toEtd = daysFromToday(c.etdCok);
  const caption =
    phase === "arrived"
      ? `Arrived ${shortDate(c.etaUae)}`
      : phase === "atSea"
        ? toEta !== null
          ? `${toEta} day${toEta === 1 ? "" : "s"} to arrival`
          : "At sea"
        : toEtd !== null
          ? toEtd === 0
            ? "Sails today"
            : `Sails in ${toEtd} day${toEtd === 1 ? "" : "s"}`
          : "Awaiting departure";

  return (
    <>
      <View style={[styles.route, { marginTop: 16 }]}>
        <Txt size={20} weight="bold">
          COK
        </Txt>
        <Txt size={20} weight="bold">
          JEA
        </Txt>
      </View>
      <View style={styles.route}>
        <Txt size={12} muted>
          Kochi
        </Txt>
        <Txt size={12} muted>
          Jebel Ali
        </Txt>
      </View>
      <View style={styles.track}>
        <ProgressBar value={progress} height={5} />
        <View style={[styles.shipMarker, { left: `${clamp(progress, 0.04, 0.96) * 100}%` as const, backgroundColor: t.surface, borderColor: t.primary }]}>
          <Ship size={13} color={t.primary} strokeWidth={2} />
        </View>
      </View>
      <Txt size={12} muted align="center" style={{ marginTop: 10 }}>
        {caption}
      </Txt>
      <View style={[styles.dates, { borderColor: t.border }]}>
        <Stat label="Stuffed" value={shortDate(c.stuffingDate)} />
        <Stat label="ETD COK" value={shortDate(c.etdCok)} />
        <Stat label="ETA UAE" value={shortDate(c.etaUae)} />
      </View>
    </>
  );
}

function LoadingBlock({ c }: { c: Container }) {
  const t = useTheme();
  const toCutoff = daysFromToday(c.cutOffDate);
  const pct = toCutoff === null ? 0 : clamp(1 - toCutoff / LOADING_WINDOW_DAYS);
  const urgent = toCutoff !== null && toCutoff <= 3;
  const label =
    toCutoff === null ? "No cut-off set" : toCutoff < 0 ? "Cut-off passed" : toCutoff === 0 ? "Cut-off today" : `${toCutoff} day${toCutoff === 1 ? "" : "s"} to cut-off`;

  return (
    <>
      <View style={[styles.route, { marginTop: 16, marginBottom: 8 }]}>
        <Txt size={13} muted>
          Loading window
        </Txt>
        <Txt size={14} weight="bold" color={urgent ? t.tones.danger.fg : t.text}>
          {label}
        </Txt>
      </View>
      <ProgressBar value={pct} color={urgent ? t.tones.danger.fg : t.primary} height={7} />
      <View style={[styles.dates, { borderColor: t.border }]}>
        <Stat label="Cut-off" value={shortDate(c.cutOffDate)} valueColor={urgent ? t.tones.danger.fg : undefined} />
        <Stat label="ETD COK" value={shortDate(c.etdCok)} />
        <Stat label="ETA UAE" value={shortDate(c.etaUae)} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: "row", alignItems: "center", gap: 10, height: 46, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: 14 },
  chips: { paddingHorizontal: 20, paddingVertical: 12 },
  head: { flexDirection: "row", alignItems: "center" },
  route: { flexDirection: "row", justifyContent: "space-between" },
  track: { marginTop: 14, height: 26, justifyContent: "center" },
  shipMarker: {
    position: "absolute",
    width: 26,
    height: 26,
    marginLeft: -13,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  dates: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, marginTop: 14, paddingTop: 12 },
});
