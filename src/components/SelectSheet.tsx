/**
 * A select field that opens a searchable bottom sheet — used for sender,
 * receiver, transport, country and every other "pick one record" input.
 */
import React, { useMemo, useState } from "react";
import { FlatList, KeyboardAvoidingView, Modal, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, ChevronDown, Search, X } from "lucide-react-native";
import { fonts, radius } from "@/theme/fonts";
import { useTheme } from "@/theme/ThemeProvider";
import { Avatar } from "./primitives";
import { Txt } from "./Txt";

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface SelectFieldProps {
  label?: string;
  placeholder?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  /** Show an initials avatar next to each option (people). */
  withAvatar?: boolean;
  /** Formats the closed field, e.g. "Rahul Nair · Kochi". */
  display?: (opt: SelectOption) => string;
  emptyText?: string;
  /** Shown in red under the field, which also gets a red border. */
  error?: string | null;
}

export function SelectField({ label, placeholder = "Select", value, options, onChange, withAvatar, display, emptyText, error }: SelectFieldProps) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View style={{ marginBottom: 14 }}>
      {label && (
        <Txt size={13} weight="semibold" style={{ marginBottom: 7 }}>
          {label}
        </Txt>
      )}
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        style={[styles.field, { borderColor: error ? t.tones.danger.fg : t.border, backgroundColor: t.isDark ? t.surfaceAlt : t.surface }]}
      >
        {selected && withAvatar && <Avatar name={selected.label} size={28} />}
        <Txt size={15} weight="medium" color={selected ? t.text : t.textSoft} style={{ flex: 1 }} numberOfLines={1}>
          {selected ? (display ? display(selected) : selected.label) : placeholder}
        </Txt>
        <ChevronDown size={18} color={t.textMuted} />
      </Pressable>
      {error ? (
        <Txt size={12} color={t.tones.danger.fg} style={{ marginTop: 6 }}>
          {error}
        </Txt>
      ) : null}
      <SelectSheet
        visible={open}
        title={label ?? placeholder}
        options={options}
        value={value}
        withAvatar={withAvatar}
        emptyText={emptyText}
        onClose={() => setOpen(false)}
        onSelect={(v) => {
          onChange(v);
          setOpen(false);
        }}
      />
    </View>
  );
}

export function SelectSheet({
  visible,
  title,
  options,
  value,
  onSelect,
  onClose,
  withAvatar,
  emptyText = "Nothing to choose from yet.",
}: {
  visible: boolean;
  title: string;
  options: SelectOption[];
  value?: string;
  onSelect: (value: string) => void;
  onClose: () => void;
  withAvatar?: boolean;
  emptyText?: string;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => `${o.label} ${o.sublabel ?? ""}`.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose} onShow={() => setQuery("")}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: t.overlay }]} onPress={onClose} />
      <KeyboardAvoidingView behavior="padding" style={styles.sheetWrap} pointerEvents="box-none">
        <View style={[styles.sheet, { backgroundColor: t.surface, paddingBottom: insets.bottom + 12 }]}>
          <View style={[styles.grabber, { backgroundColor: t.borderStrong }]} />
          <View style={styles.sheetHeader}>
            <Txt size={17} weight="bold">
              {title}
            </Txt>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <X size={20} color={t.textMuted} />
            </Pressable>
          </View>
          {options.length > 6 && (
            <View style={[styles.search, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}>
              <Search size={16} color={t.textMuted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search"
                placeholderTextColor={t.textSoft}
                style={{ flex: 1, color: t.text, fontFamily: fonts.medium, fontSize: 15 }}
                autoCorrect={false}
              />
            </View>
          )}
          <FlatList
            data={filtered}
            keyExtractor={(o) => o.value}
            keyboardShouldPersistTaps="handled"
            style={{ maxHeight: 420 }}
            ListEmptyComponent={
              <Txt muted align="center" style={{ paddingVertical: 28 }}>
                {emptyText}
              </Txt>
            }
            renderItem={({ item }) => {
              const active = item.value === value;
              return (
                <Pressable
                  onPress={() => onSelect(item.value)}
                  style={({ pressed }) => [styles.option, { borderColor: t.border }, pressed && { backgroundColor: t.surfaceAlt }]}
                >
                  {withAvatar && <Avatar name={item.label} size={34} />}
                  <View style={{ flex: 1 }}>
                    <Txt size={15} weight="semibold">
                      {item.label}
                    </Txt>
                    {item.sublabel ? (
                      <Txt size={12.5} muted>
                        {item.sublabel}
                      </Txt>
                    ) : null}
                  </View>
                  {active && <Check size={18} color={t.primary} />}
                </Pressable>
              );
            }}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: "row", alignItems: "center", gap: 10, height: 52, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: 12 },
  sheetWrap: { flex: 1, justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingTop: 8 },
  grabber: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 10 },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  search: { flexDirection: "row", alignItems: "center", gap: 8, height: 42, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, marginBottom: 6 },
  option: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
});
