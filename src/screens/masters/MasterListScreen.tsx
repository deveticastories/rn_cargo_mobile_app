/** Generic list for any master/operations module (Team, Customers, Stores, Pickup assign, …). */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, TextInput, View } from "react-native";
import { ChevronLeft, Plus, Search } from "lucide-react-native";
import { Badge, Card, IconButton, IconTile } from "@/components/primitives";
import { EmptyView, LoadingView, Notice, Screen } from "@/components/Screen";
import { Txt } from "@/components/Txt";
import { MASTERS } from "@/features/masters/config";
import { useRefresh } from "@/hooks/useBootstrapData";
import type { MoreScreenProps } from "@/navigation/types";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { deleteMaster, fetchMaster, toggleMasterStatus } from "@/store/slices/mastersSlice";
import { fonts, radius } from "@/theme/fonts";
import { useTheme } from "@/theme/ThemeProvider";
import type { BackendDoc } from "@/types";

export function MasterListScreen({ navigation, route }: MoreScreenProps<"MasterList">) {
  const t = useTheme();
  const dispatch = useAppDispatch();
  const def = MASTERS[route.params.masterKey];
  const entry = useAppSelector((s) => s.masters[def.key]);
  const mutatingId = useAppSelector((s) => s.masters.mutatingId);
  const [query, setQuery] = useState("");

  useEffect(() => {
    dispatch(fetchMaster(def.key));
    def.dependsOn?.forEach((k) => dispatch(fetchMaster(k)));
  }, [dispatch, def]);

  const load = useCallback(() => dispatch(fetchMaster(def.key)), [dispatch, def.key]);
  const { refreshing, onRefresh } = useRefresh(load);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...entry.items].sort((a, b) => (a._id < b._id ? 1 : -1));
    if (!q) return sorted;
    return sorted.filter((d) => `${def.primary(d)} ${def.secondary(d)}`.toLowerCase().includes(q));
  }, [entry.items, query, def]);

  const onToggle = (doc: BackendDoc) => {
    const next = doc.status === false;
    Alert.alert(`${next ? "Activate" : "Deactivate"} ${def.singular}?`, def.primary(doc), [
      { text: "Cancel", style: "cancel" },
      {
        text: next ? "Activate" : "Deactivate",
        onPress: async () => {
          const res = await dispatch(toggleMasterStatus({ key: def.key, id: doc._id, next }));
          if (toggleMasterStatus.rejected.match(res)) Alert.alert("Couldn't update", res.payload ?? "Please try again.");
        },
      },
    ]);
  };

  const onDelete = (doc: BackendDoc) =>
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
                    <Pressable onPress={() => onToggle(item)} hitSlop={6} accessibilityLabel="Toggle status">
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14 },
  search: { flexDirection: "row", alignItems: "center", gap: 10, height: 46, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: 14 },
  row: { flexDirection: "row", alignItems: "center", marginBottom: 10, paddingVertical: 12 },
});
