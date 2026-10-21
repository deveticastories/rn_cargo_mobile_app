/**
 * Colour tokens for the two themes in the design: a cool off-white light
 * theme with deep-teal accents, and a near-black dark theme with sky-blue
 * accents. Screens never hard-code colours — they read these via `useTheme()`.
 */

export type Tone = "success" | "warning" | "danger" | "purple" | "info" | "neutral";

export interface Palette {
  isDark: boolean;
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textSoft: string;
  primary: string;
  primaryStrong: string;
  onPrimary: string;
  primarySoft: string;
  code: string;
  chipActiveBg: string;
  chipActiveText: string;
  gradient: [string, string];
  heroGradient: [string, string];
  loginGradient: [string, string];
  overlay: string;
  shadow: string;
  tones: Record<Tone, { bg: string; fg: string }>;
}

export const light: Palette = {
  isDark: false,
  bg: "#EEF3F6",
  surface: "#FFFFFF",
  surfaceAlt: "#F2F6F8",
  border: "#DCE4E9",
  borderStrong: "#C7D3DA",
  text: "#0D1B24",
  textMuted: "#5C6D78",
  textSoft: "#8C9AA4",
  primary: "#0B6782",
  primaryStrong: "#074C61",
  onPrimary: "#FFFFFF",
  primarySoft: "#DCEFF6",
  code: "#0B6782",
  chipActiveBg: "#0D1B24",
  chipActiveText: "#FFFFFF",
  gradient: ["#0E7491", "#074C61"],
  heroGradient: ["#123F50", "#0A2531"],
  loginGradient: ["#0F4A5E", "#0A2733"],
  overlay: "rgba(8, 20, 26, 0.45)",
  shadow: "#0B2733",
  tones: {
    success: { bg: "#DDF3E4", fg: "#1D7A42" },
    warning: { bg: "#FDEBCF", fg: "#A15C07" },
    danger: { bg: "#FCE2DF", fg: "#B3261E" },
    purple: { bg: "#ECE8FB", fg: "#5A48B4" },
    info: { bg: "#DCEFF6", fg: "#0B6782" },
    neutral: { bg: "#EEF2F4", fg: "#4D5E69" },
  },
};

export const dark: Palette = {
  isDark: true,
  bg: "#0A1216",
  surface: "#0F1A1F",
  surfaceAlt: "#152229",
  border: "#1E2F37",
  borderStrong: "#2A3E47",
  text: "#EAF1F4",
  textMuted: "#8D9EA7",
  textSoft: "#62747E",
  primary: "#5BB3D5",
  primaryStrong: "#3D96B9",
  onPrimary: "#06222D",
  primarySoft: "#12303C",
  code: "#5BB3D5",
  chipActiveBg: "#5BB3D5",
  chipActiveText: "#06222D",
  gradient: ["#67BEDD", "#3C93B5"],
  heroGradient: ["#123F50", "#0B1E26"],
  loginGradient: ["#0F4A5E", "#0A1C24"],
  overlay: "rgba(0, 0, 0, 0.6)",
  shadow: "#000000",
  tones: {
    success: { bg: "#12301F", fg: "#5DD08A" },
    warning: { bg: "#3A2A10", fg: "#F2B256" },
    danger: { bg: "#3A1717", fg: "#F2827A" },
    purple: { bg: "#2A2546", fg: "#A99CF0" },
    info: { bg: "#12303C", fg: "#5BB3D5" },
    neutral: { bg: "#18262D", fg: "#9FB0B9" },
  },
};

/** A stable avatar tone per name, so the same person always gets the same colour. */
export function toneForName(name: string): Tone {
  const tones: Tone[] = ["info", "warning", "purple", "success"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return tones[h % tones.length];
}
