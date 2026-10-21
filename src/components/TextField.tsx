import React, { forwardRef, useState } from "react";
import { Platform, Pressable, StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { Eye, EyeOff } from "lucide-react-native";
import { fonts, radius } from "@/theme/fonts";
import { useTheme } from "@/theme/ThemeProvider";
import { Txt } from "./Txt";

type IconType = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

interface TextFieldProps extends TextInputProps {
  label?: string;
  icon?: IconType;
  hint?: string;
  error?: string | null;
  /** Adds an eye toggle for password fields. */
  secureToggle?: boolean;
}

/** Labelled input with the design's focus ring (accent border + soft glow). */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, icon: Icon, hint, error, secureToggle, secureTextEntry, style, onFocus, onBlur, ...rest },
  ref
) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const borderColor = error ? t.tones.danger.fg : focused ? t.primary : t.border;

  return (
    <View style={styles.wrap}>
      {label && (
        <Txt size={13} weight="semibold" style={styles.label}>
          {label}
        </Txt>
      )}
      <View
        style={[
          styles.box,
          { borderColor, backgroundColor: t.isDark ? t.surfaceAlt : t.surface },
          // Only colours may change on focus. On Android (new architecture) toggling border width or shadow
          // props rebuilds the native views, the input is detached and loses focus before the keyboard opens.
          focused && Platform.OS === "ios" && { shadowColor: t.primary, shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
        ]}
      >
        {Icon && <Icon size={18} color={t.textMuted} strokeWidth={1.8} />}
        <TextInput
          ref={ref}
          placeholderTextColor={t.textSoft}
          selectionColor={t.primary}
          secureTextEntry={secureToggle ? hidden : secureTextEntry}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, { color: t.text, fontFamily: fonts.medium }, style]}
          {...rest}
        />
        {secureToggle && (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={10} accessibilityLabel={hidden ? "Show password" : "Hide password"}>
            {hidden ? <Eye size={18} color={t.textMuted} /> : <EyeOff size={18} color={t.textMuted} />}
          </Pressable>
        )}
      </View>
      {(error || hint) && (
        <Txt size={12} color={error ? t.tones.danger.fg : t.textMuted} style={{ marginTop: 6 }}>
          {error || hint}
        </Txt>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: { marginBottom: 7 },
  box: { flexDirection: "row", alignItems: "center", gap: 10, height: 50, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: 14 },
  input: { flex: 1, fontSize: 15, paddingVertical: 0, height: "100%" },
});
