/**
 * Launch animation shown over the app while fonts load and the saved session is restored.
 * The native splash is a plain SPLASH_BG screen with no logo (app.json uses a transparent image),
 * so this starts on the same colour, brings in the gradient and logo, and fades out once `ready`.
 */
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, StyleSheet, View, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import Svg, { G, Path } from "react-native-svg";
import { useTheme } from "@/theme/ThemeProvider";
import { Txt } from "./Txt";

const MIN_VISIBLE_MS = 1600;
/** Must match expo-splash-screen's backgroundColor in app.json (and android colors.xml). */
const SPLASH_BG = "#0D3949";
const ICON = 113;
const TILE = 132;

export function AnimatedSplash({ ready, onFinish }: { ready: boolean; onFinish: () => void }) {
  const t = useTheme();
  const { width, height } = useWindowDimensions();
  const [shownAt, setShownAt] = useState<number | null>(null);

  const intro = useRef(new Animated.Value(0)).current; // background wash + logo tile
  const text = useRef(new Animated.Value(0)).current; // title, tagline, arc, footer
  const pulse = useRef(new Animated.Value(0)).current; // looping rings
  const exit = useRef(new Animated.Value(0)).current;

  const start = () => {
    if (shownAt !== null) return;
    setShownAt(Date.now());
    void SplashScreen.hideAsync();
    Animated.sequence([
      Animated.timing(intro, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(text, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 2200, easing: Easing.out(Easing.quad), useNativeDriver: true })).start();
  };

  useEffect(() => {
    if (!ready || shownAt === null) return;
    const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - shownAt));
    const timer = setTimeout(() => {
      Animated.timing(exit, { toValue: 1, duration: 420, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
        if (finished) onFinish();
      });
    }, wait);
    return () => clearTimeout(timer);
  }, [ready, shownAt, exit, onFinish]);

  const rise = (from: number, delay = 0) => ({
    opacity: text.interpolate({ inputRange: [delay, 1], outputRange: [0, 1], extrapolate: "clamp" }),
    transform: [{ translateY: text.interpolate({ inputRange: [delay, 1], outputRange: [from, 0], extrapolate: "clamp" }) }],
  });
  const ring = (offset: number) => {
    const p = Animated.modulo(Animated.add(pulse, offset), 1);
    return {
      opacity: Animated.multiply(p.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }), intro),
      transform: [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [1, 2.3] }) }],
    };
  };

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        styles.root,
        { backgroundColor: SPLASH_BG },
        { opacity: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) },
        { transform: [{ scale: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }] },
      ]}
      onLayout={start}
      pointerEvents={ready ? "none" : "auto"}
    >
      <StatusBar style="light" />
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: intro }]}>
        <LinearGradient colors={t.loginGradient} style={StyleSheet.absoluteFill} />
      </Animated.View>

      {/* Dashed voyage arc, as on the sign-in screen */}
      {/* <Animated.View style={[styles.arc, { width }, rise(12, 0.2)]} pointerEvents="none">
        <Svg width={width} height={width * 0.63} viewBox="0 0 200 126" preserveAspectRatio="none">
          <G opacity={0.22}>
            <Path d="M10.5 105C63 21 147 21 199.5 73.5" fill="none" stroke="white" strokeWidth={1.4} strokeLinecap="round" strokeDasharray="3 4.5" />
            <Path d="M10.5 108.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" fill="white" />
            <Path d="M199.5 77a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" fill="white" />
          </G>
        </Svg>
      </Animated.View> */}

      <View style={[styles.logoWrap, { top: height / 2 - TILE / 2, left: width / 2 - TILE / 2 }]}>
          {[0, 0.5].map((o) => (
            <Animated.View key={o} style={[styles.ring, ring(o)]} />
          ))}
          {/* Logo tile pops in: fades up from 60% size with a slight overshoot. */}
          <Animated.View
            style={[
              styles.tile,
              {
                opacity: intro,
                transform: [{ scale: intro.interpolate({ inputRange: [0, 0.75, 1], outputRange: [0.6, 1.06, 1] }) }],
              },
            ]}
          >
            <Image source={require("../../assets/splash-icon.png")} style={{ width: ICON, height: ICON }} resizeMode="contain" />
          </Animated.View>
      </View>

      <View style={[styles.titleBlock, { top: height / 2 + TILE / 2 + 34 }]}>
        <Animated.View style={rise(18)}>
          <Txt size={32} weight="bold" color="#FFFFFF">
            Cargo Admin
          </Txt>
        </Animated.View>
        <Animated.View style={rise(14, 0.35)}>
          <Txt size={14.5} color="rgba(255,255,255,0.72)" style={{ marginTop: 6 }}>
            Kochi ⇄ UAE shipments, anywhere.
          </Txt>
        </Animated.View>
      </View>

      <Animated.View style={[styles.footer, rise(10, 0.55)]}>
        <Txt size={11} weight="semibold" color="rgba(255,255,255,0.45)" style={{ letterSpacing: 3 }}>
          INTROLINES
        </Txt>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 100, elevation: 100 },
  logoWrap: { position: "absolute", width: TILE, height: TILE, alignItems: "center", justifyContent: "center" },
  titleBlock: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  tile: { ...StyleSheet.absoluteFillObject, borderRadius: 34, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", width: TILE, height: TILE, borderRadius: 40, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.55)" },
  arc: { position: "absolute", top: "18%", left: 0 },
  footer: { position: "absolute", bottom: 48, left: 0, right: 0, alignItems: "center" },
});
