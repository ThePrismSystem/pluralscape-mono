---
# infra-10h9
title: Bundle 12 Renovate PRs (Apr 19)
status: completed
type: task
priority: normal
created_at: 2026-04-19T21:55:47Z
updated_at: 2026-04-19T22:35:19Z
---

Bundle PRs #489-501 (excluding #497 already merged) into one PR. Includes 2 majors: uuid v14 (#501), actions/github-script v9 (#500). Keep individual Renovate PRs OPEN until user confirms bundle merged.

## Summary of Changes

**Approach**: bundle into a single branch `chore/renovate-bundle-apr19-v2` with two commits — Renovate updates first, then a pnpm catalog migration to reduce future per-file dep churn.

### Commit 1 — Renovate bundle + fast-xml-parser pin

- **uuid → 14** (#501), **tanstack-query-core → 5.99.2** (#489), **actions/github-script → v9** (#500)
- Lockfile-only bumps from #490–498: i18next, i18next-http-backend, react-i18next, aws-sdk-js-v3, better-sqlite3-multiple-ciphers, bullmq, resend, libsodium-wrappers-sumo
- Dev dep cascade from #499: typescript 6.0.3, eslint 10.2.1, prettier 3.8.3, esbuild 0.28.0, @opentelemetry/instrumentation 2.28.1
- **Tightened pnpm.overrides `fast-xml-parser` from `>=5.5.7` to `~5.5.7`**: the AWS SDK v3.1032 update pulled in fast-xml-parser 5.7.x, which incorrectly rejects MinIO XML error responses containing `&#xD;` numeric character references. This broke the S3 adapter's error mapping (4 storage-integration test failures). Pinning to the 5.5.x line restores correct behavior while staying above the security floor.

### Commit 2 — pnpm catalog migration

- Added a `catalog:` block to `pnpm-workspace.yaml` for 18 deps that appear in 2+ workspace packages
- Replaced inline versions with `"catalog:"` in 22 workspace package.json files
- **In scope**: typescript, eslint, zod, drizzle-orm, postgres, the @trpc/\* family, @tanstack/react-query, react-dom, @types/{bun,node,react,better-sqlite3}, @testing-library/react, @playwright/test, @electric-sql/pglite, jszip, better-sqlite3-multiple-ciphers
- **Deliberately out of scope**: peerDependencies (intentionally loose ranges) and `@types/node` (split between Playwright apps on ^24 and most packages on ^25 — would need named catalogs, not worth the complexity)

### Verification

Two full `/verify` runs (pre-catalog and post-catalog) — all green:

- format, lint, typecheck: pass
- unit: 12566 / 12567 (1 skip)
- integration: 2786 / 2797 (11 skip) — failed first run with 4 storage failures, then green after the fast-xml-parser pin
- e2e: 507 / 509 (2 skip), e2e-slow: 2 / 6 (4 skip)
- sp-import: 44 / 73 (29 skip), pk-import: 18 / 34 (16 skip)
- `pnpm audit --audit-level moderate`: no known vulnerabilities (run twice)

### Renovate PR housekeeping

- The 12 individual Renovate PRs (#489–#501 minus #497 already merged) **remain open** per the user's instruction. They will close automatically when the bundle is merged because Renovate detects the deps are already at target versions.
