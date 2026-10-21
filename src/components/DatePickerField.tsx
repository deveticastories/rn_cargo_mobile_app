/**
 * A date field that opens a month-calendar bottom sheet. Values are local
 * "YYYY-MM-DD" strings, matching what the booking API expects.
 */
import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react-native";
import { radius } from "@/theme/fonts";
import { useTheme } from "@/theme/ThemeProvider";
import { Txt } from "./Txt";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

const pad = (n: number) => String(n).padStart(2, "0");
const toISO = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

/** Parses "YYYY-MM-DD" as a local date (new Date(iso) would read it as UTC). */
function parseISO(value: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]) - 1, d: Number(match[3]) };
}

const formatLabel = (value: string) => {
  const p = parseISO(value);
  return p ? `${pad(p.d)} ${MONTH_NAMES[p.m].slice(0, 3)} ${p.y}` : "";
};

interface DatePickerFieldProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (iso: string) => void;
}

export function DatePickerField({ label, placeholder = "Select date", value, onChange }: DatePickerFieldProps) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const display = formatLabel(value);

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
        accessibilityLabel={label ? `${label}: ${display || placeholder}` : undefined}
        style={[styles.field, { borderColor: t.border, backgroundColor: t.isDark ? t.surfaceAlt : t.surface }]}
      >
        <Calendar size={18} color={t.textMuted} strokeWidth={1.8} />
        <Txt size={15} weight="medium" color={display ? t.text : t.textSoft} style={{ flex: 1 }}>
          {display || placeholder}
        </Txt>
      </Pressable>
      <DatePickerSheet
        visible={open}
        title={label ?? placeholder}
        value={value}
        onClose={() => setOpen(false)}
        onSelect={(iso) => {
          onChange(iso);
          setOpen(false);
        }}
      />
    </View>
  );
}

function DatePickerSheet({
  visible,
  title,
  value,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  value: string;
  onSelect: (iso: string) => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const now = new Date();
  const today = toISO(now.getFullYear(), now.getMonth(), now.getDate());
  const initial = parseISO(value) ?? { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() };
  const [view, setView] = useState({ y: initial.y, m: initial.m });

  const shiftMonth = (delta: number) =>
    setView(({ y, m }) => {
      const next = m + delta;
      return { y: y + Math.floor(next / 12), m: ((next % 12) + 12) % 12 };
    });

  const firstWeekday = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      onShow={() => setView({ y: initial.y, m: initial.m })}
    >
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: t.overlay }]} onPress={onClose} />
      <View style={styles.sheetWrap} pointerEvents="box-none">
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

          <View style={styles.monthRow}>
            <Pressable onPress={() => shiftMonth(-1)} hitSlop={10} style={[styles.navBtn, { backgroundColor: t.surfaceAlt }]} accessibilityLabel="Previous month">
              <ChevronLeft size={18} color={t.text} />
            </Pressable>
            <Txt size={15} weight="bold">
              {MONTH_NAMES[view.m]} {view.y}
            </Txt>
            <Pressable onPress={() => shiftMonth(1)} hitSlop={10} style={[styles.navBtn, { backgroundColor: t.surfaceAlt }]} accessibilityLabel="Next month">
              <ChevronRight size={18} color={t.text} />
            </Pressable>
          </View>

          <View style={styles.grid}>
            {WEEKDAYS.map((w, i) => (
              <View key={`w${i}`} style={styles.cell}>
                <Txt size={12} muted weight="semibold">
                  {w}
                </Txt>
              </View>
            ))}
            {cells.map((day, i) => {
              if (day === null) return <View key={`e${i}`} style={styles.cell} />;
              const iso = toISO(view.y, view.m, day);
              const selected = iso === value;
              const isToday = iso === today;
              return (
                <View key={iso} style={styles.cell}>
                  <Pressable
                    onPress={() => onSelect(iso)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={[
                      styles.day,
                      selected && { backgroundColor: t.primary },
                      !selected && isToday && { borderWidth: 1.5, borderColor: t.primary },
                    ]}
                  >
                    <Txt size={14.5} weight={selected || isToday ? "bold" : "medium"} color={selected ? t.onPrimary : isToday ? t.primary : t.text}>
                      {day}
                    </Txt>
                  </Pressable>
                </View>
              );
            })}
          </View>

          <Pressable onPress={() => onSelect(today)} style={[styles.todayBtn, { borderColor: t.border }]}>
            <Txt size={14} weight="semibold" color={t.primary}>
              Today
            </Txt>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: "row", alignItems: "center", gap: 10, height: 52, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: 14 },
  sheetWrap: { flex: 1, justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingTop: 8 },
  grabber: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 10 },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  navBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  day: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  todayBtn: { marginTop: 10, height: 44, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
