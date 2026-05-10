import { type ReactElement } from "react";
import { Switch as RNSwitch, type SwitchProps as RNSwitchProps } from "react-native";

import { useTheme } from "../theme";

export interface SwitchProps extends RNSwitchProps {
  readonly accessibilityLabel: string;
}

export function Switch({ accessibilityLabel, value, ...rest }: SwitchProps): ReactElement {
  const theme = useTheme();
  return (
    <RNSwitch
      accessibilityLabel={accessibilityLabel}
      value={value}
      trackColor={{ false: theme.color.border, true: theme.color.success }}
      thumbColor={value ? theme.color.fgOnAccent : theme.color.fg}
      ios_backgroundColor={theme.color.border}
      {...rest}
    />
  );
}
