/** 02 · Dashboard — hero metric, quick actions, shipment pipeline, today tiles, recent activity. */
import React, { useCallback, useRef } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowLeftRight,
  Bell,
  Boxes,
  ClipboardList,
  FileText,
  Ship,
  TrendingDown,
  TrendingUp,
  Truck,
  Users,
  Wallet,
} from "lucide-react-native";
import { BookingRow } from "@/components/BookingViews";
import { Avatar, Card, IconButton, IconTile, SectionTitle } from "@/components/primitives";
import { Notice, Screen } from "@/components/Screen";
import { Txt } from "@/components/Txt";
import { useRefresh } from "@/hooks/useBootstrapData";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useCustomerLookup } from "@/hooks/useCustomerLookup";
import { useTabScrollReset } from "@/hooks/useTabScrollReset";
import type { TabScreenProps } from "@/navigation/types";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectFinanceMode } from "@/store/slices/authSlice";
import { selectBookingStats, selectBookingsSorted } from "@/store/selectors";
import { fetchBookings } from "@/store/slices/bookingsSlice";
import { fetchContainers } from "@/store/slices/containersSlice";
import { fetchFinance } from "@/store/slices/financeSlice";
import { fetchMaster } from "@/store/slices/mastersSlice";
import type { Tone } from "@/theme/palette";
import { useTheme } from "@/theme/ThemeProvider";
import { greeting, isSameMonth, longToday, money, monthLabel } from "@/utils/format";

type IconType = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

export function DashboardScreen({ navigation }: TabScreenProps<"Home">) {
  const t = useTheme();
  const dispatch = useAppDispatch();
  const { name } = useCurrentUser();
  const stats = useAppSelector(selectBookingStats);
  const recent = useAppSelector(selectBookingsSorted).slice(0, 5);
  const bookingsState = useAppSelector((s) => s.bookings);
  const financeMode = useAppSelector(selectFinanceMode);
  const containers = useAppSelector((s) => s.containers.items);
  const expenses = useAppSelector((s) => s.finance.expenses);
  const team = useAppSelector((s) => s.masters.team.items);
  const { receiverCity } = useCustomerLookup();

  const load = useCallback(
    () =>
      Promise.all([
        dispatch(fetchBookings()),
        dispatch(fetchContainers()),
        dispatch(fetchFinance()),
        dispatch(fetchMaster("team")),
        dispatch(fetchMaster("customers")),
      ]),
    [dispatch]
  );
  const { refreshing, onRefresh } = useRefresh(load);
  const scrollRef = useRef<ScrollView>(null);
  useTabScrollReset(scrollRef);

  const activeContainers = containers.filter((c) => c.status === "Active").length;
  const monthExpense = expenses.filter((e) => isSameMonth(e.date)).reduce((s, e) => s + e.amount, 0);
  const activeStaff = team.filter((e) => e.status !== false).length;
  const stuffedTotal = stats.counts.stuffed;
  const readyTotal = stats.counts.ready + stats.counts.readyToStuff;
  const pipelineTotal = Math.max(1, stats.total);

  const goBookings = (filter?: "packingList" | "readyToStuff" | "stuffed") => navigation.navigate("Bookings", { filter: filter ?? "all" });

  return (
    <Screen>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting */}
        <View style={styles.header}>
          <Avatar name={name} size={44} tone="info" />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Txt size={13} muted>
              {longToday()}
            </Txt>
            <Txt size={22} weight="bold" style={{ marginTop: 2 }}>
              {greeting()},{"\n"}
              {name.split(" ")[0]}
            </Txt>
          </View>
          <IconButton
            icon={Bell}
            dot={stats.counts.repacking > 0}
            accessibilityLabel="Bookings needing repacking"
            onPress={() => goBookings("packingList")}
          />
        </View>

        {bookingsState.error && <Notice message={bookingsState.error} onRetry={() => dispatch(fetchBookings())} />}

        {/* Hero metric */}
        <LinearGradient colors={t.heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <View style={styles.heroWatermark} pointerEvents="none">
            <Ship size={150} color="rgba(255,255,255,0.07)" strokeWidth={1.2} />
          </View>
          <View style={styles.rowBetween}>
            <Txt size={13} color="rgba(255,255,255,0.75)">
              Total bookings
            </Txt>
            <Txt size={13} color="rgba(255,255,255,0.75)">
              {monthLabel()}
            </Txt>
          </View>
          <View style={styles.heroValue}>
            <Txt size={44} weight="bold" color="#FFFFFF" style={{ lineHeight: 50 }}>
              {stats.total}
            </Txt>
            {stats.growth !== null && (
              <View style={styles.growth}>
                {stats.growth >= 0 ? <TrendingUp size={12} color="#FFFFFF" /> : <TrendingDown size={12} color="#FFFFFF" />}
                <Txt size={11.5} weight="semibold" color="#FFFFFF">
                  {Math.abs(stats.growth)}%
                </Txt>
              </View>
            )}
          </View>
          <View style={styles.heroTiles}>
            <HeroTile value={stats.counts.repacking} label="Repacking" onPress={() => goBookings("packingList")} />
            <HeroTile value={readyTotal} label="Package ready" onPress={() => goBookings("readyToStuff")} />
            <HeroTile value={stuffedTotal} label="Stuffed" onPress={() => goBookings("stuffed")} />
          </View>
        </LinearGradient>

        {/* Quick actions (booking work — hidden in finance mode) */}
        {!financeMode && (
          <View style={styles.quick}>
            <QuickAction icon={ClipboardList} label={"New\nbooking"} tone="info" onPress={() => navigation.navigate("NewBooking")} />
            <QuickAction
              icon={Truck}
              label="Pickup"
              tone="success"
              onPress={() => navigation.navigate("More", { screen: "MasterList", params: { masterKey: "pickupAssigns" }, initial: false })}
            />
            <QuickAction icon={ArrowLeftRight} label="Stuffing" tone="purple" onPress={() => navigation.navigate("Stuffing")} />
            <QuickAction
              icon={FileText}
              label="Invoice"
              tone="warning"
              onPress={() => navigation.navigate("More", { screen: "Finance", params: { tab: "invoices" }, initial: false })}
            />
          </View>
        )}

        {/* Pipeline */}
        <SectionTitle title="Shipment pipeline" action="Details" onAction={() => goBookings()} />
        <Card>
          <View style={styles.rowBetween}>
            <Txt size={13} muted>
              Where every booking stands
            </Txt>
            <Txt size={11.5} mono muted>
              {stats.total} total
            </Txt>
          </View>
          <View style={styles.pipeline}>
            {[
              { n: stats.counts.repacking, color: t.tones.warning.fg },
              { n: readyTotal, color: t.primary },
              { n: stuffedTotal, color: t.tones.purple.fg },
            ].map((seg, i) =>
              seg.n > 0 ? <View key={i} style={{ flex: seg.n / pipelineTotal, backgroundColor: seg.color, borderRadius: 4, height: 10 }} /> : null
            )}
            {stats.total === 0 && <View style={{ flex: 1, height: 10, borderRadius: 4, backgroundColor: t.surfaceAlt }} />}
          </View>
          <View style={styles.legend}>
            <Legend color={t.tones.warning.fg} label="Repacking" value={stats.counts.repacking} />
            <Legend color={t.primary} label="Ready" value={readyTotal} />
            <Legend color={t.tones.purple.fg} label="Stuffed" value={stuffedTotal} />
          </View>
        </Card>

        {/* Today */}
        <SectionTitle title="Today" />
        <View style={styles.grid}>
          <TodayTile icon={Boxes} tone="success" value={String(stats.readyBundles)} label="Bundles ready" />
          <TodayTile icon={Ship} tone="purple" value={String(activeContainers)} label="Active containers" />
          <TodayTile icon={Wallet} tone="warning" value={money(monthExpense)} label="Expense logged" />
          <TodayTile icon={Users} tone="purple" value={String(activeStaff)} label="Active staff" />
        </View>

        {/* Recent (hidden in finance mode) */}
        {!financeMode && (
          <>
            <SectionTitle title="Recent bookings" action="See all" onAction={() => goBookings()} />
            <Card padded={false}>
              {recent.length === 0 ? (
                <Txt muted align="center" style={{ padding: 24 }}>
                  {bookingsState.status === "loading" ? "Loading bookings…" : "No bookings yet."}
                </Txt>
              ) : (
                recent.map((b, i) => (
                  <BookingRow
                    key={b.id}
                    booking={b}
                    city={receiverCity(b)}
                    last={i === recent.length - 1}
                    onPress={() => navigation.navigate("BookingDetail", { id: b.id })}
                  />
                ))
              )}
            </Card>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function HeroTile({ value, label, onPress }: { value: number; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.heroTile, pressed && { opacity: 0.8 }]}>
      <Txt size={20} weight="bold" color="#FFFFFF">
        {value}
      </Txt>
      <Txt size={11.5} color="rgba(255,255,255,0.75)" style={{ marginTop: 4 }}>
        {label}
      </Txt>
    </Pressable>
  );
}

function QuickAction({ icon: Icon, label, tone, onPress }: { icon: IconType; label: string; tone: Tone; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.quickItem, pressed && { opacity: 0.7 }]} accessibilityRole="button">
      <View style={[styles.quickIcon, { backgroundColor: t.surface, borderColor: t.border }]}>
        <Icon size={22} color={t.tones[tone].fg} strokeWidth={1.8} />
      </View>
      <Txt size={11.5} weight="medium" align="center" style={{ marginTop: 6 }}>
        {label}
      </Txt>
    </Pressable>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />
        <Txt size={12} muted>
          {label}
        </Txt>
      </View>
      <Txt size={20} weight="bold" style={{ marginTop: 2 }}>
        {value}
      </Txt>
    </View>
  );
}

function TodayTile({ icon, tone, value, label }: { icon: IconType; tone: Tone; value: string; label: string }) {
  return (
    <Card style={styles.todayTile}>
      <IconTile icon={icon} tone={tone} size={34} />
      <Txt size={22} weight="bold" style={{ marginTop: 14 }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Txt>
      <Txt size={12} muted>
        {label}
      </Txt>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  header: { flexDirection: "row", alignItems: "center", paddingTop: 8, paddingBottom: 18 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  hero: { borderRadius: 24, padding: 18, overflow: "hidden" },
  heroWatermark: { position: "absolute", right: -18, top: 6 },
  heroValue: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  growth: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.14)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  heroTiles: { flexDirection: "row", gap: 10, marginTop: 16 },
  heroTile: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.09)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  quick: { flexDirection: "row", justifyContent: "space-between", marginTop: 20 },
  quickItem: { flex: 1, alignItems: "center" },
  quickIcon: { width: 58, height: 58, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  pipeline: { flexDirection: "row", gap: 4, marginTop: 14 },
  legend: { flexDirection: "row", marginTop: 14 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 12 },
  todayTile: { width: "48.3%" },
});
