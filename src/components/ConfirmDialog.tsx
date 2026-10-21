/** Centered confirmation dialog — log out, discard, delete. Themed replacement for Alert.alert. */
import React from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import type { Tone } from "@/theme/palette";
import { useTheme } from "@/theme/ThemeProvider";
import { Button } from "./Button";
import { IconTile } from "./primitives";
import { Txt } from "./Txt";

type IconType = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

interface ConfirmDialogProps {
  visible: boolean;
  icon: IconType;
  tone?: Tone;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Styles the confirm button red. */
  destructive?: boolean;
  /** Shows a spinner on the confirm button and blocks dismissal while the action runs. */
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Extra content between the message and the buttons, e.g. who is signed in. */
  children?: React.ReactNode;
}

export function ConfirmDialog({
  visible,
  icon,
  tone = "danger",
  title,
  message,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive,
  loading,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  const t = useTheme();
  const dismiss = () => {
    if (!loading) onCancel();
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss} statusBarTranslucent navigationBarTranslucent>
      <View style={styles.center}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: t.overlay }]} onPress={dismiss} accessibilityLabel="Dismiss" />
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]} accessibilityViewIsModal>
          <IconTile icon={icon} tone={tone} size={56} />
          <Txt size={19} weight="bold" align="center" style={{ marginTop: 16 }}>
            {title}
          </Txt>
          {message && (
            <Txt size={14} muted align="center" style={{ marginTop: 6, lineHeight: 20 }}>
              {message}
            </Txt>
          )}
          {children}
          <View style={styles.actions}>
            <Button title={cancelLabel} variant="secondary" onPress={dismiss} disabled={loading} height={48} style={{ flex: 1 }} />
            <Button
              title={confirmLabel}
              variant={destructive ? "danger" : "primary"}
              onPress={onConfirm}
              loading={loading}
              height={48}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
  card: { width: "100%", maxWidth: 360, borderRadius: 24, borderWidth: 1, padding: 22, alignItems: "center" },
  actions: { flexDirection: "row", gap: 10, marginTop: 22, alignSelf: "stretch" },
});
