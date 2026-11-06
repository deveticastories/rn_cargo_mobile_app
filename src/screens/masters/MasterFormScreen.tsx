/** Generic create/edit form for any master/operations module, driven by `MASTERS` config. */
import React, { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, Trash2, Wallet, X } from "lucide-react-native";
import { showAlert } from "@/components/AppAlert";
import { showErrorToast } from "@/components/AppToast";
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
import { selectPickupMode } from "@/store/slices/authSlice";
import { deleteMaster, fetchMasterItem, saveMaster } from "@/store/slices/mastersSlice";
import { ensureMaster } from "@/store/ensure";
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
  const pickupMode = useAppSelector(selectPickupMode);
  const ctx = useMemo<FormContext>(() => ({ isEdit, initial: docToFormValues(def, doc), doc, pickupMode }), [isEdit, def, doc, pickupMode]);
  const locked = def.locked?.(ctx) ?? null;
  const notice = locked ?? def.notice?.(ctx) ?? null;
  // An option change waiting for the user to confirm it.
  const [pending, setPending] = useState<{ key: string; value: string; title: string; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  // Waiting for the record's latest copy from the server (modules with `loadOnEdit`).
  const [loadingDoc, setLoadingDoc] = useState(isEdit && Boolean(def.loadOnEdit));

  useEffect(() => {
    if (!isEdit || !def.loadOnEdit) return;
    let live = true;
    dispatch(fetchMasterItem({ key: def.key, id: route.params.id! })).then((res) => {
      if (!live) return;
      setLoadingDoc(false);
      if (fetchMasterItem.fulfilled.match(res) && res.payload.doc) setValues(docToFormValues(def, res.payload.doc));
      else if (fetchMasterItem.rejected.match(res)) showErrorToast(`Couldn't load the latest ${def.singular}`, res.payload ?? "Showing the saved copy.");
    });
    return () => {
      live = false;
    };
  }, [dispatch, def, isEdit, route.params.id]);

  useEffect(() => {
    def.dependsOn?.forEach((k) => dispatch(ensureMaster(k)));
  }, [dispatch, def]);

  // Ref defaults need their master's records, which may still be loading when the form opens.
  useEffect(() => {
    if (isEdit) return;
    setValues((v) => {
      let next = v;
      for (const f of def.fields) {
        if (!f.defaultRef || !f.ref || v[f.key]) continue;
        const match = masters[f.ref.master].items.find((d) => d.status !== false && f.defaultRef!(d));
        if (match) next = { ...next, [f.key]: match._id };
      }
      return next;
    });
  }, [isEdit, def, masters]);

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
    if (locked || loadingDoc) return;
    const problem = validateForm(def, values, ctx);
    if (problem) return showErrorToast(`Can't save the ${def.singular}`, problem);
    setSaving(true);
    const res = await dispatch(saveMaster({ key: def.key, id: route.params.id, values }));
    setSaving(false);
    if (saveMaster.fulfilled.match(res)) navigation.goBack();
    else showErrorToast(`Couldn't save the ${def.singular}`, res.payload ?? "Please try again.");
  };

  const remove = () =>
    showAlert(`Delete ${def.singular}?`, "This can't be undone.", {
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      destructive: true,
      onConfirm: async () => {
        const res = await dispatch(deleteMaster({ key: def.key, id: route.params.id! }));
        if (deleteMaster.fulfilled.match(res)) navigation.goBack();
        else showErrorToast(`Couldn't delete the ${def.singular}`, res.payload ?? "Please try again.");
      },
    });

  const renderField = (f: FieldDef) => {
    const label = f.required ? f.label : `${f.label} (optional)`;
    const value = values[f.key] ?? "";
    if (locked || f.readOnly?.(ctx)) {
      const shown = f.type === "ref" && f.ref ? str(masters[f.ref.master].items.find((d) => d._id === value)?.[f.ref.labelKey]) : value;
      return <TextField key={f.key} label={f.label} value={shown || "—"} editable={false} hint={locked ? undefined : "Can't be changed here."} />;
    }
    if (f.finalValue && value === f.finalValue) {
      return <TextField key={f.key} label={f.label} value={value} editable={false} hint="Can't be changed back once confirmed." />;
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
      const source = masters[f.ref.master].items.filter((d) => d.status !== false && (!f.ref!.filter || f.ref!.filter(d, ctx)));
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
        right={isEdit && (!doc || !def.canDelete || def.canDelete(doc)) ? <IconButton icon={Trash2} onPress={remove} accessibilityLabel={`Delete ${def.singular}`} /> : undefined}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {isEdit && !doc && <Notice message="This record is no longer in the list — it may have been deleted." />}
          {notice && <Notice message={notice} />}
          {def.autoCode && !isEdit && (
            <Txt size={12.5} muted style={{ marginBottom: 12 }}>
              A {def.autoCode.prefix}- code is generated automatically when you save.
            </Txt>
          )}
          {visibleFields.map(renderField)}
        </ScrollView>
        {!locked && (
          <View style={[styles.footer, { backgroundColor: t.bg, paddingBottom: insets.bottom + 12 }]}>
            <Button title={isEdit ? "Save changes" : `Create ${def.singular}`} icon={Check} onPress={save} loading={saving || loadingDoc} />
          </View>
        )}
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
