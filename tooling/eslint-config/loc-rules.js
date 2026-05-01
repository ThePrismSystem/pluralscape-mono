// tooling/eslint-config/loc-rules.js

/**
 * LOC ceilings (max-lines per area) — single source of truth for the spec at
 * docs/superpowers/specs/2026-04-30-loc-ceilings-eslint-rules-design.md.
 *
 * Counting algorithm: ESLint default — counts ALL lines including blanks
 * and comments. Matches `wc -l`.
 *
 * Block ordering matters: later blocks override earlier blocks for the
 * same rule on overlapping files. Tier B comes first (broad ceilings);
 * Tier A area blocks next; constants and tests last so they override.
 *
 * Consumed by:
 * - tooling/eslint-config/index.js (per-package turbo lint — does NOT fire
 *   here because flat-config globs resolve against per-package cwd; kept
 *   here for documentation + future ESLint behavior changes)
 * - eslint.loc.config.js (root-level lint:loc — actual enforcement)
 */
export const locRules = [
  // Tier B — Lockstep (cap = current max + ~3% buffer)
  { files: ["apps/api/src/lib/**/*.ts"], rules: { "max-lines": ["error", { max: 500 }] } },
  { files: ["apps/api/src/ws/**/*.ts"], rules: { "max-lines": ["error", { max: 725 }] } },
  { files: ["apps/mobile/src/**/*.{ts,tsx}"], rules: { "max-lines": ["error", { max: 850 }] } },
  { files: ["packages/sync/src/**/*.ts"], rules: { "max-lines": ["error", { max: 1100 }] } },
  { files: ["packages/queue/src/**/*.ts"], rules: { "max-lines": ["error", { max: 775 }] } },
  { files: ["packages/import-core/src/**/*.ts"], rules: { "max-lines": ["error", { max: 500 }] } },

  // Tier A — Target (final standards)
  { files: ["apps/api/src/routes/**/*.{ts,tsx}"], rules: { "max-lines": ["error", { max: 200 }] } },
  { files: ["apps/api/src/middleware/**/*.ts"], rules: { "max-lines": ["error", { max: 200 }] } },
  { files: ["apps/api/src/trpc/**/*.ts"], rules: { "max-lines": ["error", { max: 350 }] } },
  { files: ["apps/api/src/services/**/*.ts"], rules: { "max-lines": ["error", { max: 450 }] } },
  { files: ["packages/types/src/**/*.ts"], rules: { "max-lines": ["error", { max: 450 }] } },
  {
    files: [
      "packages/crypto/src/**/*.ts",
      "packages/db/src/**/*.ts",
      "packages/data/src/**/*.ts",
      "packages/email/src/**/*.ts",
      "packages/i18n/src/**/*.ts",
      "packages/storage/src/**/*.ts",
      "packages/validation/src/**/*.ts",
      "packages/api-client/src/**/*.ts",
      "packages/import-pk/src/**/*.ts",
      "packages/import-sp/src/**/*.ts",
      "packages/logger/src/**/*.ts",
      "packages/rotation-worker/src/**/*.ts",
    ],
    rules: { "max-lines": ["error", { max: 500 }] },
  },
  { files: ["apps/mobile-web-e2e/src/**/*.ts"], rules: { "max-lines": ["error", { max: 300 }] } },
  { files: ["apps/mobile/app/**/*.{ts,tsx}"], rules: { "max-lines": ["error", { max: 400 }] } },
  { files: ["apps/api/src/jobs/**/*.ts"], rules: { "max-lines": ["error", { max: 200 }] } },
  { files: ["apps/api/src/*.{ts,tsx}"], rules: { "max-lines": ["error", { max: 400 }] } },
  {
    files: ["apps/mobile/modules/**/*.ts", "apps/mobile/locales/**/*.ts"],
    rules: { "max-lines": ["error", { max: 250 }] },
  },
  { files: ["apps/api-e2e/src/**/*.ts"], rules: { "max-lines": ["error", { max: 400 }] } },

  // Constants override (stricter than any area cap)
  { files: ["**/*.constants.ts"], rules: { "max-lines": ["error", { max: 300 }] } },

  // Tests override everything (most permissive — overrides area + catch-all)
  {
    files: [
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/*.spec.ts",
      "**/*.spec.tsx",
      "**/__tests__/**/*.ts",
      "**/__tests__/**/*.tsx",
      "**/*.contract.ts",
    ],
    rules: { "max-lines": ["error", { max: 750 }] },
  },
];

/** Glob patterns excluded from LOC checking. */
export const locIgnores = [
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
  "**/*.d.ts",
];
