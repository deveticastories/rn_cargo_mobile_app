/** 01 · Sign in — gradient hero, session-expiry notice, focused field state. */
import React, { useEffect, useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { G, Path } from "react-native-svg";
import { ArrowRight, Check, Lock, Mail, Ship } from "lucide-react-native";
import { Button } from "@/components/Button";
import { Notice } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { Txt } from "@/components/Txt";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { clearAuthError, login } from "@/store/slices/authSlice";
import { useTheme } from "@/theme/ThemeProvider";

/** Where the arc's start dot sits, relative to the screen's left edge and the top of the title block. */
const ARC_START = { x: 171, y: 107 };
const HERO_PADDING = 24;

/**
 * LoginBackground.svg from the design (viewBox 200×126), scaled so the start dot sits below the
 * tagline and the end dot lands on the right screen edge, half clipped as in the design.
 */
function LoginArc({ screenWidth }: { screenWidth: number }) {
  // The start (10.5) and end (199.5) dot centres are 189 units apart; the end dot sits 6pt in from the edge.
  const scale = (screenWidth - 6 - ARC_START.x) / 189;
  const dash = { stroke: "white", strokeWidth: 2.1, strokeLinecap: "round" as const, strokeDasharray: "4.2 6.3" };
  return (
    <Svg
      width={200 * scale}
      height={126 * scale}
      viewBox="0 0 200 126"
      fill="none"
      pointerEvents="none"
      style={{ position: "absolute", left: ARC_START.x - 10.5 * scale - HERO_PADDING, top: ARC_START.y - 140 * scale }}
    >
      <G opacity={0.22}>
        <Path d="M10.5 105C63 21 147 21 199.5 73.5" {...dash} />
        <Path
          d="M10.5 110.25C13.3995 110.25 15.75 107.899 15.75 105C15.75 102.101 13.3995 99.75 10.5 99.75C7.6005 99.75 5.25 102.101 5.25 105C5.25 107.899 7.6005 110.25 10.5 110.25Z"
          fill="white"
          {...dash}
        />
        <Path
          d="M199.5 78.75C202.399 78.75 204.75 76.3995 204.75 73.5C204.75 70.6005 202.399 68.25 199.5 68.25C196.601 68.25 194.25 70.6005 194.25 73.5C194.25 76.3995 196.601 78.75 199.5 78.75Z"
          fill="white"
          {...dash}
        />
      </G>
    </Svg>
  );
}

export function LoginScreen() {
  const t = useTheme();
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { loginStatus, error, sessionExpired, lastEmail } = useAppSelector((s) => s.auth);

  const [email, setEmail] = useState(lastEmail);
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);

  // Pre-fill the last signed-in email once AsyncStorage has been read.
  useEffect(() => {
    if (lastEmail) setEmail((current) => current || lastEmail);
  }, [lastEmail]);

  const submit = () => {
    setLocalError(null);
    dispatch(clearAuthError());
    if (!email.trim() || !password) {
      setLocalError("Enter your email and password.");
      return;
    }
    dispatch(login({ email, password, remember }));
  };

  const message = localError ?? error;

  return (
    <View style={{ flex: 1, backgroundColor: t.loginGradient[1] }}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" bounces={false}>
          <LinearGradient colors={t.loginGradient} style={[styles.hero, { paddingTop: insets.top + 44 }]}>
            <View style={styles.logo}>
              <Ship size={26} color="#FFFFFF" strokeWidth={1.7} />
            </View>
            <View style={{ marginTop: 22 }}>
              {/* Dashed voyage arc, Kochi → UAE: rises from below the tagline, peaks beside the title, lands at the right edge. */}
              <LoginArc screenWidth={width} />
              <Txt size={30} weight="bold" color="#FFFFFF">
                Cargo Admin
              </Txt>
              <Txt size={14} color="rgba(255,255,255,0.75)" style={{ marginTop: 4 }}>
                Kochi ⇄ UAE shipments, anywhere.
              </Txt>
            </View>
          </LinearGradient>

          <View style={[styles.sheet, { backgroundColor: t.bg, paddingBottom: insets.bottom + 24 }]}>
            <Txt size={22} weight="bold">
              Welcome back
            </Txt>
            <Txt size={14} muted style={{ marginTop: 4, marginBottom: 18 }}>
              Sign in with your admin or employee account.
            </Txt>

            {sessionExpired && !message && <Notice message="Your session expired. Please sign in again to continue." />}
            {message && <Notice message={message} tone="danger" />}

            <TextField
              label="Email"
              icon={Mail}
              value={email}
              onChangeText={setEmail}
              placeholder="you@company.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="username"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
            <TextField
              ref={passwordRef}
              label="Password"
              icon={Lock}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureToggle
              autoCapitalize="none"
              autoComplete="password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={submit}
            />

            <View style={styles.row}>
              <Pressable
                style={styles.remember}
                onPress={() => setRemember((r) => !r)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: remember }}
              >
                <View
                  style={[
                    styles.checkbox,
                    { borderColor: remember ? t.primary : t.borderStrong, backgroundColor: remember ? t.primary : "transparent" },
                  ]}
                >
                  {remember && <Check size={13} color={t.onPrimary} strokeWidth={3} />}
                </View>
                <Txt size={13.5}>Keep me signed in</Txt>
              </Pressable>
              <Pressable
                hitSlop={8}
                onPress={() =>
                  Alert.alert("Forgot password?", "Passwords are managed by your admin. Ask them to reset yours from Team on the web console.")
                }
              >
                <Txt size={13.5} weight="semibold" color={t.primary}>
                  Forgot?
                </Txt>
              </Pressable>
            </View>

            <Button title="Sign in" icon={ArrowRight} onPress={submit} loading={loginStatus === "loading"} style={{ marginTop: 22 }} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: HERO_PADDING, paddingBottom: 104, overflow: "hidden" },
  logo: {
    width: 54,
    height: 54,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  sheet: { flex: 1, marginTop: -28, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 28 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 },
  remember: { flexDirection: "row", alignItems: "center", gap: 9 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
});
