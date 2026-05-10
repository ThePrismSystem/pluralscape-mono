import { type ReactElement } from "react";

import { IconMark } from "./PluralscapeLogo.icon";
import { Wordmark } from "./PluralscapeLogo.wordmark";
import { WordmarkLight } from "./PluralscapeLogo.wordmark-light";

type Variant = "icon" | "wordmark" | "wordmark-dark" | "wordmark-light";

export interface PluralscapeLogoProps {
  readonly variant?: Variant;
  readonly size?: number;
  readonly accessibilityLabel?: string;
}

const DEFAULT_SIZE = 32;
const DARK_CANVAS_BG = "#0f0f23";

export function PluralscapeLogo({
  variant = "icon",
  size = DEFAULT_SIZE,
  accessibilityLabel = "Pluralscape",
}: PluralscapeLogoProps): ReactElement {
  switch (variant) {
    case "icon":
      return <IconMark size={size} accessibilityLabel={accessibilityLabel} />;
    case "wordmark":
      return (
        <Wordmark size={size} accessibilityLabel={accessibilityLabel} bg="transparent" />
      );
    case "wordmark-dark":
      return (
        <Wordmark size={size} accessibilityLabel={accessibilityLabel} bg={DARK_CANVAS_BG} />
      );
    case "wordmark-light":
      return <WordmarkLight size={size} accessibilityLabel={accessibilityLabel} />;
  }
}
