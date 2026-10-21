/**
 * Navigation tree (React Navigation 7):
 *
 *   Root stack
 *   ├─ Login                         (signed out)
 *   ├─ Main  → bottom tabs           (signed in)
 *   │   ├─ Home
 *   │   ├─ Bookings
 *   │   ├─ Containers
 *   │   └─ More → stack: MoreHome · Finance · MasterList
 *   ├─ BookingDetail
 *   ├─ NewBooking   (modal)
 *   └─ MasterForm   (modal)
 *
 * Which branch renders is driven by `auth.status` in Redux, so signing in,
 * signing out and session expiry all switch screens automatically.
 */
import React, { useEffect, useMemo } from "react";
import { View } from "react-native";
import { DarkTheme, DefaultTheme, NavigationContainer, type Theme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { sessionExpired } from "@/store/slices/authSlice";
import { useTheme } from "@/theme/ThemeProvider";
import { msUntilExpiry } from "@/utils/jwt";
import { useBootstrapData } from "@/hooks/useBootstrapData";
import { LoginScreen } from "@/screens/auth/LoginScreen";
import { DashboardScreen } from "@/screens/dashboard/DashboardScreen";
import { BookingsScreen } from "@/screens/bookings/BookingsScreen";
import { BookingDetailScreen } from "@/screens/bookings/BookingDetailScreen";
import { NewBookingScreen } from "@/screens/bookings/NewBookingScreen";
import { ContainersScreen } from "@/screens/containers/ContainersScreen";
import { FinanceScreen } from "@/screens/finance/FinanceScreen";
import { MoreScreen } from "@/screens/more/MoreScreen";
import { MasterListScreen } from "@/screens/masters/MasterListScreen";
import { MasterFormScreen } from "@/screens/masters/MasterFormScreen";
import { TabBar } from "./TabBar";
import type { MainTabParamList, MoreStackParamList, RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();
const MoreStack = createNativeStackNavigator<MoreStackParamList>();

function MoreNavigator() {
  const t = useTheme();
  return (
    <MoreStack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
      <MoreStack.Screen name="MoreHome" component={MoreScreen} />
      <MoreStack.Screen name="Finance" component={FinanceScreen} />
      <MoreStack.Screen name="MasterList" component={MasterListScreen} />
    </MoreStack.Navigator>
  );
}

/** Signs the user out the moment their JWT expires, even if the app is just sitting open. */
function useSessionTimer() {
  const dispatch = useAppDispatch();
  const token = useAppSelector((s) => s.auth.token);
  useEffect(() => {
    if (!token) return;
    const ms = msUntilExpiry(token);
    if (!Number.isFinite(ms)) return;
    // setTimeout overflows above ~24.8 days; cargo-backend tokens last a day anyway.
    const timer = setTimeout(() => dispatch(sessionExpired()), Math.min(ms, 2_000_000_000));
    return () => clearTimeout(timer);
  }, [token, dispatch]);
}

function MainTabs() {
  useBootstrapData();
  useSessionTimer();
  return (
    <Tabs.Navigator tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="Home" component={DashboardScreen} />
      <Tabs.Screen name="Bookings" component={BookingsScreen} />
      <Tabs.Screen name="Containers" component={ContainersScreen} />
      {/* Leaving the tab resets its stack, so tapping More again lands on the More screen. */}
      <Tabs.Screen name="More" component={MoreNavigator} options={{ popToTopOnBlur: true }} />
    </Tabs.Navigator>
  );
}

export function RootNavigator() {
  const t = useTheme();
  const status = useAppSelector((s) => s.auth.status);

  const navTheme: Theme = useMemo(() => {
    const base = t.isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: t.primary,
        background: t.bg,
        card: t.surface,
        text: t.text,
        border: t.border,
        notification: t.tones.danger.fg,
      },
    };
  }, [t]);

  // The animated splash (App.tsx) covers the app while the saved session is read.
  if (status === "restoring") return <View style={{ flex: 1, backgroundColor: t.bg }} />;

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style={t.isDark ? "light" : "dark"} />
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
        {status === "authenticated" ? (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="BookingDetail" component={BookingDetailScreen} />
            <Stack.Screen
              name="NewBooking"
              component={NewBookingScreen}
              options={{ presentation: "fullScreenModal", animation: "slide_from_bottom", gestureEnabled: false }}
            />
            <Stack.Screen name="MasterForm" component={MasterFormScreen} options={{ presentation: "modal" }} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} options={{ animationTypeForReplace: "pop" }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
