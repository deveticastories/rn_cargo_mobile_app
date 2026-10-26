/** Generic create/edit form for any master/operations module, driven by `MASTERS` config. */
import React, { useEffect, useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, Trash2, Wallet, X } from "lucide-react-native";
import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Chip, IconButton } from "@/components/primitives";
import { NavHeader, Notice, Screen } from "@/components/Screen";
import { Segmented } from "@/components/Segmented";
import { SelectField } from "@/components/SelectSheet";
import { TextField } from "@/components/TextField";
import { Txt } from "@/components/Txt";
import { MASTERS, docToFormValues, validateForm, type FieldDef, type FormContext } from "@/features/masters/config";
import type { RootScreenProps } from "@/navigation/types";
import { str } from "@/services/mappers";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { deleteMaster, fetchMaster, saveMaster } from "@/store/slices/mastersSlice";
import type { RootState } from "@/store";
import { useTheme } from "@/theme/ThemeProvider";
import { todayISO } from "@/utils/format";

export function MasterFormScreen({ navigation, route }: RootScreenProps<"MasterForm">) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const def = MASTERS[route.params.masterKey];
  const isEdit = Boolean(route.params.id);
  const doc = useAppSelector((s) => s.masters[def.key].items.find((d) => d._id === route.params.id));
  const masters = useAppSelector((s: RootState) => s.masters);

  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial = docToFormValues(def, doc);
    if (!isEdit) {
      for (const f of def.fields) {
        if (f.type === "date" && !initial[f.key]) initial[f.key] = todayISO();
        if (f.type === "select" && f.options && !initial[f.key] && f.required) initial[f.key] = f.options[0];
      }
    }
    return initial;
  });
  // The record as loaded, so locked fields are decided by what's saved, not what's typed.
  const ctx = useMemo<FormContext>(() => ({ isEdit, initial: docToFormValues(def, doc) }), [isEdit, def, doc]);
  const [error, setError] = useState<string | null>(null);
  // An option change waiting for the user to confirm it.
  const [pending, setPending] = useState<{ key: string; value: string; title: string; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    def.dependsOn?.forEach((k) => dispatch(fetchMaster(k)));
  }, [dispatch, def]);

  const set = (key: string, value: string) => setValues((v) => ({ ...v, [key]: value }));
  /** Picks an option, asking first when the field wants a confirmation. */
  const choose = (f: FieldDef, value: string) => {
    const ask = value !== values[f.key] ? f.confirmChange?.(value, ctx) : null;
    if (ask) setPending({ key: f.key, value, ...ask });
    else set(f.key, value);
  };
  const visibleFields = useMemo(
    () => def.fields.filter((f) => (!f.visibleWhen || f.visibleWhen(values)) && !f.hidden?.(ctx)),
    [def, values, ctx]
  );

  const save = async () => {
    const problem = validateForm(def, values, ctx);
    setError(problem);
    if (problem) return;
    setSaving(true);
    const res = await dispatch(saveMaster({ key: def.key, id: route.params.id, values }));
    setSaving(false);
    if (saveMaster.fulfilled.match(res)) navigation.goBack();
    else setError(res.payload ?? "Couldn't save.");
  };

  const remove = () =>
    Alert.alert(`Delete ${def.singular}?`, "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const res = await dispatch(deleteMaster({ key: def.key, id: route.params.id! }));
          if (deleteMaster.fulfilled.match(res)) navigation.goBack();
          else setError(res.payload ?? "Couldn't delete.");
        },
      },
    ]);

  const renderField = (f: FieldDef) => {
    const label = f.required ? f.label : `${f.label} (optional)`;
    const value = values[f.key] ?? "";
    if (f.readOnly?.(ctx)) {
      return <TextField key={f.key} label={f.label} value={value || "—"} editable={false} hint="Can't be changed here." />;
    }
    if (f.type === "select" && f.options) {
      if (f.options.length <= 3) {
        return (
          <View key={f.key} style={{ marginBottom: 14 }}>
            <Txt size={13} weight="semibold" style={{ marginBottom: 7 }}>
              {label}
            </Txt>
            <Segmented options={f.options} value={value} onChange={(v) => choose(f, v)} />
          </View>
        );
      }
      if (f.options.length <= 5) {
        return (
          <View key={f.key} style={{ marginBottom: 14 }}>
            <Txt size={13} weight="semibold" style={{ marginBottom: 7 }}>
              {label}
            </Txt>
            <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 8 }}>
              {f.options.map((o) => (
                <Chip key={o} label={o} active={value === o} onPress={() => choose(f, value === o && !f.required ? "" : o)} />
              ))}
            </View>
          </View>
        );
      }
      return (
        <SelectField key={f.key} label={label} value={value} onChange={(v) => choose(f, v)} options={f.options.map((o) => ({ value: o, label: o }))} />
      );
    }
    if (f.type === "ref" && f.ref) {
      const source = masters[f.ref.master].items.filter((d) => d.status !== false && (!f.ref!.filter || f.ref!.filter(d)));
      return (
        <SelectField
          key={f.key}
          label={label}
          value={value}
          onChange={(v) => set(f.key, v)}
          options={source.map((d) => ({ value: d._id, label: str(d[f.ref!.labelKey]) }))}
          emptyText={`No ${MASTERS[f.ref.master].title.toLowerCase()} yet — add one under More first.`}
        />
      );
    }
    return (
      <TextField
        key={f.key}
        label={label}
        value={value}
        onChangeText={(v) => set(f.key, v)}
        placeholder={f.placeholder ?? (f.type === "date" ? "YYYY-MM-DD" : undefined)}
        keyboardType={f.type === "number" ? "numeric" : f.type === "phone" ? "phone-pad" : f.type === "email" ? "email-address" : "default"}
        autoCapitalize={f.type === "email" || f.type === "password" ? "none" : "sentences"}
        secureToggle={f.type === "password"}
        hint={f.type === "password" && isEdit ? "Leave blank to keep the current password." : f.hint}
      />
    );
  };

  return (
    <Screen edges={Platform.OS === "ios" ? [] : ["top"]}>
      <NavHeader
        left={<IconButton icon={X} onPress={() => navigation.goBack()} accessibilityLabel="Close" />}
        title={`${isEdit ? "Edit" : "New"} ${def.singular}`}
        right={isEdit ? <IconButton icon={Trash2} onPress={remove} accessibilityLabel={`Delete ${def.singular}`} /> : undefined}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {isEdit && !doc && <Notice message="This record is no longer in the list — it may have been deleted." />}
          {error && <Notice message={error} tone="danger" />}
          {def.autoCode && !isEdit && (
            <Txt size={12.5} muted style={{ marginBottom: 12 }}>
              A {def.autoCode.prefix}- code is generated automatically when you save.
            </Txt>
          )}
          {visibleFields.map(renderField)}
        </ScrollView>
        <View style={[styles.footer, { backgroundColor: t.bg, paddingBottom: insets.bottom + 12 }]}>
          <Button title={isEdit ? "Save changes" : `Create ${def.singular}`} icon={Check} onPress={save} loading={saving} />
        </View>
      </KeyboardAvoidingView>

      <ConfirmDialog
        visible={pending !== null}
        icon={Wallet}
        tone="warning"
        title={pending?.title ?? ""}
        message={pending?.message}
        confirmLabel="Confirm"
        onConfirm={() => {
          if (pending) set(pending.key, pending.value);
          setPending(null);
        }}
        onCancel={() => setPending(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 30 },
  footer: { paddingHorizontal: 20, paddingTop: 10 },
});
