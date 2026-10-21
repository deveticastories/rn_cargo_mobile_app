/**
 * The design's bottom bar: Home · Bookings · (+) · Containers · More, with a
 * raised gradient "+" button in the middle that opens the New booking flow.
 */
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { House, LayoutGrid, Package, Plus, Ship } from "lucide-react-native";
import { Txt } from "@/components/Txt";
import { useTheme } from "@/theme/ThemeProvider";

const ICONS = { Home: House, Bookings: Package, Containers: Ship, More: LayoutGrid } as const;

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  const renderTab = (index: number) => {
    const route = state.routes[index];
    const focused = state.index === index;
    const Icon = ICONS[route.name as keyof typeof ICONS] ?? House;
    const color = focused ? t.primary : t.textMuted;
    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        onPress={() => {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          // Tapping the active More tab pops its nested stack back to the root.
          else if (focused && route.state && (route.state.index ?? 0) > 0) navigation.navigate(route.name, { screen: "MoreHome" });
        }}
        style={styles.tab}
      >
        <Icon size={21} color={color} strokeWidth={focused ? 2.1 : 1.8} />
        <Txt size={10.5} weight={focused ? "bold" : "medium"} color={color} style={{ marginTop: 3 }}>
          {route.name}
        </Txt>
      </Pressable>
    );
  };

  return (
    <View style={[styles.bar, { backgroundColor: t.surface, borderTopColor: t.border, paddingBottom: Math.max(insets.bottom, 10) }]}>
      {renderTab(0)}
      {renderTab(1)}
      <View style={styles.fabSlot}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New booking"
          onPress={() => navigation.getParent()?.navigate("NewBooking")}
          style={({ pressed }) => [styles.fabShadow, { shadowColor: t.primary, opacity: pressed ? 0.85 : 1 }]}
        >
          <LinearGradient colors={t.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fab}>
            <Plus size={26} color={t.onPrimary} strokeWidth={2.4} />
          </LinearGradient>
        </Pressable>
      </View>
      {renderTab(2)}
      {renderTab(3)}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "flex-start", borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 2 },
  fabSlot: { flex: 1, alignItems: "center" },
  fabShadow: { marginTop: -26, borderRadius: 18, shadowOpacity: 0.45, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  fab: { width: 56, height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center" },
});
