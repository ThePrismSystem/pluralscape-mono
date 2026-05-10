import baseConfig from "@pluralscape/eslint-config";

export default [
  ...baseConfig,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    ignores: ["src/tokens.generated.ts", "src/themes.generated.ts", "dist/**"],
  },
];
