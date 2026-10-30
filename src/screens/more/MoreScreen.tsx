/** 08 · More — profile, masters grid, operations shortcuts, appearance, sign out. */
import React, { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Constants from "expo-constants";
import { ArrowLeftRight, ChartColumn, ChevronRight, LogOut, Repeat, Ship } from "lucide-react-native";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Badge, Card, IconTile, SectionTitle } from "@/components/primitives";
import { LargeHeader, Screen } from "@/components/Screen";
import { Segmented } from "@/components/Segmented";
import { Txt } from "@/components/Txt";
import { MASTERS, MASTER_GRID } from "@/features/masters/config";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useTabScrollReset } from "@/hooks/useTabScrollReset";
import type { MoreScreenProps } from "@/navigation/types";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectBookingStats } from "@/store/selectors";
import { logout, selectFinanceMode } from "@/store/slices/authSlice";
import { setThemePreference } from "@/store/slices/uiSlice";
import type { Tone } from "@/theme/palette";
import { useTheme } from "@/theme/ThemeProvider";
import type { ThemePreference } from "@/types";
import { initials } from "@/utils/format";

type IconType = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

export function MoreScreen({ navigation }: MoreScreenProps<"MoreHome">) {
  const t = useTheme();
  const dispatch = useAppDispatch();
  const { name, email, role } = useCurrentUser();
  const themePreference = useAppSelector((s) => s.ui.themePreference);
  const financeMode = useAppSelector(selectFinanceMode);
  const pendingPickups = useAppSelector(
    (s) => s.masters.pickupAssigns.items.filter((a) => a.pickupStatus !== "Collected" && a.status !== false).length
  );
  const repacking = useAppSelector(selectBookingStats).counts.repacking;
  const version = Constants.expoConfig?.version ?? "1.0.0";
  const scrollRef = useRef<ScrollView>(null);
  useTabScrollReset(scrollRef);

  const [logoutOpen, setLogoutOpen] = useState(false);
  const signOut = () => setLogoutOpen(true);

  return (
    <Screen>
      <LargeHeader title="More" />
      <ScrollView ref={scrollRef} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Profile */}
        <Card style={styles.profile}>
          <LinearGradient colors={t.gradient} style={styles.profileAvatar}>
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

        {/* Masters (finance users only need Containers) */}
        <SectionTitle title="Masters" />
        <View style={[styles.grid, financeMode && { justifyContent: "flex-start" }]}>
          {!financeMode &&
            MASTER_GRID.map((key) => {
              const def = MASTERS[key];
              return (
                <Card key={key} style={styles.gridItem} onPress={() => navigation.navigate("MasterList", { masterKey: key })}>
                  <IconTile icon={def.icon} tone={def.tone} size={38} />
                  <Txt size={12.5} weight="semibold" style={{ marginTop: 8 }} numberOfLines={1}>
                    {def.title}
                  </Txt>
                </Card>
              );
            })}
          {/* Stuffed containers are finance-mode work only. */}
          {financeMode && (
            <Card style={styles.gridItem} onPress={() => navigation.navigate("StuffedContainers")}>
              <IconTile icon={Ship} tone="info" size={38} />
              <Txt size={12.5} weight="semibold" style={{ marginTop: 8 }} numberOfLines={1}>
                Containers
              </Txt>
            </Card>
          )}
        </View>

        {/* Operations (booking work — hidden in finance mode) */}
        {!financeMode && (
          <>
            <SectionTitle title="Operations" />
            <Card padded={false}>
              <OpRow
                icon={MASTERS.pickupAssigns.icon}
                tone="info"
                label="Pickup assign"
                count={pendingPickups}
                onPress={() => navigation.navigate("MasterList", { masterKey: "pickupAssigns" })}
              />
              <OpRow
                icon={MASTERS.preBookings.icon}
                tone="purple"
                label="Pre-booking"
                onPress={() => navigation.navigate("MasterList", { masterKey: "preBookings" })}
              />
              <OpRow
                icon={Repeat}
                tone="warning"
                label="Repacking"
                count={repacking}
                onPress={() => navigation.navigate("Bookings", { filter: "packingList" })}
              />
              <OpRow
                icon={ArrowLeftRight}
                tone="success"
                label="Ready to stuff"
                onPress={() => navigation.navigate("Bookings", { filter: "readyToStuff" })}
                last
              />
            </Card>
          </>
        )}

        {/* Appearance */}
        <SectionTitle title="Appearance" />
        <Segmented
          options={["system", "light", "dark"] as const}
          labels={{ system: "System", light: "Light", dark: "Dark" }}
          value={themePreference}
          onChange={(v: ThemePreference) => dispatch(setThemePreference(v))}
        />

        {/* Account */}
        <SectionTitle title="Account" />
        <Card padded={false}>
          <OpRow icon={ChartColumn} tone="info" label="Reports" onPress={() => navigation.navigate("Finance")} />
          <OpRow icon={LogOut} tone="danger" label="Log out" onPress={signOut} destructive last />
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
      >
        <View style={[styles.account, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}>
          <LinearGradient colors={t.gradient} style={styles.accountAvatar}>
            <Txt size={13} weight="bold" color={t.onPrimary}>
              {initials(name)}
            </Txt>
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Txt size={14} weight="semibold" numberOfLines={1}>
              {name}
            </Txt>
            <Txt size={12.5} muted numberOfLines={1}>
              {email}
            </Txt>
          </View>
        </View>
      </ConfirmDialog>
    </Screen>
  );
}

function OpRow({
  icon,
  tone,
  label,
  count,
  onPress,
  last,
  destructive,
}: {
  icon: IconType;
  tone: Tone;
  label: string;
  count?: number;
  onPress: () => void;
  last?: boolean;
  /** Red label and no chevron, e.g. "Log out". */
  destructive?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.opRow,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: t.border },
        pressed && { backgroundColor: t.surfaceAlt },
      ]}
    >
      <IconTile icon={icon} tone={tone} size={36} />
      <Txt size={15} weight="semibold" color={destructive ? t.tones.danger.fg : undefined} style={{ flex: 1, marginLeft: 12 }}>
        {label}
      </Txt>
      {count ? (
        <View style={[styles.count, { backgroundColor: t.tones.warning.bg }]}>
          <Txt size={12} weight="bold" color={t.tones.warning.fg}>
            {count}
          </Txt>
        </View>
      ) : null}
      {!destructive && <ChevronRight size={18} color={t.textMuted} style={{ marginLeft: 8 }} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: "row", alignItems: "center" },
  profileAvatar: { width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10 },
  gridItem: { width: "31.5%", alignItems: "center", paddingVertical: 16, paddingHorizontal: 6 },
  opRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 14 },
  count: { minWidth: 24, height: 24, paddingHorizontal: 7, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  account: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    alignSelf: "stretch",
    marginTop: 16,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  accountAvatar: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
});
