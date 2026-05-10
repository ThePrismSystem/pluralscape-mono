import { type ReactElement } from "react";
import { Image, StyleSheet, Text, View, type ImageSourcePropType } from "react-native";
import { Defs, LinearGradient, Rect, Stop, Svg } from "react-native-svg";

import { type Theme, useTheme } from "../theme";

type Size = "sm" | "md" | "lg";
type Shape = "square" | "circle";

export interface AvatarProps {
  readonly label: string;
  readonly imageUri?: string;
  readonly bgColor?: string;
  readonly size?: Size;
  readonly shape?: Shape;
}

const SIZE_PX = { sm: 32, md: 40, lg: 64 } as const satisfies Record<Size, number>;
const FONT_PX = { sm: 14, md: 16, lg: 26 } as const satisfies Record<Size, number>;
const FULL_RADIUS = 9999;
const AURORA_STOPS = [
  { at: "0", color: "#b8a9c9" },
  { at: "0.22", color: "#b1afcc" },
  { at: "0.44", color: "#a4b4c8" },
  { at: "0.66", color: "#95c1c4" },
  { at: "0.84", color: "#84c8c0" },
  { at: "1", color: "#7ecbc0" },
] as const;

export function Avatar({
  label,
  imageUri,
  bgColor,
  size = "md",
  shape = "square",
}: AvatarProps): ReactElement {
  const theme = useTheme();
  const styles = makeStyles(theme, size, shape, bgColor);
  const initial = label.trim().charAt(0).toUpperCase();
  const showInitial = imageUri === undefined && bgColor === undefined && initial !== "";

  return (
    <View style={styles.base}>
      {imageUri !== undefined ? (
        <Image source={{ uri: imageUri } satisfies ImageSourcePropType} style={styles.image} />
      ) : bgColor === undefined ? (
        <Svg style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="aurora" x1="0" y1="0" x2="1" y2="0.5">
              {AURORA_STOPS.map((stop) => (
                <Stop key={stop.at} offset={stop.at} stopColor={stop.color} />
              ))}
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#aurora)" />
        </Svg>
      ) : null}
      {showInitial ? <Text style={styles.initial}>{initial}</Text> : null}
    </View>
  );
}

function makeStyles(theme: Theme, size: Size, shape: Shape, bgColor?: string) {
  const dim = SIZE_PX[size];
  const fontSize = FONT_PX[size];
  const radius = shape === "circle" ? FULL_RADIUS : theme.radius.md;
  return StyleSheet.create({
    base: {
      width: dim,
      height: dim,
      borderRadius: radius,
      backgroundColor: bgColor,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    image: { width: "100%", height: "100%" },
    initial: {
      color: theme.color.bg,
      fontFamily: theme.font.sans,
      fontSize,
      fontWeight: "500",
    },
  });
}
