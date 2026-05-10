import baseConfig from "@pluralscape/eslint-config";

export default [
  ...baseConfig,
  {
    ignores: ["src/tokens.generated.ts", "src/themes.generated.ts", "dist/**", "tokens/**"],
  },
];
