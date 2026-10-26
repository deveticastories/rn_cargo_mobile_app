/**
 * The design's bottom bar: Home · Bookings · Invoices · (+) · Delivery · Stuffing · More, with a
 * raised gradient "+" button in the middle that fans out an arc of floating
 * actions (Containers, New booking) styled like the tab items. Tapping +
 * again, the backdrop, or Android back closes the arc.
 */
import React, { useEffect, useRef, useState } from "react";
import { Animated, BackHandler, Easing, Keyboard, Pressable, StyleSheet, View } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowLeftRight, ClipboardList, FileText, House, LayoutGrid, Package, Plus, Ship, Truck } from "lucide-react-native";
import { Txt } from "@/components/Txt";
import type { RootStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme/ThemeProvider";

const ICONS = { Home: House, Bookings: Package, Invoices: FileText, DeliveryNotes: Truck, Stuffing: ArrowLeftRight, More: LayoutGrid } as const;
/** Tab labels where the route name isn't short enough to show as-is. */
const LABELS: Record<string, string> = { DeliveryNotes: "Delivery" };

const BAR_PADDING_TOP = 10;
const FAB_SIZE = 56;
/** How far the + button rises above the bar's top padding. */
const FAB_LIFT = 26;
/** Arc the actions sit on: distance from the + button's centre, and the sweep in degrees (180 = left, 0 = right). */
const ARC_RADIUS = 100;
const ARC_FROM = 135;
const ARC_TO = 45;
/** Each action is a tile wide enough for its label on one line. */
const ACTION_WIDTH = 96;
const ACTION_HEIGHT = 60;

type FabAction = { key: Extract<keyof RootStackParamList, "Containers" | "NewBooking">; label: string; icon: typeof Ship };

// Placed along the arc from left to right.
const FAB_ACTIONS: FabAction[] = [
  { key: "Containers", label: "Containers", icon: Ship },
  { key: "NewBooking", label: "New booking", icon: ClipboardList },
];

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;
  const [open, setOpen] = useState(false);
  const [bar, setBar] = useState({ y: 0, width: 0 });
  // Hidden while the keyboard is up so it never sits on top of the keyboard or the field being typed in.
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardOpen(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const openMenu = () => {
    setOpen(true);
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 7, tension: 80 }).start();
  };

  const closeMenu = (then?: () => void) =>
    Animated.timing(anim, { toValue: 0, duration: 140, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => {
      setOpen(false);
      then?.();
    });

  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      closeMenu();
      return true;
    });
    return () => sub.remove();
  }, [open]);

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
          if (open) closeMenu();
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          // Tapping the active More tab pops its nested stack back to the root.
          else if (focused && route.state && (route.state.index ?? 0) > 0) navigation.navigate(route.name, { screen: "MoreHome" });
        }}
        style={styles.tab}
      >
        <Icon size={21} color={color} strokeWidth={focused ? 2.1 : 1.8} />
        <Txt size={10.5} weight={focused ? "bold" : "medium"} color={color} style={{ marginTop: 3 }}>
          {LABELS[route.name] ?? route.name}
        </Txt>
      </Pressable>
    );
  };

  const half = Math.ceil(state.routes.length / 2);
  // Centre of the + button, in the tab navigator's coordinates (it sits in the middle slot of the bar).
  const fabCenter = { x: bar.width / 2, y: bar.y + BAR_PADDING_TOP - FAB_LIFT + FAB_SIZE / 2 };

  if (keyboardOpen && !open) return null;

  return (
    <>
      {/* Rendered before the bar so the bar, and its + button, stay on top of the backdrop. */}
      {open && (
        <View style={StyleSheet.absoluteFill}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: t.overlay, opacity: anim }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => closeMenu()} accessibilityLabel="Close menu" />
          </Animated.View>
          {FAB_ACTIONS.map((a, i) => {
            const angle = ((ARC_FROM - (i * (ARC_FROM - ARC_TO)) / Math.max(FAB_ACTIONS.length - 1, 1)) * Math.PI) / 180;
            const dx = ARC_RADIUS * Math.cos(angle);
            const dy = -ARC_RADIUS * Math.sin(angle);
            // Each action springs out of the + button to its spot on the arc.
            const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [-dx, 0] });
            const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [-dy, 0] });
            const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });
            return (
              <Animated.View
                key={a.key}
                style={[
                  styles.actionSlot,
                  {
                    left: fabCenter.x + dx - ACTION_WIDTH / 2,
                    top: fabCenter.y + dy - ACTION_HEIGHT / 2,
                    opacity: anim,
                    transform: [{ translateX }, { translateY }, { scale }],
                  },
                ]}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={a.label}
                  onPress={() => closeMenu(() => navigation.getParent()?.navigate(a.key))}
                  style={({ pressed }) => [styles.action, { backgroundColor: t.surface, borderColor: t.border, shadowColor: t.shadow, opacity: pressed ? 0.85 : 1 }]}
                >
                  <a.icon size={21} color={t.textMuted} strokeWidth={1.8} />
                  <Txt size={10.5} weight="medium" color={t.textMuted} style={{ marginTop: 3 }}>
                    {a.label}
                  </Txt>
                </Pressable>
              </Animated.View>
            );
          })}
        </View>
      )}

      <View
        onLayout={(e) => setBar({ y: e.nativeEvent.layout.y, width: e.nativeEvent.layout.width })}
        style={[styles.bar, { backgroundColor: t.surface, borderTopColor: t.border, paddingBottom: Math.max(insets.bottom, 10) }]}
      >
        {/* The + button sits in the middle: first half of the tabs before it, the rest after. */}
        {state.routes.slice(0, half).map((_, i) => renderTab(i))}
        <View style={styles.fabSlot}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={open ? "Close menu" : "Create"}
            accessibilityState={{ expanded: open }}
            onPress={() => (open ? closeMenu() : openMenu())}
            style={({ pressed }) => [styles.fabShadow, { shadowColor: t.primary, opacity: pressed ? 0.85 : 1 }]}
          >
            <LinearGradient colors={t.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fab}>
              <Plus size={26} color={t.onPrimary} strokeWidth={2.4} />
            </LinearGradient>
          </Pressable>
        </View>
        {state.routes.slice(half).map((_, i) => renderTab(half + i))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "flex-start", borderTopWidth: StyleSheet.hairlineWidth, paddingTop: BAR_PADDING_TOP },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 2 },
  fabSlot: { flex: 1, alignItems: "center" },
  fabShadow: { marginTop: -FAB_LIFT, borderRadius: 18, shadowOpacity: 0.45, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  fab: { width: FAB_SIZE, height: FAB_SIZE, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  actionSlot: { position: "absolute", width: ACTION_WIDTH, height: ACTION_HEIGHT },
  action: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
