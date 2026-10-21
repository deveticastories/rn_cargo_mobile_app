import React from "react";
import { Text, type TextProps, type TextStyle } from "react-native";
import { fonts, type FontWeight } from "@/theme/fonts";
import { useTheme } from "@/theme/ThemeProvider";

export interface TxtProps extends TextProps {
  size?: number;
  weight?: FontWeight;
  color?: string;
  /** JetBrains Mono — for record codes like BKG-0248. */
  mono?: boolean;
  muted?: boolean;
  soft?: boolean;
  align?: TextStyle["textAlign"];
  uppercase?: boolean;
}

/** The only text component screens use, so typography stays consistent. */
export function Txt({ size = 14, weight = "regular", color, mono, muted, soft, align, uppercase, style, ...rest }: TxtProps) {
  const t = useTheme();
  const family = mono ? (weight === "bold" || weight === "semibold" ? fonts.monoBold : fonts.mono) : fonts[weight];
  return (
    <Text
      {...rest}
      style={[
        {
          fontFamily: family,
          fontSize: size,
          lineHeight: Math.round(size * 1.3),
          color: color ?? (soft ? t.textSoft : muted ? t.textMuted : t.text),
          textAlign: align,
          letterSpacing: uppercase ? 0.6 : size >= 24 ? -0.6 : 0,
          textTransform: uppercase ? "uppercase" : undefined,
        },
        style,
      ]}
    />
  );
}
