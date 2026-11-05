---
# infra-ar81
title: Consolidate open Renovate/Dependabot dependency updates
status: completed
type: task
priority: normal
created_at: 2026-11-05T13:40:41Z
updated_at: 2026-11-05T13:46:10Z
---

Apply all open Renovate and Dependabot dependency PRs in one branch, fix the resulting lint/type/test/audit fallout, and merge so the bot PRs close.

## Summary of Changes

Applied every open Renovate and Dependabot update on one branch:

- Manifests: happy-dom ^21, style-dictionary ^5, nodemailer ^10, react-native-screens ~4.30, vite override 8.1.6, @tanstack/query-core override 5.105.3 (matches @tanstack/react-query 5.105.3).
- Lockfile-only bumps within ranges (vitest, hono, @hono/node-server, typescript-eslint, eslint, prettier, knip, turbo, zod, i18next, bullmq, @babel/core, esbuild, and the rest of the grouped dev-dependency PR), then `pnpm dedupe`.
- GitHub Actions digest bumps from the grouped Actions PR.
- Held react/react-dom/@types/react(-dom) at 19.2.x and react-native at 0.85.x (Expo SDK 55). The grouped dev-dependency PR resolved the pinned apps/mobile react-native 0.85.3 to 0.88.1 and React to 19.3.1, inconsistent with the manifest and the RN-bundled renderer. Added renovate.json allowedVersions rules so these move only with an Expo SDK upgrade.

Fallout fixed:

- nodemailer 10 ships its own types: dropped @types/nodemailer and declared `types: ["bun"]` in packages/email so tests stop relying on Node globals leaking in via @types/nodemailer.
- hono 4.13 deprecates `hono/bun`: migrated apps/api (and its test mocks) to `@hono/bun`, which has the same exports.
- typescript-eslint 8.72 findings fixed in code with no rule changes:
  - no-meaningless-void-operator: `_`-prefixed unused params and loop vars, removed dead bindings, compile-time guards converted to exported `Assert<>` guard types, exhaustive switch uses `satisfies never`.
  - unbound-method on mock intersections and `vi.mocked(logger)["warn"]`: tests reference hoisted or standalone mock fns directly.
  - no-unnecessary-type-assertion: bullmq `getNextJob` is now typed.
  - no-generated-empty-object-type: the `RelationshipEncryptedInput` standard arm is now `Readonly<Record<string, never>>`, matching what Zod and the OpenAPI generator already produce; both parity checks assert against the canonical type.
- Prettier 3.9 reformat (layout only).
- pnpm audit: bumped vulnerable transitives within range (axios, ws, shell-quote, qs, follow-redirects, form-data, node-forge, @xmldom/xmldom, compression, js-yaml via @redocly/openapi-core, react-navigation 7.24). Seven advisories with no in-range fix are ignored with rationale in pnpm-workspace.yaml; removal tracked in infra-vs92.
