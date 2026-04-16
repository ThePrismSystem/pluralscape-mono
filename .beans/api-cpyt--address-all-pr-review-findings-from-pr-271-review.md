---
# api-cpyt
title: "Address all PR review findings from PR #271 review"
status: completed
type: task
priority: normal
created_at: 2026-03-25T02:18:13Z
updated_at: 2026-04-16T07:29:49Z
parent: ps-53up
---

Fix critical timing oracle in loginAccount, consolidate duplicate equalizeAntiEnumTiming, fix biometric audit rollback, add fail-closed logging, normalize tenantCtx usage across 15 services, inline rls-context helpers, and add missing tests.

## Summary of Changes

- **CRITICAL: Fixed timing oracle in loginAccount** — added equalizeAntiEnumTiming to invalid-password path so attackers cannot distinguish 'wrong password' from 'not found' via timing
- **Consolidated duplicate equalizeAntiEnumTiming** — removed from auth.constants.ts (a constants file should not export functions), canonical copy in lib/anti-enum-timing.ts
- **Fixed biometric audit rollback** — restructured verifyBiometric to return discriminated result from transaction, throw outside; audit writes now commit for both success and failure paths
- **Added fail-closed logging for sync-relay** — PgSyncRelayService now logs warning when operating without RLS context
- **Added WebSocket unknown-IP logging** — per-IP limiting now logs when IP cannot be determined
- **Wrapped loginStore.reset() in try/catch** — success path now tolerates Valkey outages symmetrically with failure paths
- **Normalized tenantCtx() usage** — replaced 73 inline { systemId, accountId: auth.accountId } patterns across 15 service files with tenantCtx(systemId, auth) helper
- **Inlined rls-context.ts private helpers** — removed withTenant/withAccount wrappers used only once each
- **Fixed fragile comment** — generateFakeRecoveryKey now references chars.length instead of hardcoded 32
- **Added no-op vi.mock comments** — documented pass-through drizzle-orm mocks in account and recovery-key test files
- **Added equalizeAntiEnumTiming tests** — 3 new tests in auth.service.test.ts: called on not-found, called on invalid-password, not called on success
- **Fixed bean summary** — api-uzyn body text now accurately describes the throttle timing fix
