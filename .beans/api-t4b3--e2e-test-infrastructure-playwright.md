---
# api-t4b3
title: E2E test infrastructure (Playwright)
status: completed
type: task
priority: normal
created_at: 2026-03-19T04:52:16Z
updated_at: 2026-03-19T06:18:55Z
parent: api-765x
---

Stand up Playwright API testing against real Hono server + real Postgres. Depends on v1 route prefix.

## Summary of Changes\n\nStood up Playwright E2E test infrastructure:\n- Docker Postgres auto-provisioning in global-setup/teardown\n- Drizzle migration script for schema setup\n- Auth fixture with per-test account registration\n- Crypto fixture for real libsodium encryption round-trips\n- 22 tests: health, auth, systems, members (with encryption), account\n- CI job with Postgres 17 service\n\nBugs found and fixed during E2E development:\n- enumCheck() used bind params in DDL (Postgres 42P02)\n- isUniqueViolation() didn't unwrap DrizzleQueryError.cause\n- member.deleted missing from AUDIT_EVENT_TYPES enum
