import { type ReactElement } from "react";
import Svg, { Circle, Defs, G, LinearGradient, Path, Stop } from "react-native-svg";

import { WORDMARK_PATH } from "./PluralscapeLogo.wordmark-path";

interface WordmarkLightProps {
  readonly size: number;
  readonly accessibilityLabel: string;
}

const LAYOUT = {
  viewBoxWidth: 400,
  viewBoxHeight: 130,
  viewBox: "0 0 400 130",
  glyphTransform: "translate(170, 10) scale(0.6)",
} as const;

const STROKE_WIDTH = "2";
const TEXT_FILL = "#0f0f23";

export function WordmarkLight({
  size,
  accessibilityLabel,
}: WordmarkLightProps): ReactElement {
  const height = (size * LAYOUT.viewBoxHeight) / LAYOUT.viewBoxWidth;
  return (
    <Svg
      width={size}
      height={height}
      viewBox={LAYOUT.viewBox}
      accessibilityLabel={accessibilityLabel}
    >
      <Defs>
        <LinearGradient id="wml_p0" x1="20" y1="20" x2="80" y2="75" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#6b5d87" />
          <Stop offset="1" stopColor="#2d7a72" />
        </LinearGradient>
        <LinearGradient id="wml_p1" x1="50" y1="20" x2="35" y2="75" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#0f0f23" />
          <Stop offset="1" stopColor="#6b5d87" />
        </LinearGradient>
        <LinearGradient id="wml_p2" x1="50" y1="50" x2="65" y2="75" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#6b5d87" />
          <Stop offset="1" stopColor="#2d7a72" />
        </LinearGradient>
        <LinearGradient id="wml_p3" x1="20" y1="40" x2="80" y2="40" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#6b5d87" />
          <Stop offset="1" stopColor="#2d7a72" />
        </LinearGradient>
      </Defs>
      <G transform={LAYOUT.glyphTransform}>
        <Path
          d="M50 20 L20 40 L35 75 L65 75 L80 40 Z"
          stroke="url(#wml_p0)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={STROKE_WIDTH}
        />
        <Path
          d="M50 20 L50 50 L35 75"
          stroke="url(#wml_p1)"
          strokeLinecap="round"
          strokeWidth={STROKE_WIDTH}
        />
        <Path
          d="M50 50 L65 75"
          stroke="url(#wml_p2)"
          strokeLinecap="round"
          strokeWidth={STROKE_WIDTH}
        />
        <Path
          d="M20 40 L50 50 L80 40"
          stroke="url(#wml_p3)"
          strokeLinecap="round"
          strokeWidth={STROKE_WIDTH}
        />
        <Circle cx="50" cy="20" r="5" fill="#0f0f23" />
        <Circle cx="20" cy="40" r="4" fill="#6b5d87" />
        <Circle cx="80" cy="40" r="4" fill="#2d7a72" />
        <Circle cx="35" cy="75" r="3" fill="#0f0f23" />
        <Circle cx="65" cy="75" r="3" fill="#6b5d87" />
        <Circle cx="50" cy="50" r="2.5" fill="#2d7a72" />
      </G>
      <Path d={WORDMARK_PATH} fill={TEXT_FILL} />
    </Svg>
  );
}
