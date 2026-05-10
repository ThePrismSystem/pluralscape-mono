import { type ReactElement, type ReactNode } from "react";
import { Pressable, type PressableProps, StyleSheet, Text } from "react-native";

import { type Theme, useTheme } from "../theme";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg";

const SIZING = {
  md: { paddingV: 10, paddingH: 16, fontSize: 14 },
  lg: { paddingV: 14, paddingH: 20, fontSize: 16 },
} as const;

const PRESSED_OPACITY = 0.85;
const TRANSPARENT = "transparent";

export interface ButtonProps extends Omit<PressableProps, "style" | "children"> {
  readonly children: ReactNode;
  readonly variant?: Variant;
  readonly size?: Size;
  readonly fullWidth?: boolean;
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  fullWidth,
  disabled,
  accessibilityLabel,
  ...rest
}: ButtonProps): ReactElement {
  const theme = useTheme();
  const styles = makeStyles(theme, variant, size, fullWidth ?? false);
  return (
    <Pressable
      role="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: disabled ?? false }}
      disabled={disabled}
      style={({ pressed }) => [styles.base, pressed && styles.pressed]}
      {...rest}
    >
      <Text style={styles.label}>{children}</Text>
    </Pressable>
  );
}

function makeStyles(theme: Theme, variant: Variant, size: Size, fullWidth: boolean) {
  const sizing = SIZING[size];

  const palette = {
    primary: { bg: theme.color.accent, fg: theme.color.fgOnAccent, border: TRANSPARENT },
    secondary: { bg: TRANSPARENT, fg: theme.color.fg, border: theme.color.borderStrong },
    ghost: { bg: TRANSPARENT, fg: theme.color.fgMuted, border: TRANSPARENT },
    danger: { bg: theme.color.danger, fg: theme.color.fgOnAccent, border: TRANSPARENT },
  }[variant];

  return StyleSheet.create({
    base: {
      backgroundColor: palette.bg,
      borderColor: palette.border,
      borderWidth: variant === "secondary" ? 1 : 0,
      borderRadius: theme.radius.md,
      paddingVertical: sizing.paddingV,
      paddingHorizontal: sizing.paddingH,
      alignItems: "center",
      justifyContent: "center",
      width: fullWidth ? "100%" : undefined,
      minHeight: theme.hit.min,
    },
    pressed: { opacity: PRESSED_OPACITY },
    label: {
      color: palette.fg,
      fontFamily: theme.font.sans,
      fontSize: sizing.fontSize,
      fontWeight: "500",
    },
  });
}
