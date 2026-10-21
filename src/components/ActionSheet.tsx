/** Bottom sheets: a generic themed container, and an action menu built on it (themed replacement for Alert menus). */
import React from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import type { Tone } from "@/theme/palette";
import { useTheme } from "@/theme/ThemeProvider";
import { Button } from "./Button";
import { IconTile } from "./primitives";
import { Txt } from "./Txt";

type IconType = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

export function BottomSheet({
  visible,
  title,
  subtitle,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: t.overlay }]} onPress={onClose} accessibilityLabel="Dismiss" />
      <View style={styles.wrap} pointerEvents="box-none">
        <View style={[styles.sheet, { backgroundColor: t.surface, paddingBottom: insets.bottom + 16 }]} accessibilityViewIsModal>
          <View style={[styles.grabber, { backgroundColor: t.borderStrong }]} />
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Txt size={17} weight="bold">
                {title}
              </Txt>
              {subtitle ? (
                <Txt size={13} muted style={{ marginTop: 2 }}>
                  {subtitle}
                </Txt>
              ) : null}
            </View>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <X size={20} color={t.textMuted} />
            </Pressable>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

export interface SheetAction {
  key: string;
  label: string;
  description?: string;
  icon: IconType;
  tone?: Tone;
  destructive?: boolean;
  onPress: () => void;
}

export function ActionSheet({
  visible,
  title,
  subtitle,
  actions,
  onClose,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  actions: SheetAction[];
  onClose: () => void;
}) {
  const t = useTheme();
  return (
    <BottomSheet visible={visible} title={title} subtitle={subtitle} onClose={onClose}>
      <View style={[styles.group, { borderColor: t.border, backgroundColor: t.surfaceAlt }]}>
        {actions.map((a, i) => (
          <Pressable
            key={a.key}
            onPress={a.onPress}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.action,
              i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: t.border },
              pressed && { backgroundColor: t.border },
            ]}
          >
            <IconTile icon={a.icon} tone={a.tone ?? (a.destructive ? "danger" : "info")} size={38} />
            <View style={{ flex: 1 }}>
              <Txt size={15} weight="semibold" color={a.destructive ? t.tones.danger.fg : undefined}>
                {a.label}
              </Txt>
              {a.description ? (
                <Txt size={12.5} muted>
                  {a.description}
                </Txt>
              ) : null}
            </View>
          </Pressable>
        ))}
      </View>
      <Button title="Cancel" variant="secondary" onPress={onClose} height={48} style={{ marginTop: 12 }} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingTop: 8 },
  grabber: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 10 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 14 },
  group: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  action: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 12 },
});
