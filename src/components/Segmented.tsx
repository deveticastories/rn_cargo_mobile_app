import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { radius } from "@/theme/fonts";
import { useTheme } from "@/theme/ThemeProvider";
import { Txt } from "./Txt";

/** iOS-style segmented control: With Bill / Without Bill, Invoices / Receipts / Expenses. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  labels,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  labels?: Partial<Record<T, string>>;
}) {
  const t = useTheme();
  return (
    <View style={[styles.track, { backgroundColor: t.isDark ? t.surfaceAlt : t.surfaceAlt, borderColor: t.border }]}>
      {options.map((opt) => {
        const active = opt === value;
        return (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[
              styles.segment,
              active && {
                backgroundColor: t.isDark ? t.surface : "#FFFFFF",
                shadowColor: "#000",
                shadowOpacity: t.isDark ? 0.3 : 0.08,
                shadowRadius: 4,
                shadowOffset: { width: 0, height: 1 },
                elevation: 1,
              },
            ]}
          >
            <Txt size={13} weight={active ? "bold" : "medium"} color={active ? t.text : t.textMuted}>
              {labels?.[opt] ?? opt}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: "row", padding: 4, borderRadius: radius.md, borderWidth: 1 },
  segment: { flex: 1, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
});
