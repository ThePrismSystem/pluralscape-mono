/**
 * LOC ceiling check — max-lines rules only.
 *
 * Run from monorepo root: `pnpm lint:loc`
 *
 * Caps live in tooling/eslint-config/loc-rules.js (single source of truth).
 * This config wires those caps into a TS-parser-only ESLint instance with no
 * type-aware rules so it can run cheaply across the whole repo without a
 * TypeScript project service.
 *
 * File globs are root-relative (e.g., "apps/api/src/routes/**") so this must
 * be invoked from the monorepo root.
 */

// Resolved via the eslint-config tooling package's own dep tree.
// @typescript-eslint/parser is a direct dep of @pluralscape/eslint-config;
// pnpm installs it under tooling/eslint-config/node_modules/.
import { locRules, locIgnores } from "./tooling/eslint-config/loc-rules.js";
import tsParser from "./tooling/eslint-config/node_modules/@typescript-eslint/parser/dist/index.js";

export default [
  { ignores: locIgnores },
  {
    // TypeScript parser without project service — syntax-only, no type info.
    // This is sufficient for max-lines (a pure line-count rule).
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: { parser: tsParser },
  },
  ...locRules,
];
