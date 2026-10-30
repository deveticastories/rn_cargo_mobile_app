/** Generic list for any master/operations module (Team, Customers, Stores, Pickup assign, …). */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, TextInput, View } from "react-native";
import { CheckCircle2, ChevronLeft, PackageCheck, Plus, Power, PowerOff, Search } from "lucide-react-native";
import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Badge, Card, IconButton, IconTile } from "@/components/primitives";
import { EmptyView, LoadingView, Notice, Screen } from "@/components/Screen";
import { Txt } from "@/components/Txt";
import { TextField } from "@/components/TextField";
import { MASTERS, pickupFullyCollected } from "@/features/masters/config";
import { useRefresh } from "@/hooks/useBootstrapData";
import type { MoreScreenProps } from "@/navigation/types";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { deleteMaster, fetchMaster, recordPickupCollected, toggleMasterStatus } from "@/store/slices/mastersSlice";
import { ensureMaster } from "@/store/ensure";
import { fonts, radius } from "@/theme/fonts";
import { useTheme } from "@/theme/ThemeProvider";
import type { BackendDoc } from "@/types";
import { num, refField, str } from "@/services/mappers";
import { money } from "@/utils/format";

export function MasterListScreen({ navigation, route }: MoreScreenProps<"MasterList">) {
  const t = useTheme();
  const dispatch = useAppDispatch();
  const def = MASTERS[route.params.masterKey];
  const entry = useAppSelector((s) => s.masters[def.key]);
  const mutatingId = useAppSelector((s) => s.masters.mutatingId);
  const [query, setQuery] = useState("");
  // The record whose Active / Inactive switch is waiting for confirmation.
  const [toggling, setToggling] = useState<BackendDoc | null>(null);
  const [toggleBusy, setToggleBusy] = useState(false);
  // Pickup assigns: the pickup whose collected bundles are being recorded (web console's "Mark as collected").
  const [collecting, setCollecting] = useState<BackendDoc | null>(null);
  const [collected, setCollected] = useState("");
  const [collectError, setCollectError] = useState<string | null>(null);
  const [collectBusy, setCollectBusy] = useState(false);

  useEffect(() => {
    dispatch(ensureMaster(def.key));
    def.dependsOn?.forEach((k) => dispatch(ensureMaster(k)));
  }, [dispatch, def]);

  const load = useCallback(() => dispatch(fetchMaster(def.key)), [dispatch, def.key]);
  const { refreshing, onRefresh } = useRefresh(load);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...entry.items].sort((a, b) => (a._id < b._id ? 1 : -1));
    if (!q) return sorted;
    return sorted.filter((d) => `${def.primary(d)} ${def.secondary(d)}`.toLowerCase().includes(q));
  }, [entry.items, query, def]);

  const activating = toggling?.status === false;
  const confirmToggle = async () => {
    if (!toggling) return;
    setToggleBusy(true);
    const res = await dispatch(toggleMasterStatus({ key: def.key, id: toggling._id, next: activating }));
    setToggleBusy(false);
    setToggling(null);
    if (toggleMasterStatus.rejected.match(res)) Alert.alert("Couldn't update", res.payload ?? "Please try again.");
  };

  const openCollect = (doc: BackendDoc) => {
    if (pickupFullyCollected(doc)) return;
    setCollecting(doc);
    setCollected(doc.pickupStatus === "Collected" && doc.collectedBundle ? String(doc.collectedBundle) : "");
    setCollectError(null);
  };
  const assigned = Number(collecting?.bundleCount ?? 0);
  const submitCollect = async () => {
    if (!collecting) return;
    const n = Number(collected);
    if (!collected || !(n > 0)) return setCollectError("Enter how many bundles were collected.");
    if (n > assigned) return setCollectError(`Collected bundle can't be more than the ${assigned} bundles assigned.`);
    setCollectBusy(true);
    const res = await dispatch(recordPickupCollected({ id: collecting._id, collectedBundle: n }));
    setCollectBusy(false);
    if (recordPickupCollected.rejected.match(res)) setCollectError(res.payload ?? "Failed to save.");
    else setCollecting(null);
  };

  const onDelete = (doc: BackendDoc) => {
    if (def.canDelete && !def.canDelete(doc)) return Alert.alert(`Can't delete this ${def.singular}`, "Collected pickups can't be deleted.");
    Alert.alert(`Delete ${def.singular}?`, `${def.primary(doc)} will be removed permanently.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const res = await dispatch(deleteMaster({ key: def.key, id: doc._id }));
          if (deleteMaster.rejected.match(res)) Alert.alert("Couldn't delete", res.payload ?? "Please try again.");
        },
      },
    ]);
  };

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} accessibilityLabel="Back" />
        <Txt size={24} weight="bold" style={{ flex: 1, marginLeft: 12 }} numberOfLines={1}>
          {def.title}
        </Txt>
        <IconButton icon={Plus} filled onPress={() => navigation.navigate("MasterForm", { masterKey: def.key })} accessibilityLabel={`New ${def.singular}`} />
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
          ListEmptyComponent={<EmptyView title={`No ${def.title.toLowerCase()} yet`} message={`Tap + to add a ${def.singular}.`} />}
          renderItem={({ item }) => {
            if (def.key === "pickupAssigns") {
              return (
                <PickupAssignRow
                  doc={item}
                  busy={mutatingId === item._id}
                  onEdit={() => navigation.navigate("MasterForm", { masterKey: def.key, id: item._id })}
                  onDelete={() => onDelete(item)}
                  onCollect={() => openCollect(item)}
                  onToggleStatus={() => setToggling(item)}
                />
              );
            }
            const extra = def.badge?.(item);
            return (
              <Card
                onPress={() => navigation.navigate("MasterForm", { masterKey: def.key, id: item._id })}
                onLongPress={() => onDelete(item)}
                style={[styles.row, mutatingId === item._id && { opacity: 0.5 }]}
              >
                <IconTile icon={def.icon} tone={def.tone} size={40} />
                <View style={{ flex: 1, marginHorizontal: 12 }}>
                  <Txt size={15} weight="bold" numberOfLines={1}>
                    {def.primary(item) || "—"}
                  </Txt>
                  <Txt size={12.5} muted numberOfLines={1} style={{ marginTop: 2 }}>
                    {def.secondary(item) || " "}
                  </Txt>
                </View>
                <View style={{ alignItems: "flex-end", gap: 6 }}>
                  {extra && <Badge label={extra.label} tone={extra.tone} size="sm" />}
                  {def.hasStatus && (
                    <Pressable onPress={() => setToggling(item)} hitSlop={6} accessibilityLabel="Toggle status">
                      <Badge label={item.status === false ? "Inactive" : "Active"} tone={item.status === false ? "neutral" : "success"} size="sm" />
                    </Pressable>
                  )}
                </View>
              </Card>
            );
          }}
        />
      )}
      <Txt size={11.5} soft align="center" style={{ paddingBottom: 10 }}>
        Tap to edit · long-press to delete{def.hasStatus ? " · tap status to toggle" : ""}
      </Txt>

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
          collecting?.pickupStatus === "Collected"
            ? `Edit collected bundle — LR ${String(collecting?.lrNo ?? "")}`
            : `Mark LR ${String(collecting?.lrNo ?? "")} as collected`
        }
        confirmLabel="Submit"
        loading={collectBusy}
        onConfirm={submitCollect}
        onCancel={() => setCollecting(null)}
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
                error={collectError}
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
  onDelete,
  onCollect,
  onToggleStatus,
}: {
  doc: BackendDoc;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onCollect: () => void;
  onToggleStatus: () => void;
}) {
  const t = useTheme();
  const assigned = num(doc.bundleCount);
  const collected = doc.pickupStatus === "Collected" ? num(doc.collectedBundle) : 0;
  const balance = Math.max(0, assigned - collected);
  const done = pickupFullyCollected(doc);
  const pending = doc.pickupStatus !== "Collected";
  const paid = doc.paymentStatus === "Paid";
  return (
    <Card onPress={onEdit} onLongPress={onDelete} style={[{ marginBottom: 12 }, busy && { opacity: 0.5 }]}>
      <View style={styles.pickupTop}>
        <IconTile icon={MASTERS.pickupAssigns.icon} tone="info" size={40} />
        <View style={{ flex: 1, marginHorizontal: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Txt size={15} weight="bold" numberOfLines={1} style={{ flexShrink: 1 }}>
              LR {str(doc.lrNo) || "—"}
            </Txt>
            <Badge label={pending ? "Pending" : "Collected"} tone={pending ? "warning" : "success"} size="sm" />
          </View>
          <Txt size={12.5} muted numberOfLines={1} style={{ marginTop: 2 }}>
            {[str(refField(doc.transport, "name")), money(num(doc.amount))].filter(Boolean).join(" · ")}
          </Txt>
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
        <PickupStat label="Collected" value={pending ? "—" : String(collected)} tone={pending ? undefined : t.tones.success.fg} />
        <PickupStat label="Balance" value={pending ? "—" : String(balance)} tone={!pending && balance > 0 ? t.tones.warning.fg : undefined} />
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
