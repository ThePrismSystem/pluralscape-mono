---
# api-9kl9
title: Audit PGlite integration tests against Testcontainers requirement
status: completed
type: task
priority: normal
created_at: 2026-04-08T02:08:36Z
updated_at: 2026-04-16T06:47:02Z
---

PR #399 review flagged that several apps/api/src/**tests**/services/\*.integration.test.ts files labeled as integration tests are using @electric-sql/pglite (WASM Postgres) rather than real production Postgres. The project testing rule in CLAUDE.md requires integration tests to hit real I/O — PGlite is stronger than mocks but does not exercise the postgres-js driver, real connection pooling, or RLS policies as applied by the API auth middleware.

## Scope

- Enumerate all \*.integration.test.ts under apps/api/src/**tests**/services/ that use PGlite
- Decide per-file whether PGlite is acceptable or whether the test must be upgraded to Testcontainers-postgres
- Particular concern: RLS-sensitive and auth-middleware-sensitive tests (member.service, auth.service, field-definition.service)
- If upgrades are needed, produce a migration plan

## Context

PR #399 introduced or expanded several PGlite-based 'integration' tests. Examples:

- member.service.integration.test.ts (830 lines)
- field-definition.service.integration.test.ts (442 lines)
- auth.service.integration.test.ts (383+ lines)
- recovery-key.service.integration.test.ts (passes DecryptionFailedError test via PGlite)

Reviewer note: PGlite 'is real Postgres compiled to WASM, which is better than mocks, but does not exercise the production postgres-js driver, real connection pooling, RLS policies applied by the API auth middleware, or prepared-statement behavior.'

## Parent

Created as follow-up from ps-1o81 (PR #399 review fixes).
