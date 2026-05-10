import { type ReactElement, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { type Theme, useTheme } from "../theme";

type Tone = "success" | "intimate" | "warning" | "danger" | "neutral";

const BADGE_METRICS = {
  paddingV: 2,
  paddingH: 8,
  fontSize: 12,
  letterSpacing: 0.2,
} as const;

export interface BadgeProps {
  readonly children: ReactNode;
  readonly tone?: Tone;
}

export function Badge({ children, tone = "neutral" }: BadgeProps): ReactElement {
  const theme = useTheme();
  const styles = makeStyles(theme, tone);
  return (
    <View style={styles.base}>
      <Text style={styles.label}>{children}</Text>
    </View>
  );
}

function makeStyles(theme: Theme, tone: Tone) {
  const colors = {
    success: { bg: theme.color.success, fg: theme.color.fgOnAccent },
    intimate: { bg: theme.color.intimate, fg: theme.color.fgOnAccent },
    warning: { bg: theme.color.warning, fg: theme.color.fgOnAccent },
    danger: { bg: theme.color.danger, fg: theme.color.fgOnAccent },
    neutral: { bg: theme.color.surface, fg: theme.color.fg },
  }[tone];

  return StyleSheet.create({
    base: {
      backgroundColor: colors.bg,
      paddingVertical: BADGE_METRICS.paddingV,
      paddingHorizontal: BADGE_METRICS.paddingH,
      borderRadius: theme.radius.sm,
      alignSelf: "flex-start",
    },
    label: {
      color: colors.fg,
      fontFamily: theme.font.sans,
      fontSize: BADGE_METRICS.fontSize,
      fontWeight: "500",
      letterSpacing: BADGE_METRICS.letterSpacing,
    },
  });
}
