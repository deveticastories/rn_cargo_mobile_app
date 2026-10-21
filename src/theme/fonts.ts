/**
 * Space Grotesk for UI text and figures, JetBrains Mono for record codes
 * (BKG-0248, CTN-0006, INV-0146) — matching the design. Custom fonts can't be
 * bolded with `fontWeight` on Android, so weights map to separate families.
 */
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from "@expo-google-fonts/space-grotesk";
import { JetBrainsMono_500Medium, JetBrainsMono_600SemiBold } from "@expo-google-fonts/jetbrains-mono";

export const fontAssets = {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
};

export const fonts = {
  regular: "SpaceGrotesk_400Regular",
  medium: "SpaceGrotesk_500Medium",
  semibold: "SpaceGrotesk_600SemiBold",
  bold: "SpaceGrotesk_700Bold",
  mono: "JetBrainsMono_500Medium",
  monoBold: "JetBrainsMono_600SemiBold",
} as const;

export type FontWeight = "regular" | "medium" | "semibold" | "bold";

export const radius = { sm: 10, md: 14, lg: 18, xl: 24, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;
