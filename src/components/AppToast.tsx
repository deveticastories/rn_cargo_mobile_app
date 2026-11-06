/**
 * App-wide notification banner: `showToast` can be called from anywhere and slides a themed
 * banner down from the top of the screen, from the one `ToastHost` mounted in App.tsx.
 * It hides itself after a few seconds, or when tapped. A new toast replaces the current one.
 * A dialog can mount its own host (`inModal`); the newest mounted host shows the toasts.
 */
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FullWindowOverlay } from "react-native-screens";
import { CircleCheck, Info, TriangleAlert } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import type { Tone } from "@/theme/palette";
import { Txt } from "./Txt";

const VISIBLE_MS = 3500;

type ToastRequest = { title: string; message?: string; tone: Tone; id: number };

const hosts: ((toast: ToastRequest) => void)[] = [];
let nextId = 1;

export function showToast(title: string, message?: string, tone: Tone = "info"): void {
  hosts[hosts.length - 1]?.({ title, message, tone, id: nextId++ });
}

export function showErrorToast(title: string, message?: string): void {
  showToast(title, message, "danger");
}

/** `inModal`: mounted inside a dialog's Modal, so it already sits above everything. */
export function ToastHost({ inModal }: { inModal?: boolean } = {}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastRequest | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    Animated.timing(anim, { toValue: 0, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
      if (finished) setToast(null);
    });
  };

  useEffect(() => {
    const host = (next: ToastRequest) => setToast(next);
    hosts.push(host);
    return () => {
      const i = hosts.indexOf(host);
      if (i >= 0) hosts.splice(i, 1);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    timer.current = setTimeout(hide, VISIBLE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast?.id]);

  if (!toast) return null;
  const c = t.tones[toast.tone];
  const Icon = toast.tone === "success" ? CircleCheck : toast.tone === "danger" || toast.tone === "warning" ? TriangleAlert : Info;

  const banner = (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { paddingTop: insets.top + 8 }]}>
      <Animated.View
        style={{
          marginHorizontal: 16,
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] }) }],
        }}
      >
        <Pressable
          onPress={hide}
          accessibilityRole="alert"
          style={[styles.banner, { backgroundColor: c.bg, borderColor: c.fg, shadowColor: t.shadow }]}
        >
          <View style={[styles.icon, { backgroundColor: c.fg }]}>
            <Icon size={18} color={c.bg} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt size={14} weight="semibold" color={c.fg}>
              {toast.title}
            </Txt>
            {toast.message ? (
              <Txt size={12.5} color={t.text} style={{ marginTop: 2 }}>
                {toast.message}
              </Txt>
            ) : null}
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );

  // On iOS the banner has to sit above natively presented (modal) screens.
  return Platform.OS === "ios" && !inModal ? <FullWindowOverlay>{banner}</FullWindowOverlay> : banner;
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  icon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
});
