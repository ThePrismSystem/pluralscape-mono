import { type ReactElement, useCallback, useState } from "react";
import {
  type BlurEvent,
  type FocusEvent,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";

import { type Theme, useTheme } from "../theme";

const INPUT_METRICS = {
  labelFontSize: 12,
  labelLetterSpacing: 0.5,
  labelMarginBottom: 6,
  inputFontSize: 16,
  inputBorderWidth: 1,
  inputPaddingV: 10,
  inputPaddingH: 12,
  helperFontSize: 12,
  helperMarginTop: 6,
} as const;

export interface InputProps extends Omit<TextInputProps, "style"> {
  readonly label: string;
  readonly hint?: string;
  readonly error?: string;
}

export function Input({
  label,
  hint,
  error,
  onFocus,
  onBlur,
  ...rest
}: InputProps): ReactElement {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const styles = makeStyles(theme, focused, error !== undefined);

  const handleFocus = useCallback(
    (e: FocusEvent) => {
      setFocused(true);
      onFocus?.(e);
    },
    [onFocus],
  );

  const handleBlur = useCallback(
    (e: BlurEvent) => {
      setFocused(false);
      onBlur?.(e);
    },
    [onBlur],
  );

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.color.fgSubtle}
        style={styles.input}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...rest}
      />
      {error !== undefined ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint !== undefined ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

function makeStyles(theme: Theme, focused: boolean, hasError: boolean) {
  const borderColor = hasError
    ? theme.color.danger
    : focused
      ? theme.color.borderFocus
      : theme.color.borderStrong;
  return StyleSheet.create({
    label: {
      color: theme.color.fgMuted,
      fontFamily: theme.font.sans,
      fontSize: INPUT_METRICS.labelFontSize,
      fontWeight: "500",
      letterSpacing: INPUT_METRICS.labelLetterSpacing,
      marginBottom: INPUT_METRICS.labelMarginBottom,
    },
    input: {
      color: theme.color.fg,
      fontFamily: theme.font.sans,
      fontSize: INPUT_METRICS.inputFontSize,
      borderWidth: INPUT_METRICS.inputBorderWidth,
      borderColor,
      borderRadius: theme.radius.md,
      paddingVertical: INPUT_METRICS.inputPaddingV,
      paddingHorizontal: INPUT_METRICS.inputPaddingH,
      minHeight: theme.hit.min,
      backgroundColor: theme.color.surface,
    },
    error: {
      color: theme.color.danger,
      fontFamily: theme.font.sans,
      fontSize: INPUT_METRICS.helperFontSize,
      marginTop: INPUT_METRICS.helperMarginTop,
    },
    hint: {
      color: theme.color.fgSubtle,
      fontFamily: theme.font.sans,
      fontSize: INPUT_METRICS.helperFontSize,
      marginTop: INPUT_METRICS.helperMarginTop,
    },
  });
}
