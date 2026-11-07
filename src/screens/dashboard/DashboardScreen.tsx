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
import { Avatar, Badge, Card, IconButton, IconTile, SectionTitle } from "@/components/primitives";
import { ReceiptRow } from "@/components/ReceiptRow";
import { Notice, Screen } from "@/components/Screen";
import { Txt } from "@/components/Txt";
import { useRefresh } from "@/hooks/useBootstrapData";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useCustomerLookup } from "@/hooks/useCustomerLookup";
import { useTabScrollReset } from "@/hooks/useTabScrollReset";
import type { TabScreenProps } from "@/navigation/types";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectFinanceMode, selectPickupMode } from "@/store/slices/authSlice";
import { cutOffLabel, selectBookingStats, selectBookingsSorted, selectNextContainer, selectReceiptRows, selectReceivables } from "@/store/selectors";
import { fetchBookings } from "@/store/slices/bookingsSlice";
import { fetchContainers } from "@/store/slices/containersSlice";
import { fetchFinance } from "@/store/slices/financeSlice";
import { fetchMaster } from "@/store/slices/mastersSlice";
import { pickupCollectedCount, pickupFullyCollected, pickupStarted } from "@/features/masters/config";
import { num, refField, str } from "@/services/mappers";
import type { Tone } from "@/theme/palette";
import { useTheme } from "@/theme/ThemeProvider";
import type { BackendDoc, Container } from "@/types";
import { daysFromToday, greeting, isSameMonth, longToday, money, monthLabel, shortDate } from "@/utils/format";

type IconType = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

export function DashboardScreen({ navigation }: TabScreenProps<"Home">) {
  const t = useTheme();
  const dispatch = useAppDispatch();
  const { name } = useCurrentUser();
  const stats = useAppSelector(selectBookingStats);
  const recent = useAppSelector(selectBookingsSorted).slice(0, 5);
  const bookingsState = useAppSelector((s) => s.bookings);
  const financeMode = useAppSelector(selectFinanceMode);
  const pickupMode = useAppSelector(selectPickupMode);
  const containers = useAppSelector((s) => s.containers.items);
  const expenses = useAppSelector((s) => s.finance.expenses);
  const team = useAppSelector((s) => s.masters.team.items);
  const nextContainer = useAppSelector(selectNextContainer);
  const receivables = useAppSelector(selectReceivables);
  const recentReceipts = useAppSelector(selectReceiptRows).slice(0, 5);
  const financeStatus = useAppSelector((s) => s.finance.status);
  const todayError = useAppSelector((s) => s.finance.error ?? s.containers.error);
  const { receiverCityParts } = useCustomerLookup();
  // Pickup role: the dashboard is about pickup assigns instead of bookings.
  const pickups = useAppSelector((s) => s.masters.pickupAssigns.items);
  const pickupStatus = useAppSelector((s) => s.masters.pickupAssigns.status);

  const load = useCallback(
    () =>
      pickupMode
        ? Promise.all([dispatch(fetchMaster("pickupAssigns")), dispatch(fetchFinance())])
        : Promise.all([
            dispatch(fetchBookings()),
            dispatch(fetchContainers()),
            dispatch(fetchFinance()),
            dispatch(fetchMaster("team")),
            dispatch(fetchMaster("customers")),
            dispatch(fetchMaster("pickupAssigns")),
          ]),
    [dispatch, pickupMode]
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

  const activePickups = pickups.filter((p) => p.status !== false);
  const fullyCollected = activePickups.filter(pickupFullyCollected).length;
  const partiallyCollected = activePickups.filter((p) => pickupStarted(p) && !pickupFullyCollected(p)).length;
  const collectedBundles = activePickups.reduce((sum, p) => sum + pickupCollectedCount(p), 0);
  // Newest first (Mongo ids start with their creation time).
  const recentPickups = [...activePickups].sort((a, b) => (b._id > a._id ? 1 : -1)).slice(0, 5);
  // Pickups not fully collected yet (pending or partial) light the bell.
  const openPickups = activePickups.filter((p) => !pickupFullyCollected(p)).length;
  const goPickups = () => navigation.navigate("Pickup");

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
          {/* Finance mode has no Bookings tab to open. */}
          <IconButton
            icon={Bell}
            dot={pickupMode ? openPickups > 0 : stats.counts.repacking > 0}
            accessibilityLabel={pickupMode ? "Pickups still to collect" : "Bookings needing repacking"}
            onPress={financeMode ? undefined : pickupMode ? goPickups : () => goBookings("packingList")}
          />
        </View>

        {bookingsState.error && <Notice message={bookingsState.error} onRetry={() => dispatch(fetchBookings())} />}

        {/* Hero metric */}
        <LinearGradient colors={t.heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <View style={styles.heroWatermark} pointerEvents="none">
            {/* Sized to the card — it's shorter without the status tiles — so the whole ship stays visible. */}
            <Ship size={financeMode ? 96 : 150} color="rgba(255,255,255,0.07)" strokeWidth={1.2} />
          </View>
          <View style={styles.rowBetween}>
            <Txt size={13} color="rgba(255,255,255,0.75)">
              {pickupMode ? "Total pickups" : "Total bookings"}
            </Txt>
            <Txt size={13} color="rgba(255,255,255,0.75)">
              {monthLabel()}
            </Txt>
          </View>
          <View style={styles.heroValue}>
            <Txt size={44} weight="bold" color="#FFFFFF" style={{ lineHeight: 50 }}>
              {pickupMode ? activePickups.length : stats.total}
            </Txt>
            {!pickupMode && stats.growth !== null && (
              <View style={styles.growth}>
                {stats.growth >= 0 ? <TrendingUp size={12} color="#FFFFFF" /> : <TrendingDown size={12} color="#FFFFFF" />}
                <Txt size={11.5} weight="semibold" color="#FFFFFF">
                  {Math.abs(stats.growth)}%
                </Txt>
              </View>
            )}
          </View>
          {/* Booking status tiles (hidden in finance mode) */}
          {pickupMode && (
            <View style={styles.heroTiles}>
              <HeroTile value={fullyCollected} label="Fully collected" onPress={goPickups} />
              <HeroTile value={partiallyCollected} label="Partially collected" onPress={goPickups} />
            </View>
          )}
          {!financeMode && !pickupMode && (
            <View style={styles.heroTiles}>
              <HeroTile value={stats.counts.repacking} label="Repacking" onPress={() => goBookings("packingList")} />
              <HeroTile value={readyTotal} label="Package ready" onPress={() => goBookings("readyToStuff")} />
              <HeroTile value={stuffedTotal} label="Stuffed" onPress={() => goBookings("stuffed")} />
            </View>
          )}
        </LinearGradient>

        {/* Quick actions (booking work — hidden in finance and pickup mode) */}
        {!financeMode && !pickupMode && (
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

        {/* Pipeline (hidden in finance and pickup mode) */}
        {!financeMode && !pickupMode && (
          <>
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
          </>
        )}

        {/* Today */}
        <SectionTitle title="Today" />
        {financeMode && todayError && <Notice message={todayError} onRetry={load} />}
        {pickupMode ? (
          <View style={styles.grid}>
            <TodayTile icon={Boxes} tone="success" value={String(collectedBundles)} label="Bundles collected" />
            <TodayTile icon={Wallet} tone="warning" value={money(monthExpense)} label="Expense logged" />
          </View>
        ) : (
        <View style={styles.grid}>
          {financeMode ? (
            <NextContainerTile container={nextContainer} />
          ) : (
            <TodayTile icon={Boxes} tone="success" value={String(stats.readyBundles)} label="Bundles ready" />
          )}
          <TodayTile icon={Ship} tone="purple" value={String(activeContainers)} label="Active containers" />
          {financeMode ? (
            <TodayTile icon={Wallet} tone="warning" value={money(receivables.total)} label="Total receivable" />
          ) : (
            <TodayTile icon={Wallet} tone="warning" value={money(monthExpense)} label="Expense logged" />
          )}
          {financeMode ? (
            <TodayTile icon={Wallet} tone="danger" value={money(receivables.outstanding)} label="Outstanding" />
          ) : (
            <TodayTile icon={Users} tone="purple" value={String(activeStaff)} label="Active staff" />
          )}
        </View>
        )}

        {/* Recent receipts (finance mode only) */}
        {financeMode && (
          <>
            <SectionTitle title="Recent receipts" action="See all" onAction={() => navigation.navigate("More", { screen: "Receipts", initial: false })} />
            <Card padded={false}>
              {recentReceipts.length === 0 ? (
                <Txt muted align="center" style={{ padding: 24 }}>
                  {financeStatus === "loading" ? "Loading receipts…" : "No receipts yet."}
                </Txt>
              ) : (
                recentReceipts.map((row, i) => <ReceiptRow key={row.receipt.id} row={row} last={i === recentReceipts.length - 1} />)
              )}
            </Card>
          </>
        )}

        {/* Recent pickups (pickup mode) */}
        {pickupMode && (
          <>
            <SectionTitle title="Recent pickups" action="See all" onAction={goPickups} />
            <Card padded={false}>
              {recentPickups.length === 0 ? (
                <Txt muted align="center" style={{ padding: 24 }}>
                  {pickupStatus === "loading" ? "Loading pickups…" : "No pickups yet."}
                </Txt>
              ) : (
                recentPickups.map((p, i) => <PickupRow key={p._id} pickup={p} last={i === recentPickups.length - 1} onPress={goPickups} />)
              )}
            </Card>
          </>
        )}

        {/* Recent (hidden in finance and pickup mode) */}
        {!financeMode && !pickupMode && (
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
                    city={receiverCityParts(b)}
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

function PickupRow({ pickup: p, last, onPress }: { pickup: BackendDoc; last?: boolean; onPress: () => void }) {
  const t = useTheme();
  const assigned = num(p.bundleCount);
  const collected = pickupCollectedCount(p);
  const status = pickupFullyCollected(p)
    ? { label: "Fully collected", tone: "success" as const }
    : pickupStarted(p)
      ? { label: "Partially collected", tone: "info" as const }
      : { label: "Pending", tone: "warning" as const };
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pickupRow,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: t.border },
        pressed && { backgroundColor: t.surfaceAlt },
      ]}
    >
      <IconTile icon={Truck} tone={status.tone} size={40} />
      <View style={{ flex: 1, marginHorizontal: 12 }}>
        <Txt size={14.5} weight="bold" numberOfLines={1}>
          LR {str(p.lrNo)}
        </Txt>
        <Txt size={12} muted numberOfLines={1} style={{ marginTop: 2 }}>
          {[str(refField(p.transport, "name")), `${collected}/${assigned} bundles`].filter(Boolean).join(" · ")}
        </Txt>
      </View>
      <Badge label={status.label} tone={status.tone} size="sm" />
    </Pressable>
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

function NextContainerTile({ container }: { container?: Container }) {
  const t = useTheme();
  const toCutoff = daysFromToday(container?.cutOffDate);
  const urgent = toCutoff !== null && toCutoff <= 3;
  return (
    <Card style={styles.todayTile}>
      <IconTile icon={Boxes} tone="success" size={34} />
      <Txt size={12} muted style={{ marginTop: 14 }}>
        Next to complete
      </Txt>
      {container ? (
        <>
          <Txt size={18} weight="bold" numberOfLines={1} adjustsFontSizeToFit>
            {container.code}
          </Txt>
          {!!container.company && (
            <Txt size={12} muted numberOfLines={1}>
              {container.company}
            </Txt>
          )}
          <Txt size={12} weight="semibold" color={urgent ? t.tones.danger.fg : t.text} style={{ marginTop: 6 }}>
            {cutOffLabel(toCutoff)}
          </Txt>
          {!!container.cutOffDate && (
            <Txt size={12} muted>
              Cut-off {shortDate(container.cutOffDate)}
            </Txt>
          )}
          <Txt size={12} muted>
            ETD {shortDate(container.etdCok)}
          </Txt>
        </>
      ) : (
        <Txt size={14} weight="semibold" style={{ marginTop: 2 }}>
          None waiting
        </Txt>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  header: { flexDirection: "row", alignItems: "center", paddingTop: 8, paddingBottom: 18 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  hero: { borderRadius: 24, padding: 18, overflow: "hidden" },
  heroWatermark: { position: "absolute", right: 14, top: 0, bottom: 0, justifyContent: "center" },
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
  pickupRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 14 },
});
