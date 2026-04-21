import baseConfig from "@pluralscape/eslint-config";

/** RLS selector entries shared between the production rule and the wrapper exemption. */
const TS_AS_EXPRESSION_SELECTORS = [
  {
    selector: "TSAsExpression > TSAsExpression[typeAnnotation.type='TSUnknownKeyword']",
    message:
      "Force-casting via 'as unknown as Type' is forbidden. Fix the underlying type mismatch instead.",
  },
  {
    selector: "TSTypeAssertion > TSTypeAssertion[typeAnnotation.type='TSUnknownKeyword']",
    message:
      "Force-casting via '<Type><unknown>' is forbidden. Fix the underlying type mismatch instead.",
  },
];

/** Selectors banning bare db.execute / db.transaction outside RLS wrappers. */
const RLS_BYPASS_SELECTORS = [
  {
    selector: "CallExpression[callee.object.name='db'][callee.property.name='execute']",
    message:
      "Bare `db.execute(...)` bypasses RLS context. Use `withTenantRead` / `withTenantTransaction` from `apps/api/src/lib/rls-context.ts`, or `cross-account-*` helpers for the rare cross-account paths.",
  },
  {
    selector: "CallExpression[callee.object.name='db'][callee.property.name='transaction']",
    message:
      "Bare `db.transaction(...)` bypasses RLS context. Use `withTenantRead` / `withTenantTransaction` from `apps/api/src/lib/rls-context.ts`, or `cross-account-*` helpers for the rare cross-account paths.",
  },
];

export default [
  ...baseConfig,
  {
    // Forbid bare db.execute / db.transaction in all production API source.
    // Route calls through withTenantRead / withTenantTransaction (rls-context.ts)
    // or the cross-account-* helpers so app.current_system_id is always set
    // before hitting an RLS-protected table.
    files: ["src/**/*.ts"],
    ignores: [
      "src/lib/rls-context.ts",
      "src/lib/cross-account-*.ts",
      "**/*.test.ts",
      "**/*.spec.ts",
      "**/*.integration.test.ts",
      "**/__tests__/**/*.ts",
    ],
    rules: {
      "no-restricted-syntax": ["error", ...TS_AS_EXPRESSION_SELECTORS, ...RLS_BYPASS_SELECTORS],
    },
  },
  {
    // rls-context.ts and cross-account-* helpers ARE the RLS wrappers — they
    // call db.transaction / db.execute intentionally. The TSAsExpression ban
    // remains active inside these files.
    files: ["src/lib/rls-context.ts", "src/lib/cross-account-*.ts"],
    rules: {
      "no-restricted-syntax": ["error", ...TS_AS_EXPRESSION_SELECTORS],
    },
  },
];
