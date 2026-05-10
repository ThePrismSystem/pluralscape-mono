import { type ReactElement } from "react";
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from "react-native-svg";

import { WORDMARK_PATH } from "./PluralscapeLogo.wordmark-path";

interface WordmarkProps {
  readonly size: number;
  readonly accessibilityLabel: string;
  readonly bg: "transparent" | "#0f0f23";
}

const LAYOUT = {
  viewBoxWidth: 400,
  viewBoxHeight: 130,
  viewBox: "0 0 400 130",
  glyphTransform: "translate(170, 10) scale(0.6)",
} as const;

const STROKE_WIDTH = "2";
const TEXT_FILL = "#e8e4f0";

export function Wordmark({ size, accessibilityLabel, bg }: WordmarkProps): ReactElement {
  const height = (size * LAYOUT.viewBoxHeight) / LAYOUT.viewBoxWidth;
  return (
    <Svg
      width={size}
      height={height}
      viewBox={LAYOUT.viewBox}
      accessibilityLabel={accessibilityLabel}
    >
      {bg === "transparent" ? null : (
        <Rect width={LAYOUT.viewBoxWidth} height={LAYOUT.viewBoxHeight} fill={bg} />
      )}
      <Defs>
        <LinearGradient id="wm_p0" x1="20" y1="20" x2="80" y2="75" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#b8a9c9" />
          <Stop offset="1" stopColor="#7ecbc0" />
        </LinearGradient>
        <LinearGradient id="wm_p1" x1="50" y1="20" x2="35" y2="75" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#e8e4f0" />
          <Stop offset="1" stopColor="#b8a9c9" />
        </LinearGradient>
        <LinearGradient id="wm_p2" x1="50" y1="50" x2="65" y2="75" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#b8a9c9" />
          <Stop offset="1" stopColor="#7ecbc0" />
        </LinearGradient>
        <LinearGradient id="wm_p3" x1="20" y1="40" x2="80" y2="40" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#b8a9c9" />
          <Stop offset="1" stopColor="#7ecbc0" />
        </LinearGradient>
      </Defs>
      <G transform={LAYOUT.glyphTransform}>
        <Path
          d="M50 20 L20 40 L35 75 L65 75 L80 40 Z"
          stroke="url(#wm_p0)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={STROKE_WIDTH}
        />
        <Path
          d="M50 20 L50 50 L35 75"
          stroke="url(#wm_p1)"
          strokeLinecap="round"
          strokeWidth={STROKE_WIDTH}
        />
        <Path
          d="M50 50 L65 75"
          stroke="url(#wm_p2)"
          strokeLinecap="round"
          strokeWidth={STROKE_WIDTH}
        />
        <Path
          d="M20 40 L50 50 L80 40"
          stroke="url(#wm_p3)"
          strokeLinecap="round"
          strokeWidth={STROKE_WIDTH}
        />
        <Circle cx="50" cy="20" r="5" fill="#e8e4f0" />
        <Circle cx="20" cy="40" r="4" fill="#b8a9c9" />
        <Circle cx="80" cy="40" r="4" fill="#7ecbc0" />
        <Circle cx="35" cy="75" r="3" fill="#e8e4f0" />
        <Circle cx="65" cy="75" r="3" fill="#b8a9c9" />
        <Circle cx="50" cy="50" r="2.5" fill="#7ecbc0" />
      </G>
      <Path d={WORDMARK_PATH} fill={TEXT_FILL} />
    </Svg>
  );
}
