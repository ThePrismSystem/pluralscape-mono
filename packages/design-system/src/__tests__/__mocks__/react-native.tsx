import { createElement, type ReactElement, type ReactNode } from "react";

type AnyProps = Readonly<Record<string, unknown>> & { readonly children?: ReactNode };

export const Platform = {
  OS: "web" as const,
  select: <T,>(obj: { web?: T; default?: T; ios?: T; android?: T }): T | undefined =>
    obj.web ?? obj.default ?? obj.ios ?? obj.android,
};

export const StyleSheet = {
  create: <T extends Record<string, unknown>>(styles: T): T => styles,
  flatten: (style: unknown): Record<string, unknown> => {
    if (style === undefined || style === null || style === false) return {};
    if (Array.isArray(style)) {
      return style.reduce<Record<string, unknown>>(
        (acc, s) => ({ ...acc, ...StyleSheet.flatten(s) }),
        {},
      );
    }
    if (typeof style === "object") return style as Record<string, unknown>;
    return {};
  },
  hairlineWidth: 1,
  absoluteFill: {},
  absoluteFillObject: {},
};

type PressableStyle =
  | Record<string, unknown>
  | readonly Record<string, unknown>[]
  | ((state: { pressed: boolean; hovered?: boolean; focused?: boolean }) => unknown);

interface PressableMockProps {
  readonly onPress?: () => void;
  readonly onLongPress?: () => void;
  readonly disabled?: boolean;
  readonly accessibilityLabel?: string;
  readonly accessibilityRole?: string;
  readonly accessibilityState?: { disabled?: boolean; selected?: boolean };
  readonly accessibilityHint?: string;
  readonly role?: string;
  readonly style?: PressableStyle;
  readonly children?: ReactNode;
  readonly testID?: string;
  readonly hitSlop?: unknown;
  readonly [key: string]: unknown;
}

function flattenStyle(style: PressableStyle | undefined, pressed: boolean): Record<string, unknown> {
  if (typeof style === "function") return StyleSheet.flatten(style({ pressed }));
  return StyleSheet.flatten(style);
}

export function Pressable({
  onPress,
  onLongPress: _onLongPress,
  disabled,
  accessibilityLabel,
  accessibilityRole,
  accessibilityState,
  accessibilityHint,
  role,
  style,
  children,
  testID,
  hitSlop: _hitSlop,
  ...rest
}: PressableMockProps): ReactElement {
  const flatStyle = flattenStyle(style, false);
  return createElement(
    "button",
    {
      onClick: disabled ? undefined : onPress,
      disabled,
      "aria-label": accessibilityLabel,
      "aria-disabled": accessibilityState?.disabled ?? disabled,
      role: role ?? accessibilityRole ?? "button",
      "aria-describedby": accessibilityHint,
      "data-testid": testID,
      style: flatStyle,
      ...rest,
    },
    children,
  );
}

export function View({
  children,
  style,
  testID,
  ...rest
}: AnyProps & { style?: unknown; testID?: string }): ReactElement {
  return createElement(
    "div",
    { "data-testid": testID, style: StyleSheet.flatten(style), ...rest },
    children,
  );
}

export function Text({
  children,
  style,
  testID,
  ...rest
}: AnyProps & { style?: unknown; testID?: string }): ReactElement {
  return createElement(
    "span",
    { "data-testid": testID, style: StyleSheet.flatten(style), ...rest },
    children,
  );
}

interface TextInputMockProps {
  readonly value?: string;
  readonly onChangeText?: (text: string) => void;
  readonly placeholder?: string;
  readonly accessibilityLabel?: string;
  readonly testID?: string;
  readonly editable?: boolean;
  readonly style?: unknown;
  readonly [key: string]: unknown;
}

export function TextInput({
  value,
  onChangeText,
  placeholder,
  accessibilityLabel,
  testID,
  editable,
  style,
  ...rest
}: TextInputMockProps): ReactElement {
  return createElement("input", {
    type: "text",
    value: value ?? "",
    onChange: (e: { target: { value: string } }): void => onChangeText?.(e.target.value),
    placeholder,
    "aria-label": accessibilityLabel,
    "data-testid": testID,
    disabled: editable === false,
    style: StyleSheet.flatten(style),
    ...rest,
  });
}

interface SwitchMockProps {
  readonly value?: boolean;
  readonly onValueChange?: (value: boolean) => void;
  readonly disabled?: boolean;
  readonly accessibilityLabel?: string;
  readonly testID?: string;
  readonly [key: string]: unknown;
}

export function Switch({
  value,
  onValueChange,
  disabled,
  accessibilityLabel,
  testID,
  ...rest
}: SwitchMockProps): ReactElement {
  return createElement("input", {
    type: "checkbox",
    role: "switch",
    checked: value ?? false,
    onChange: (e: { target: { checked: boolean } }): void => onValueChange?.(e.target.checked),
    disabled,
    "aria-label": accessibilityLabel,
    "aria-checked": value ?? false,
    "data-testid": testID,
    ...rest,
  });
}

export const ActivityIndicator = (props: AnyProps): ReactElement =>
  createElement("div", { role: "progressbar", ...props });

export const ScrollView = ({
  children,
  style,
  ...rest
}: AnyProps & { style?: unknown }): ReactElement =>
  createElement("div", { style: StyleSheet.flatten(style), ...rest }, children);

export const SafeAreaView = ({
  children,
  style,
  ...rest
}: AnyProps & { style?: unknown }): ReactElement =>
  createElement("div", { style: StyleSheet.flatten(style), ...rest }, children);

export const Image = ({ style, ...rest }: AnyProps & { style?: unknown }): ReactElement =>
  createElement("img", { style: StyleSheet.flatten(style), ...rest });

export const NativeModules = {};
export const AppState = {
  addEventListener: (): { remove: () => undefined } => ({ remove: () => undefined }),
};

export default {};
