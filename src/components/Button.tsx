import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { radius } from "@/theme/fonts";
import { useTheme } from "@/theme/ThemeProvider";
import { Txt } from "./Txt";

type IconType = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  icon?: IconType;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  height?: number;
}

/** Primary buttons use the teal gradient from the design, with a soft glow. */
export function Button({ title, onPress, variant = "primary", icon: Icon, loading, disabled, style, height = 54 }: ButtonProps) {
  const t = useTheme();
  const inactive = disabled || loading;
  const fg =
    variant === "primary" ? t.onPrimary : variant === "danger" ? t.tones.danger.fg : variant === "ghost" ? t.primary : t.text;

  const content = (
    <View style={styles.row}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          <Txt size={15} weight="bold" color={fg}>
            {title}
          </Txt>
          {Icon && <Icon size={17} color={fg} strokeWidth={2.2} />}
        </>
      )}
    </View>
  );

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={({ pressed }) => [
        { height, borderRadius: radius.md, opacity: disabled ? 0.5 : pressed ? 0.88 : 1 },
        variant === "primary" && {
          shadowColor: t.primary,
          shadowOpacity: t.isDark ? 0.35 : 0.3,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
          elevation: 4,
        },
        style,
      ]}
    >
      {variant === "primary" ? (
        <LinearGradient colors={t.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.fill, { borderRadius: radius.md }]}>
          {content}
        </LinearGradient>
      ) : (
        <View
          style={[
            styles.fill,
            {
              borderRadius: radius.md,
              backgroundColor: variant === "danger" ? t.tones.danger.bg : variant === "ghost" ? "transparent" : t.surface,
              borderWidth: variant === "secondary" ? 1 : 0,
              borderColor: t.border,
            },
          ]}
        >
          {content}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
});
