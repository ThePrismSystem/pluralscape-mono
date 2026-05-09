import path from "node:path";
import { fileURLToPath } from "node:url";

import eslintCommentsPlugin from "@eslint-community/eslint-plugin-eslint-comments/configs";
import eslintConfigPrettier from "eslint-config-prettier";
import importPlugin from "eslint-plugin-import-x";
import unicornPlugin from "eslint-plugin-unicorn";
import tseslint from "typescript-eslint";

import { locRules } from "./loc-rules.js";
import noBearerPrefixOnSpAuth from "./rules/no-bearer-prefix-on-sp-auth.js";
import noDeepTypesImports from "./rules/no-deep-types-imports.js";
import noDoubleCast from "./rules/no-double-cast.js";
import noHandRolledDomainTypes, {
  loadManifestEntities,
} from "./rules/no-hand-rolled-domain-types.js";
import noHandRolledRequestTypes from "./rules/no-hand-rolled-request-types.js";
import noLocalEncryptedFields from "./rules/no-local-encrypted-fields.js";
import noParamsUnknown from "./rules/no-params-unknown.js";
import noPrOrBeanRefsInCode from "./rules/no-pr-or-bean-refs-in-code.js";
import noServicesBarrel from "./rules/no-services-barrel.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MANIFEST_PATH = path.resolve(__dirname, "../../packages/types/src/__sot-manifest__.ts");
const MANIFEST_ENTITIES = loadManifestEntities(MANIFEST_PATH);

export default tseslint.config(
  {
    plugins: {
      pluralscape: {
        rules: {
          "no-bearer-prefix-on-sp-auth": noBearerPrefixOnSpAuth,
          "no-deep-types-imports": noDeepTypesImports,
          "no-double-cast": noDoubleCast,
          "no-hand-rolled-domain-types": noHandRolledDomainTypes,
          "no-hand-rolled-request-types": noHandRolledRequestTypes,
          "no-local-encrypted-fields": noLocalEncryptedFields,
          "no-params-unknown": noParamsUnknown,
          "no-pr-or-bean-refs-in-code": noPrOrBeanRefsInCode,
          "no-services-barrel": noServicesBarrel,
        },
      },
    },
  },
  {
    ignores: [
      "**/dist/**",
      "**/build/**",
      "**/node_modules/**",
      "**/.turbo/**",
      "**/.expo/**",
      "**/vitest.config.ts",
      "**/vitest.*.config.ts",
      "**/playwright.config.ts",
      "**/drizzle.config.*.ts",
      "**/generated/**",
      "**/__sot-manifest__.ts",
      "**/scripts/**",
    ],
  },
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
  },
  eslintCommentsPlugin.recommended,
  {
    plugins: {
      "import-x": importPlugin,
      unicorn: unicornPlugin,
    },
    rules: {
      // Ban all eslint-disable comments — fix the violation, don't suppress it
      "@eslint-community/eslint-comments/no-use": "error",

      // Allow underscore-prefixed names as intentionally unused. Catch bindings
      // are intentionally NOT exempted: empty/swallowed catches violate the
      // no-swallowed-errors policy in CLAUDE.md.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],

      // No `as any`
      "@typescript-eslint/no-explicit-any": "error",

      // No `as unknown as T`
      "no-restricted-syntax": [
        "error",
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
      ],

      // No @ts-ignore or @ts-expect-error
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          "ts-ignore": true,
          "ts-expect-error": true,
        },
      ],

      // No non-null assertion
      "@typescript-eslint/no-non-null-assertion": "error",

      // No var
      "no-var": "error",

      // No floating promises
      "@typescript-eslint/no-floating-promises": "error",

      // No swallowed errors
      "no-empty": "error",

      // No console.* in production — use structured Logger interface
      "no-console": "error",

      // Explicit return types on exports
      "@typescript-eslint/explicit-module-boundary-types": "error",

      // Exhaustive switch
      "@typescript-eslint/switch-exhaustiveness-check": "error",

      // No magic numbers
      "@typescript-eslint/no-magic-numbers": [
        "warn",
        {
          ignore: [0, 1, 2, -1],
          ignoreEnums: true,
          ignoreNumericLiteralTypes: true,
          ignoreReadonlyClassProperties: true,
          ignoreTypeIndexes: true,
        },
      ],

      // Import organization
      "import-x/order": [
        "error",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index", "type"],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],

      // No unnecessary conditions
      "@typescript-eslint/no-unnecessary-condition": "error",

      // Prefer nullish coalescing
      "@typescript-eslint/prefer-nullish-coalescing": "error",

      // Prefer optional chain
      "@typescript-eslint/prefer-optional-chain": "error",

      // No misused promises
      "@typescript-eslint/no-misused-promises": "error",

      // Require await
      "@typescript-eslint/require-await": "error",

      // Strict equality
      eqeqeq: "error",

      // Curly braces required
      curly: "error",
    },
  },
  {
    files: ["apps/api/src/services/**"],
    rules: {
      "pluralscape/no-services-barrel": "error",
    },
  },
  {
    files: ["packages/import-sp/src/**"],
    rules: {
      "pluralscape/no-bearer-prefix-on-sp-auth": "error",
    },
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "pluralscape/no-deep-types-imports": "error",
      "pluralscape/no-double-cast": "error",
    },
  },
  {
    files: ["apps/**/*.{ts,tsx}", "packages/!(types)/**/*.{ts,tsx}"],
    rules: {
      "pluralscape/no-hand-rolled-domain-types": ["error", { manifestEntities: MANIFEST_ENTITIES }],
    },
  },
  {
    files: ["packages/data/src/transforms/**", "packages/sync/src/**"],
    rules: {
      "pluralscape/no-local-encrypted-fields": "error",
    },
  },
  {
    files: ["apps/**/*.{ts,tsx}", "packages/**/*.{ts,tsx}"],
    rules: {
      "pluralscape/no-pr-or-bean-refs-in-code": "error",
    },
  },
  {
    files: [
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/*.spec.ts",
      "**/*.integration.test.ts",
      "**/*.integration.spec.ts",
      "**/__tests__/**/*.ts",
      "**/__tests__/**/*.tsx",
    ],
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-magic-numbers": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          "ts-ignore": true,
          "ts-expect-error": "allow-with-description",
          minimumDescriptionLength: 10,
        },
      ],
    },
  },
  {
    files: ["**/*.constants.ts"],
    rules: {
      "@typescript-eslint/no-magic-numbers": "off",
    },
  },
  {
    files: [
      "**/*.bench.ts",
      "**/scripts/**/*.ts",
      "**/global-setup.ts",
      "**/global-teardown.ts",
      "**/migrate.ts",
    ],
    rules: {
      "no-console": "off",
    },
  },
  {
    // Mobile app has no shared structured logger (React Native runtime).
    // `console.warn` gated on `__DEV__` is the idiomatic diagnostic sink for
    // specific fail-closed paths where silent failure would be undebuggable.
    files: [
      "**/apps/mobile/src/auth/expo-secure-token-store.ts",
      "**/apps/mobile/src/connection/sse-client.ts",
      "src/auth/expo-secure-token-store.ts",
      "src/connection/sse-client.ts",
    ],
    rules: {
      "no-console": "off",
    },
  },
  {
    files: ["**/*.js", "**/*.cjs"],
    ...tseslint.configs.disableTypeChecked,
    rules: {
      ...tseslint.configs.disableTypeChecked.rules,
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
    },
  },
  {
    files: ["**/*.d.ts"],
    ...tseslint.configs.disableTypeChecked,
  },
  // ─── LOC ceilings — see tooling/eslint-config/loc-rules.js ──────────────
  // (Per-package turbo lint does not fire these because flat-config globs
  // resolve against per-package cwd. The actual enforcement runs via
  // `pnpm lint:loc` against the root `eslint.loc.config.js`.)
  ...locRules,
  // ────────────────────────────────────────────────────────────────────────

  eslintConfigPrettier,
);
