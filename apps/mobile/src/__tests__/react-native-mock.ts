/**
 * Minimal react-native stub for vitest (Node environment).
 * react-native uses Flow types and cannot be parsed by rolldown/esbuild.
 * This stub provides just enough surface area for tests that transitively
 * import react-native (e.g. via expo-constants).
 */
import { createElement } from "react";

export const Platform = {
  OS: "ios",
  select: (obj: Record<string, unknown>): unknown => obj["ios"],
};
export const NativeModules = {};
export function NativeEventEmitter(): void {
  // stub
}
export const AppState = {
  addEventListener: (): { remove: () => undefined } => ({ remove: () => undefined }),
};

// UI component stubs for happy-dom tests
export const StyleSheet = {
  create: <T extends Record<string, unknown>>(styles: T): T => styles,
};
export const View = "View";
export const Text = "Text";
export const ActivityIndicator = "ActivityIndicator";

/**
 * TouchableOpacity stub — maps the React Native `onPress` prop to the DOM
 * `onClick` event so click interactions work in happy-dom tests.
 */
export function TouchableOpacity({
  onPress,
  children,
  accessibilityLabel,
  accessibilityRole,
  ...rest
}: {
  readonly onPress?: () => void;
  readonly children?: unknown;
  readonly accessibilityLabel?: string;
  readonly accessibilityRole?: string;
  readonly style?: unknown;
  readonly hitSlop?: unknown;
  readonly accessible?: boolean;
  readonly [key: string]: unknown;
}): ReturnType<typeof createElement> {
  return createElement(
    "button",
    {
      onClick: onPress,
      "aria-label": accessibilityLabel,
      role: accessibilityRole,
      ...rest,
    },
    children,
  );
}

export default {};
