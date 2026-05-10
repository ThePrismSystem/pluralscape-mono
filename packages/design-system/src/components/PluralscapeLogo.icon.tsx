import { type ReactElement } from "react";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";

interface IconMarkProps {
  readonly size: number;
  readonly accessibilityLabel: string;
}

const VIEW_BOX = "0 0 100 100";
const STROKE_WIDTH = "2";
const NODE_TOP = { cx: "50", cy: "20", r: "5", fill: "#e8e4f0" } as const;
const NODE_LEFT = { cx: "20", cy: "40", r: "4", fill: "#b8a9c9" } as const;
const NODE_RIGHT = { cx: "80", cy: "40", r: "4", fill: "#7ecbc0" } as const;
const NODE_BOTTOM_LEFT = { cx: "35", cy: "75", r: "3", fill: "#e8e4f0" } as const;
const NODE_BOTTOM_RIGHT = { cx: "65", cy: "75", r: "3", fill: "#b8a9c9" } as const;
const NODE_CENTER = { cx: "50", cy: "50", r: "2.5", fill: "#7ecbc0" } as const;

export function IconMark({ size, accessibilityLabel }: IconMarkProps): ReactElement {
  return (
    <Svg width={size} height={size} viewBox={VIEW_BOX} accessibilityLabel={accessibilityLabel}>
      <Defs>
        <LinearGradient id="p0" x1="20" y1="20" x2="80" y2="75" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#b8a9c9" />
          <Stop offset="1" stopColor="#7ecbc0" />
        </LinearGradient>
        <LinearGradient id="p1" x1="50" y1="20" x2="35" y2="75" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#e8e4f0" />
          <Stop offset="1" stopColor="#b8a9c9" />
        </LinearGradient>
        <LinearGradient id="p2" x1="50" y1="50" x2="65" y2="75" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#b8a9c9" />
          <Stop offset="1" stopColor="#7ecbc0" />
        </LinearGradient>
        <LinearGradient id="p3" x1="20" y1="40" x2="80" y2="40" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#b8a9c9" />
          <Stop offset="1" stopColor="#7ecbc0" />
        </LinearGradient>
      </Defs>
      <Path
        d="M50 20 L20 40 L35 75 L65 75 L80 40 Z"
        stroke="url(#p0)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={STROKE_WIDTH}
      />
      <Path
        d="M50 20 L50 50 L35 75"
        stroke="url(#p1)"
        strokeLinecap="round"
        strokeWidth={STROKE_WIDTH}
      />
      <Path d="M50 50 L65 75" stroke="url(#p2)" strokeLinecap="round" strokeWidth={STROKE_WIDTH} />
      <Path
        d="M20 40 L50 50 L80 40"
        stroke="url(#p3)"
        strokeLinecap="round"
        strokeWidth={STROKE_WIDTH}
      />
      <Circle {...NODE_TOP} />
      <Circle {...NODE_LEFT} />
      <Circle {...NODE_RIGHT} />
      <Circle {...NODE_BOTTOM_LEFT} />
      <Circle {...NODE_BOTTOM_RIGHT} />
      <Circle {...NODE_CENTER} />
    </Svg>
  );
}
