import { type ReactElement } from "react";
import { Pressable, type PressableProps, StyleSheet } from "react-native";

import { type Theme, useTheme } from "../theme";

import { Icon, type IconName } from "./Icon";

type Tone = "default" | "muted" | "danger";

const DEFAULT_SIZE = 22;
const FULL_RADIUS = 9999;
const PRESSED_BG = "rgba(232,228,240,0.08)";

export interface IconButtonProps extends Omit<PressableProps, "style" | "accessibilityLabel"> {
  readonly name: IconName;
  readonly accessibilityLabel: string;
  readonly size?: number;
  readonly tone?: Tone;
}

export function IconButton({
  name,
  accessibilityLabel,
  size = DEFAULT_SIZE,
  tone = "default",
  disabled,
  ...rest
}: IconButtonProps): ReactElement {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const color = {
    default: theme.color.fg,
    muted: theme.color.fgMuted,
    danger: theme.color.danger,
  }[tone];
  return (
    <Pressable
      role="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: disabled ?? false }}
      disabled={disabled}
      style={({ pressed }) => [styles.base, pressed && styles.pressed]}
      {...rest}
    >
      <Icon name={name} size={size} color={color} />
    </Pressable>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    base: {
      minWidth: theme.hit.min,
      minHeight: theme.hit.min,
      borderRadius: FULL_RADIUS,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "transparent",
    },
    pressed: { backgroundColor: PRESSED_BG },
  });
}
