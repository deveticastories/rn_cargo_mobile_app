/**
 * Everything the app keeps on the device, in AsyncStorage:
 *  - the cargo-backend JWT and the signed-in user (only when "Keep me signed in" is ticked)
 *  - the appearance preference (system / light / dark)
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AuthUser, ThemePreference } from "@/types";

const KEYS = {
  token: "@cargo/token",
  user: "@cargo/user",
  theme: "@cargo/theme",
  lastEmail: "@cargo/last-email",
} as const;

export async function saveSession(token: string, user: AuthUser): Promise<void> {
  await AsyncStorage.multiSet([
    [KEYS.token, token],
    [KEYS.user, JSON.stringify(user)],
  ]);
}

export async function loadSession(): Promise<{ token: string | null; user: AuthUser | null }> {
  const entries = await AsyncStorage.multiGet([KEYS.token, KEYS.user]);
  const map = Object.fromEntries(entries) as Record<string, string | null>;
  let user: AuthUser | null = null;
  try {
    user = map[KEYS.user] ? (JSON.parse(map[KEYS.user] as string) as AuthUser) : null;
  } catch {
    user = null;
  }
  return { token: map[KEYS.token] ?? null, user };
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.multiRemove([KEYS.token, KEYS.user]);
}

export async function saveLastEmail(email: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.lastEmail, email);
}

export async function loadLastEmail(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.lastEmail);
}

export async function saveThemePreference(pref: ThemePreference): Promise<void> {
  await AsyncStorage.setItem(KEYS.theme, pref);
}

export async function loadThemePreference(): Promise<ThemePreference> {
  const value = await AsyncStorage.getItem(KEYS.theme);
  return value === "light" || value === "dark" ? value : "system";
}
