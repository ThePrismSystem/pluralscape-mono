import baseConfig from "./index.js";

export default [
  ...baseConfig,
  {
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      // React Native specific adjustments
      "@typescript-eslint/no-magic-numbers": "off",
    },
  },
  {
    files: ["babel.config.cjs", "metro.config.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "import-x/order": "off",
    },
  },
];
