---
# api-zoid
title: "Fix all PR #190 review findings"
status: completed
type: task
priority: normal
created_at: 2026-03-19T06:38:55Z
updated_at: 2026-04-16T07:29:45Z
parent: ps-afy4
---

Address 14 review findings from PR #190 (feat/e2e-test-infrastructure): bigint CAST for TTL, shutdown hardening, discriminated union for db.ts, CI env cleanup, schema-to-ddl fixes, access log health skip, unique-violation cause chain, and test.step refactor.

## Summary of Changes

### Step 1: Cast TTL expressions to bigint (#1 — Critical)

- Wrapped EXTRACT(EPOCH...) \* 1000 in CAST(... AS bigint) in session-idle-filter.ts
- Updated sessions_ttl_duration_ms_idx expression index in auth.ts schema to match
- Generated new migration 0001_slippery_red_skull.sql
- Added test asserting CAST/bigint in SQL output

### Step 2: Harden shutdown and startup lifecycle (#2, #3, #4, #8)

- Added SERVER_STOP_TIMEOUT_SECONDS constant and timeout race for server.stop()
- Added shutdownInProgress guard to prevent duplicate shutdown on rapid signals
- Replaced execSync with execFileSync in global-setup.ts migration call
- Added PID guard after spawn in global-setup.ts
- Updated shutdown tests for new behavior (logs warning + continues instead of propagating)

### Step 3: Refactor db.ts to discriminated union (#5, #12)

- Replaced three loose variables with a DbState discriminated union
- Made getDb() non-async to preserve promise identity for concurrent callers
- setDbForTesting() without rawClient now provides a no-op closeable
- Added getDb tests: concurrent dedup, caching, retry-after-failure, dialect check

### Step 4: Remove CI EMAIL_HASH_PEPPER override (#6)

- Removed EMAIL_HASH_PEPPER secret reference from ci.yml e2e job

### Step 5: Harden schema-to-ddl (#7, #13)

- escapeDefault now handles SQL objects via renderSQL and escapes single quotes
- Added onUpdate to FK type and rendering for both single and multi-column FKs

### Step 6: Skip health check in access log (#11)

- Added early return for /health path in access-log middleware
- Added test verifying no log for health checks

### Step 7: Walk cause chain in unique-violation (#14)

- isUniqueViolation now walks full .cause chain up to MAX_CAUSE_DEPTH
- Added tests for deeply nested and non-matching cause chains

### Step 8: Refactor members CRUD to use test.step (#10)

- Broke mega-test into named test.step() sections for better Playwright reporting
