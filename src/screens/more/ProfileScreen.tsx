/** Profile (Pickup role's last tab) — who's signed in, appearance and log out. */
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Constants from "expo-constants";
import { LogOut } from "lucide-react-native";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Badge, Card, IconTile, SectionTitle } from "@/components/primitives";
import { LargeHeader, Screen } from "@/components/Screen";
import { Segmented } from "@/components/Segmented";
import { Txt } from "@/components/Txt";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { logout } from "@/store/slices/authSlice";
import { setThemePreference } from "@/store/slices/uiSlice";
import { useTheme } from "@/theme/ThemeProvider";
import type { ThemePreference } from "@/types";
import { initials } from "@/utils/format";

export function ProfileScreen() {
  const t = useTheme();
  const dispatch = useAppDispatch();
  const { name, email, role } = useCurrentUser();
  const themePreference = useAppSelector((s) => s.ui.themePreference);
  const version = Constants.expoConfig?.version ?? "1.0.0";
  const [logoutOpen, setLogoutOpen] = useState(false);

  return (
    <Screen>
      <LargeHeader title="Profile" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Same profile card as the More screen. */}
        <Card style={styles.profile}>
          <LinearGradient colors={t.gradient} style={styles.avatar}>
            <Txt size={20} weight="bold" color={t.onPrimary}>
              {initials(name)}
            </Txt>
          </LinearGradient>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Txt size={16} weight="bold">
              {name}
            </Txt>
            <Txt size={13} muted numberOfLines={1}>
              {email}
            </Txt>
            <View style={{ marginTop: 6 }}>
              <Badge label={role} tone="purple" size="sm" />
            </View>
          </View>
        </Card>

        <SectionTitle title="Appearance" />
        <Segmented
          options={["system", "light", "dark"] as const}
          labels={{ system: "System", light: "Light", dark: "Dark" }}
          value={themePreference}
          onChange={(v: ThemePreference) => dispatch(setThemePreference(v))}
        />

        <SectionTitle title="Account" />
        <Card padded={false}>
          <Pressable onPress={() => setLogoutOpen(true)} style={({ pressed }) => [styles.row, pressed && { backgroundColor: t.surfaceAlt }]}>
            <IconTile icon={LogOut} tone="danger" size={36} />
            <Txt size={15} weight="semibold" color={t.tones.danger.fg} style={{ flex: 1, marginLeft: 12 }}>
              Log out
            </Txt>
          </Pressable>
        </Card>
        <Txt size={11.5} soft align="center" style={{ marginTop: 14 }}>
          Cargo Admin v{version}
        </Txt>
      </ScrollView>

      <ConfirmDialog
        visible={logoutOpen}
        icon={LogOut}
        title="Log out?"
        message="You'll need your email and password to sign back in."
        confirmLabel="Log out"
        destructive
        onCancel={() => setLogoutOpen(false)}
        onConfirm={() => {
          setLogoutOpen(false);
          dispatch(logout());
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 14 },
});
