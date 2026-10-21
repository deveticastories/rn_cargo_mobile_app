/** Screen scaffolding: safe-area container, large-title header, and centred navigation header. */
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { TriangleAlert, Inbox, RefreshCw } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Txt } from "./Txt";

export function Screen({ children, edges = ["top"], style }: { children: React.ReactNode; edges?: Edge[]; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: t.bg }, style]}>
      {children}
    </SafeAreaView>
  );
}

/** "Bookings", "Containers", "Finance" — big title with an optional action on the right. */
export function LargeHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <View style={styles.large}>
      <Txt size={30} weight="bold">
        {title}
      </Txt>
      {right}
    </View>
  );
}

/** Centered title between two icon buttons — detail and form screens. */
export function NavHeader({ left, title, right }: { left?: React.ReactNode; title: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={styles.nav}>
      <View style={styles.side}>{left}</View>
      <View style={{ flex: 1, alignItems: "center" }}>{typeof title === "string" ? <Txt size={17} weight="bold">{title}</Txt> : title}</View>
      <View style={[styles.side, { alignItems: "flex-end" }]}>{right}</View>
    </View>
  );
}

export function LoadingView({ label = "Loading…" }: { label?: string }) {
  const t = useTheme();
  return (
    <View style={styles.center}>
      <ActivityIndicator color={t.primary} />
      <Txt muted size={13} style={{ marginTop: 10 }}>
        {label}
      </Txt>
    </View>
  );
}

export function EmptyView({ title, message }: { title: string; message?: string }) {
  const t = useTheme();
  return (
    <View style={styles.center}>
      <Inbox size={30} color={t.textSoft} />
      <Txt size={15} weight="semibold" style={{ marginTop: 10 }}>
        {title}
      </Txt>
      {message && (
        <Txt size={13} muted align="center" style={{ marginTop: 4, maxWidth: 260 }}>
          {message}
        </Txt>
      )}
    </View>
  );
}

/** Inline warning banner (session expired, failed loads) with an optional retry. */
export function Notice({ message, tone = "warning", onRetry }: { message: string; tone?: "warning" | "danger"; onRetry?: () => void }) {
  const t = useTheme();
  const c = t.tones[tone];
  return (
    <View style={[styles.notice, { backgroundColor: c.bg }]}>
      <TriangleAlert size={17} color={c.fg} style={{ marginTop: 1 }} />
      <Txt size={13} color={c.fg} style={{ flex: 1 }}>
        {message}
      </Txt>
      {onRetry && (
        <Pressable onPress={onRetry} hitSlop={10} accessibilityLabel="Retry">
          <RefreshCw size={16} color={c.fg} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  large: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14 },
  nav: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 10 },
  side: { width: 44 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 48 },
  notice: { flexDirection: "row", gap: 10, padding: 12, borderRadius: 12, marginBottom: 14, alignItems: "flex-start" },
});
