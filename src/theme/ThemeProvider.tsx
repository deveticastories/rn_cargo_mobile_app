/**
 * Resolves the active palette from the user's appearance preference (kept in
 * Redux + AsyncStorage) and the OS colour scheme.
 */
import React, { createContext, useContext, useMemo } from "react";
import { useColorScheme } from "react-native";
import { useAppSelector } from "@/store/hooks";
import { dark, light, type Palette } from "./palette";

const ThemeContext = createContext<Palette>(light);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const preference = useAppSelector((s) => s.ui.themePreference);
  const palette = useMemo(() => {
    const mode = preference === "system" ? (scheme === "dark" ? "dark" : "light") : preference;
    return mode === "dark" ? dark : light;
  }, [preference, scheme]);
  return <ThemeContext.Provider value={palette}>{children}</ThemeContext.Provider>;
}

export const useTheme = (): Palette => useContext(ThemeContext);

/** `const styles = useStyles(makeStyles)` — rebuilds a StyleSheet only when the theme changes. */
export function useStyles<T>(factory: (t: Palette) => T): T {
  const t = useTheme();
  return useMemo(() => factory(t), [t, factory]);
}
