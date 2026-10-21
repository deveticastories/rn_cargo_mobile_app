/** Small building blocks used across every screen: cards, badges, chips, avatars, progress bars. */
import React from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Line } from "react-native-svg";
import { radius } from "@/theme/fonts";
import { toneForName, type Tone } from "@/theme/palette";
import { useTheme } from "@/theme/ThemeProvider";
import { initials } from "@/utils/format";
import { Txt } from "./Txt";

type IconType = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

export function Card({
  children,
  style,
  onPress,
  onLongPress,
  padded = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  onLongPress?: () => void;
  padded?: boolean;
}) {
  const t = useTheme();
  const base: ViewStyle = {
    backgroundColor: t.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: t.border,
    padding: padded ? 16 : 0,
    ...(t.isDark
      ? null
      : { shadowColor: t.shadow, shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 1 }),
  };
  if (!onPress && !onLongPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} style={({ pressed }) => [base, style, pressed && { opacity: 0.85 }]}>
      {children}
    </Pressable>
  );
}

export function Badge({ label, tone, dot = true, size = "md" }: { label: string; tone: Tone; dot?: boolean; size?: "sm" | "md" }) {
  const t = useTheme();
  const c = t.tones[tone];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }, size === "sm" && { paddingHorizontal: 7, paddingVertical: 2 }]}>
      {dot && <View style={[styles.dot, { backgroundColor: c.fg }]} />}
      <Txt size={size === "sm" ? 10.5 : 11.5} weight="semibold" color={c.fg} numberOfLines={1}>
        {label}
      </Txt>
    </View>
  );
}

export function Chip({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count?: number;
  active?: boolean;
  onPress?: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: active ? t.chipActiveBg : t.border, backgroundColor: active ? t.chipActiveBg : t.surface },
      ]}
    >
      <Txt size={13} weight="semibold" color={active ? t.chipActiveText : t.text}>
        {label}
      </Txt>
      {count !== undefined && (
        <Txt size={11} weight="medium" color={active ? t.chipActiveText : t.textMuted} style={{ marginLeft: 6, opacity: 0.85 }}>
          {count}
        </Txt>
      )}
    </Pressable>
  );
}

/** Small tag used under booking cards: "6 × Box", "Branded", "With Bill". */
export function Tag({ label }: { label: string }) {
  const t = useTheme();
  return (
    <View style={[styles.tag, { backgroundColor: t.surfaceAlt }]}>
      <Txt size={11.5} weight="medium" muted>
        {label}
      </Txt>
    </View>
  );
}

export function IconButton({
  icon: Icon,
  onPress,
  size = 40,
  dot,
  accessibilityLabel,
  filled,
}: {
  icon: IconType;
  onPress?: () => void;
  size?: number;
  dot?: boolean;
  accessibilityLabel?: string;
  filled?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      style={({ pressed }) => [
        styles.iconButton,
        {
          width: size,
          height: size,
          borderColor: t.border,
          backgroundColor: filled ? t.primary : t.surface,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Icon size={size * 0.45} color={filled ? t.onPrimary : t.text} strokeWidth={2} />
      {dot && <View style={[styles.notifDot, { borderColor: t.surface }]} />}
    </Pressable>
  );
}

/** Soft-tinted rounded square holding an icon (masters grid, invoice rows, container cards). */
export function IconTile({ icon: Icon, tone, size = 40 }: { icon: IconType; tone: Tone; size?: number }) {
  const t = useTheme();
  const c = t.tones[tone];
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.28, backgroundColor: c.bg, alignItems: "center", justifyContent: "center" }}>
      <Icon size={size * 0.48} color={c.fg} strokeWidth={1.8} />
    </View>
  );
}

export function Avatar({ name, size = 40, tone }: { name: string; size?: number; tone?: Tone }) {
  const t = useTheme();
  const c = t.tones[tone ?? toneForName(name)];
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: c.bg, alignItems: "center", justifyContent: "center" }}>
      <Txt size={size * 0.34} weight="bold" color={c.fg}>
        {initials(name)}
      </Txt>
    </View>
  );
}

export function ProgressBar({ value, color, height = 6, track }: { value: number; color?: string; height?: number; track?: string }) {
  const t = useTheme();
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View style={{ height, borderRadius: height, backgroundColor: track ?? t.surfaceAlt, overflow: "hidden" }}>
      <View style={{ width: `${pct * 100}%` as const, height, borderRadius: height, backgroundColor: color ?? t.primary }} />
    </View>
  );
}

export function DashedDivider({ style }: { style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <View style={[{ height: 1, marginVertical: 10 }, style]}>
      <Svg height={1} width="100%">
        <Line x1="0" y1="0.5" x2="100%" y2="0.5" stroke={t.borderStrong} strokeWidth={1} strokeDasharray="4 4" />
      </Svg>
    </View>
  );
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const t = useTheme();
  return (
    <View style={styles.sectionTitle}>
      <Txt size={16} weight="bold">
        {title}
      </Txt>
      {action && (
        <Pressable onPress={onAction} hitSlop={8}>
          <Txt size={13} weight="semibold" color={t.primary}>
            {action}
          </Txt>
        </Pressable>
      )}
    </View>
  );
}

/** Two-line label/value pair used in grids (Stuffed · 02 Oct). */
export function Stat({ label, value, valueColor, align }: { label: string; value: string; valueColor?: string; align?: "left" | "right" }) {
  return (
    <View style={{ flex: 1, alignItems: align === "right" ? "flex-end" : "flex-start" }}>
      <Txt size={11} muted>
        {label}
      </Txt>
      <Txt size={14} weight="bold" color={valueColor} style={{ marginTop: 3 }}>
        {value}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill, alignSelf: "flex-start" },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  chip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, height: 34, borderRadius: radius.pill, borderWidth: 1, marginRight: 8 },
  tag: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, marginRight: 6, marginTop: 6 },
  iconButton: { borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  notifDot: { position: "absolute", top: 8, right: 9, width: 8, height: 8, borderRadius: 4, backgroundColor: "#E5484D", borderWidth: 1.5 },
  sectionTitle: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10, marginTop: 22 },
});
