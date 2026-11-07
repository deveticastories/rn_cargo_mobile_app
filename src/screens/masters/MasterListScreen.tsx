/** Generic list for any master/operations module (Team, Customers, Stores, Pickup assign, …). */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, TextInput, View } from "react-native";
import { CheckCircle2, ChevronLeft, PackageCheck, Plus, Power, PowerOff, Search } from "lucide-react-native";
import { showError } from "@/components/AppAlert";
import { showErrorToast } from "@/components/AppToast";
import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Badge, Card, IconButton, IconTile } from "@/components/primitives";
import { EmptyView, LoadingView, Notice, Screen } from "@/components/Screen";
import { PlaceSegs } from "@/components/Place";
import { Txt } from "@/components/Txt";
import { TextField } from "@/components/TextField";
import { MASTERS, isActive, pickupCollectedCount, pickupFullyCollected, pickupStarted, type MasterKey } from "@/features/masters/config";
import { useRefresh } from "@/hooks/useBootstrapData";
import { useNavigation, type NavigationProp } from "@react-navigation/native";
import type { MoreScreenProps, RootStackParamList } from "@/navigation/types";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchMaster, recordPickupCollected, toggleMasterStatus } from "@/store/slices/mastersSlice";
import { ensureMaster } from "@/store/ensure";
import { fonts, radius } from "@/theme/fonts";
import { useTheme } from "@/theme/ThemeProvider";
import type { BackendDoc } from "@/types";
import { num, refField, str } from "@/services/mappers";
import { money, shortDate } from "@/utils/format";

export function MasterListScreen({ navigation, route }: MoreScreenProps<"MasterList">) {
  return <MasterListView masterKey={route.params.masterKey} onBack={() => navigation.goBack()} />;
}

/** Pickup role's Pickup tab. */
export function PickupTabScreen() {
  // New pickups come from the tab bar's + menu.
  return <MasterListView masterKey="pickupAssigns" noAdd />;
}

/** Pickup role's Pre-book tab. */
export function PreBookingsTabScreen() {
  return <MasterListView masterKey="preBookings" />;
}

/** The list itself; `onBack` adds the back button (absent when it's a tab). */
function MasterListView({ masterKey, onBack, noAdd }: { masterKey: MasterKey; onBack?: () => void; noAdd?: boolean }) {
  const t = useTheme();
  const dispatch = useAppDispatch();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const def = MASTERS[masterKey];
  const entry = useAppSelector((s) => s.masters[def.key]);
  const mutatingId = useAppSelector((s) => s.masters.mutatingId);
  const [query, setQuery] = useState("");
  // The record whose Active / Inactive switch is waiting for confirmation.
  const [toggling, setToggling] = useState<BackendDoc | null>(null);
  const [toggleBusy, setToggleBusy] = useState(false);
  // Pickup assigns: the pickup whose collected bundles are being recorded (web console's "Mark as collected").
  const [collecting, setCollecting] = useState<BackendDoc | null>(null);
  const [collected, setCollected] = useState("");
  const [collectBusy, setCollectBusy] = useState(false);

  useEffect(() => {
    dispatch(ensureMaster(def.key));
    def.dependsOn?.forEach((k) => dispatch(ensureMaster(k)));
  }, [dispatch, def]);

  const load = useCallback(
    () => Promise.all([dispatch(fetchMaster(def.key)), ...(def.dependsOn ?? []).map((k) => dispatch(fetchMaster(k)))]),
    [dispatch, def]
  );
  const { refreshing, onRefresh } = useRefresh(load);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...entry.items].sort((a, b) => (a._id < b._id ? 1 : -1));
    if (!q) return sorted;
    return sorted.filter((d) => `${def.primary(d)} ${def.secondary(d)}`.toLowerCase().includes(q));
  }, [entry.items, query, def]);

  const activating = toggling !== null && !isActive(def, toggling);
  const confirmToggle = async () => {
    if (!toggling) return;
    setToggleBusy(true);
    const res = await dispatch(toggleMasterStatus({ key: def.key, id: toggling._id, next: activating }));
    setToggleBusy(false);
    setToggling(null);
    if (toggleMasterStatus.rejected.match(res)) showError("Couldn't update", res.payload ?? "Please try again.");
  };

  const openCollect = (doc: BackendDoc) => {
    if (pickupFullyCollected(doc)) return;
    setCollecting(doc);
    setCollected(pickupCollectedCount(doc) ? String(pickupCollectedCount(doc)) : "");
  };
  const assigned = Number(collecting?.bundleCount ?? 0);
  const submitCollect = async () => {
    if (!collecting) return;
    const n = Number(collected);
    if (!collected || !(n > 0)) return showErrorToast("Can't save", "Enter how many bundles were collected.");
    if (n > assigned) return showErrorToast("Can't save", `Collected bundle can't be more than the ${assigned} bundles assigned.`);
    setCollectBusy(true);
    const res = await dispatch(recordPickupCollected({ id: collecting._id, collectedBundle: n }));
    setCollectBusy(false);
    if (recordPickupCollected.rejected.match(res)) showErrorToast("Couldn't save the collected bundles", res.payload ?? "Please try again.");
    else setCollecting(null);
  };

  return (
    <Screen>
      <View style={styles.header}>
        {onBack && <IconButton icon={ChevronLeft} onPress={onBack} accessibilityLabel="Back" />}
        <Txt size={24} weight="bold" style={{ flex: 1, marginLeft: onBack ? 12 : 0 }} numberOfLines={1}>
          {def.title}
        </Txt>
        {!def.noListAdd && !noAdd && (
          <IconButton icon={Plus} filled onPress={() => navigation.navigate("MasterForm", { masterKey: def.key })} accessibilityLabel={`New ${def.singular}`} />
        )}
      </View>

      <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
        <View style={[styles.search, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Search size={17} color={t.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={`Search ${def.title.toLowerCase()}`}
            placeholderTextColor={t.textSoft}
            style={{ flex: 1, color: t.text, fontFamily: fonts.medium, fontSize: 15 }}
            autoCorrect={false}
          />
        </View>
      </View>

      {entry.status === "loading" && entry.items.length === 0 ? (
        <LoadingView />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(d) => d._id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 30, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} />}
          ListHeaderComponent={entry.error ? <Notice message={entry.error} onRetry={() => dispatch(fetchMaster(def.key))} /> : null}
          ListEmptyComponent={<EmptyView title={`No ${def.title.toLowerCase()} yet`} message={def.noListAdd || noAdd ? `Use the + button below to add a ${def.singular}.` : `Tap + to add a ${def.singular}.`} />}
          renderItem={({ item }) => {
            if (def.key === "pickupAssigns") {
              return (
                <PickupAssignRow
                  doc={item}
                  busy={mutatingId === item._id}
                  onEdit={() => navigation.navigate("MasterForm", { masterKey: def.key, id: item._id })}
                  onCollect={() => openCollect(item)}
                  onToggleStatus={() => setToggling(item)}
                />
              );
            }
            const extra = def.badge?.(item);
            return (
              <Card
                onPress={() => navigation.navigate("MasterForm", { masterKey: def.key, id: item._id })}
                style={[styles.row, mutatingId === item._id && { opacity: 0.5 }]}
              >
                <IconTile icon={def.icon} tone={def.tone} size={40} />
                <View style={{ flex: 1, marginHorizontal: 12 }}>
                  <Txt size={15} weight="bold" numberOfLines={1}>
                    {def.primarySegs ? <PlaceSegs segs={def.primarySegs(item)} /> : def.primary(item) || "—"}
                  </Txt>
                  <Txt size={12.5} muted numberOfLines={1} style={{ marginTop: 2 }}>
                    {def.secondarySegs ? <PlaceSegs segs={def.secondarySegs(item)} /> : def.secondary(item) || " "}
                  </Txt>
                </View>
                <View style={{ alignItems: "flex-end", gap: 6 }}>
                  {extra && <Badge label={extra.label} tone={extra.tone} size="sm" />}
                  {def.hasStatus && (
                    <Pressable onPress={() => setToggling(item)} hitSlop={6} accessibilityLabel="Toggle status">
                      <Badge label={isActive(def, item) ? "Active" : "Inactive"} tone={isActive(def, item) ? "success" : "neutral"} size="sm" />
                    </Pressable>
                  )}
                </View>
              </Card>
            );
          }}
        />
      )}

      <ConfirmDialog
        visible={toggling !== null}
        icon={activating ? Power : PowerOff}
        tone={activating ? "success" : "warning"}
        title={`${activating ? "Activate" : "Deactivate"} ${def.singular}?`}
        message={
          toggling
            ? `${def.primary(toggling) || `This ${def.singular}`} will be marked ${activating ? "Active" : "Inactive"}.`
            : undefined
        }
        confirmLabel="Confirm"
        loading={toggleBusy}
        onConfirm={confirmToggle}
        onCancel={() => setToggling(null)}
      />

      <ConfirmDialog
        visible={collecting !== null}
        icon={PackageCheck}
        tone="success"
        title={
          collecting && pickupStarted(collecting)
            ? `Edit collected bundle — LR ${String(collecting?.lrNo ?? "")}`
            : `Mark LR ${String(collecting?.lrNo ?? "")} as collected`
        }
        confirmLabel="Submit"
        loading={collectBusy}
        onConfirm={submitCollect}
        onCancel={() => setCollecting(null)}
        toasts
      >
        <View style={{ alignSelf: "stretch" }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <TextField
                label="Collected bundle"
                value={collected}
                onChangeText={(v) => setCollected(v.replace(/\D/g, ""))}
                keyboardType="number-pad"
                placeholder="0"
              />
            </View>
            {/* Most pickups collect everything — one tap fills the assigned count. */}
            <Button title={`All ${assigned}`} variant="secondary" height={50} onPress={() => setCollected(String(assigned))} style={{ marginTop: 26 }} />
          </View>
          <Txt size={12.5} muted align="center" style={{ marginBottom: 6 }}>
            Assigned: {assigned} · Balance: {Math.max(0, assigned - (Number(collected) || 0))}
          </Txt>
        </View>
      </ConfirmDialog>
    </Screen>
  );
}

/**
 * Pickup assign card, laid out like the web console's columns: LR + transport, the
 * bundle numbers (assigned / collected / balance), and the next step as a button.
 */
function PickupAssignRow({
  doc,
  busy,
  onEdit,
  onCollect,
  onToggleStatus,
}: {
  doc: BackendDoc;
  busy: boolean;
  onEdit: () => void;
  onCollect: () => void;
  onToggleStatus: () => void;
}) {
  const t = useTheme();
  const assigned = num(doc.bundleCount);
  const collected = pickupCollectedCount(doc);
  const balance = Math.max(0, assigned - collected);
  const done = pickupFullyCollected(doc);
  const pending = !pickupStarted(doc);
  const paid = doc.paymentStatus === "Paid";
  // Extra details from GET /pickup-assigns, shown only when the server sends them.
  const phone = str(refField(doc.transport, "whatsapp")) || str(refField(doc.transport, "phone"));
  const date = str(doc.date || doc.createdAt);
  const details = [date && shortDate(date), phone].filter(Boolean).join(" · ");
  return (
    <Card onPress={onEdit} style={[{ marginBottom: 12 }, busy && { opacity: 0.5 }]}>
      <View style={styles.pickupTop}>
        <IconTile icon={MASTERS.pickupAssigns.icon} tone="info" size={40} />
        <View style={{ flex: 1, marginHorizontal: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Txt size={15} weight="bold" numberOfLines={1} style={{ flexShrink: 1 }}>
              LR {str(doc.lrNo) || "—"}
            </Txt>
            <Badge
              label={pending ? "Pending" : done ? "Collected" : "Partially collected"}
              tone={pending ? "warning" : done ? "success" : "info"}
              size="sm"
            />
          </View>
          <Txt size={12.5} muted numberOfLines={1} style={{ marginTop: 2 }}>
            {[str(refField(doc.transport, "name")), money(num(doc.amount))].filter(Boolean).join(" · ")}
          </Txt>
          {details ? (
            <Txt size={12} muted numberOfLines={1} style={{ marginTop: 2 }}>
              {details}
            </Txt>
          ) : null}
        </View>
        <View style={{ alignItems: "flex-end", gap: 6 }}>
          <Badge label={paid ? "Paid" : "Unpaid"} tone={paid ? "success" : "danger"} size="sm" />
          <Pressable onPress={onToggleStatus} hitSlop={6} accessibilityLabel="Toggle status">
            <Badge label={doc.status === false ? "Inactive" : "Active"} tone={doc.status === false ? "neutral" : "success"} size="sm" />
          </Pressable>
        </View>
      </View>

      <View style={[styles.pickupStats, { borderColor: t.border }]}>
        <PickupStat label="Bundles" value={String(assigned)} />
        <PickupStat label="Collected" value={String(collected)} tone={collected > 0 ? t.tones.success.fg : undefined} />
        <PickupStat label="Balance" value={String(balance)} tone={balance > 0 ? t.tones.warning.fg : undefined} />
      </View>

      {done ? (
        <View style={[styles.pickupDone, { backgroundColor: t.tones.success.bg }]}>
          <CheckCircle2 size={16} color={t.tones.success.fg} />
          <Txt size={13.5} weight="semibold" color={t.tones.success.fg}>
            All bundles collected
          </Txt>
        </View>
      ) : (
        <Button
          title={pending ? "Bundle collected" : "Update bundle collected"}
          icon={PackageCheck}
          variant={pending ? "primary" : "secondary"}
          height={44}
          onPress={onCollect}
        />
      )}
    </Card>
  );
}

function PickupStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Txt size={11} muted uppercase weight="semibold">
        {label}
      </Txt>
      <Txt size={18} weight="bold" color={tone} style={{ marginTop: 2 }}>
        {value}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  pickupTop: { flexDirection: "row", alignItems: "center" },
  pickupStats: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth * 2, borderBottomWidth: StyleSheet.hairlineWidth * 2, paddingVertical: 10, marginVertical: 12 },
  pickupDone: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 44, borderRadius: radius.md },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14 },
  search: { flexDirection: "row", alignItems: "center", gap: 10, height: 46, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: 14 },
  row: { flexDirection: "row", alignItems: "center", marginBottom: 10, paddingVertical: 12 },
});
