import baseConfig from "@pluralscape/eslint-config";

export default [
  ...baseConfig,
  {
    files: ["src/entities/**/*.ts"],
    rules: {
      "pluralscape/no-hand-rolled-request-types": "error",
    },
  },
];
