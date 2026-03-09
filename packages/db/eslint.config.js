import baseConfig from "@pluralscape/eslint-config";

export default [
  ...baseConfig,
  {
    ignores: ["drizzle.config.*.ts"],
  },
];
