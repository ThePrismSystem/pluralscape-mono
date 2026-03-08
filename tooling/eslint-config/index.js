import eslintConfigPrettier from "eslint-config-prettier";
import importPlugin from "eslint-plugin-import-x";
import unicornPlugin from "eslint-plugin-unicorn";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/build/**",
      "**/node_modules/**",
      "**/.turbo/**",
      "**/.expo/**",
      "**/vitest.config.ts",
      "vitest.shared.ts",
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
  {
    plugins: {
      "import-x": importPlugin,
      unicorn: unicornPlugin,
    },
    rules: {
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

      // No @ts-ignore, allow @ts-expect-error with description
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          "ts-ignore": true,
          "ts-expect-error": "allow-with-description",
          minimumDescriptionLength: 10,
        },
      ],

      // No eslint-disable without specific rule
      "unicorn/no-abusive-eslint-disable": "error",

      // No non-null assertion
      "@typescript-eslint/no-non-null-assertion": "error",

      // No var
      "no-var": "error",

      // No floating promises
      "@typescript-eslint/no-floating-promises": "error",

      // No swallowed errors
      "no-empty": "error",

      // No console.log in production
      "no-console": ["error", { allow: ["warn", "error"] }],

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
    files: [
      "**/*.test.ts",
      "**/*.spec.ts",
      "**/*.integration.test.ts",
      "**/*.integration.spec.ts",
      "**/__tests__/**/*.ts",
    ],
    rules: {
      "@typescript-eslint/no-magic-numbers": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
    },
  },
  {
    files: ["**/*.js"],
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
  eslintConfigPrettier,
);
