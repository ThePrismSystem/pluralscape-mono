---
# ps-o5mk
title: "Bump all dependencies from Renovate dashboard #203"
status: completed
type: task
priority: normal
created_at: 2026-03-20T21:47:46Z
updated_at: 2026-03-20T22:05:16Z
---

Remove deprecated @types/libsodium-wrappers-sumo, bump pnpm 9.15.9, tRPC 11.14.0, pino v10, react-i18next v16, pglite 0.4, ioredis 5.10.1, @types/node v24, hono 4.12.8, widen eslint peer dep, and run pnpm install to pick up all lockfile-only updates.

## Summary of Changes

Addressed all items from Renovate Dependency Dashboard (GitHub issue #203):

### Deprecation removal

- Removed `@types/libsodium-wrappers-sumo` (deprecated; `libsodium-wrappers-sumo` ships its own types)
- Cleaned up corresponding knip.json ignore entry

### Version range bumps (package.json changes)

- `pnpm`: 9.15.4 -> 9.15.9 (packageManager field)
- `hono`: ^4.12.7 -> ^4.12.8
- `pino`: ^9.6.0 -> ^10.0.0 (major)
- `react-i18next`: ^15.5.3 -> ^16.0.0 (major)
- `@electric-sql/pglite`: ^0.3.16 -> ^0.4.0 (3 locations)
- `@trpc/server` override: 11.13.4 -> 11.14.0
- `@trpc/client` + `@trpc/react-query`: 11.13.4 -> 11.14.0
- `ioredis`: 5.9.3 -> 5.10.1
- `@types/node` (api-e2e): ^22.0.0 -> ^24.0.0
- `eslint` peer dep (eslint-config): ^9.0.0 -> ^9.0.0 || ^10.0.0

### Lockfile-resolved updates (via pnpm install)

- `@tanstack/react-query` 5.66.9 -> 5.90.21
- `better-sqlite3-multiple-ciphers` 12.6.2 -> 12.8.0
- `i18next` 25.1.3 -> 25.9.0
- `typescript-eslint` 8.24.1 -> 8.57.1
- `@aws-sdk/*` 3.750.0 -> latest in range
- `@redocly/cli`, `@types/bun`, `drizzle-kit`, `eslint`, `happy-dom`, `knip`, `turbo`, and more

### Overrides added

- `ioredis: 5.10.1` — force single version to fix type mismatch with bullmq
- `better-sqlite3: npm:better-sqlite3-multiple-ciphers` — alias for drizzle-orm's optional peer dep

### Verification

- Typecheck: all 14 packages pass
- Lint: all 12 packages pass (zero warnings)
- Format: clean
- Tests: 363 suites, 5195 tests all pass
