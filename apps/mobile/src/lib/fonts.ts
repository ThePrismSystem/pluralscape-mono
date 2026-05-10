import dmSansItalicVariable from "@pluralscape/design-system/assets/fonts/DMSans-Italic-VariableFont_opsz_wght.ttf";
import dmSansVariable from "@pluralscape/design-system/assets/fonts/DMSans-VariableFont_opsz_wght.ttf";
import { useFonts } from "expo-font";

export function useDesignSystemFonts(): readonly [boolean] {
  const [loaded] = useFonts({
    "DMSans-Variable": dmSansVariable,
    "DMSans-Italic-Variable": dmSansItalicVariable,
  });
  return [loaded] as const;
}
