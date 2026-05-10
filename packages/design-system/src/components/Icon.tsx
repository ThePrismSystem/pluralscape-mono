import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Eye,
  EyeOff,
  Heart,
  type LucideIcon,
  Minus,
  Plus,
  Search,
  Settings,
  X,
} from "lucide-react-native";
import { type ComponentProps, type ReactElement } from "react";

import { useTheme } from "../theme";

const DEFAULT_SIZE = 22;

const ICONS = {
  check: Check,
  x: X,
  plus: Plus,
  minus: Minus,
  "chevron-down": ChevronDown,
  "chevron-up": ChevronUp,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  heart: Heart,
  settings: Settings,
  search: Search,
  eye: Eye,
  "eye-off": EyeOff,
} as const satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export interface IconProps extends Omit<ComponentProps<LucideIcon>, "color"> {
  readonly name: IconName;
  readonly size?: number;
  readonly color?: string;
}

export function Icon({ name, size = DEFAULT_SIZE, color, ...rest }: IconProps): ReactElement {
  const theme = useTheme();
  const Lucide = ICONS[name];
  return <Lucide size={size} color={color ?? theme.color.fg} {...rest} />;
}
