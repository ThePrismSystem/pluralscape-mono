---
# api-r6r9
title: Document in-memory Valkey fallback + production warning
status: todo
type: task
priority: low
created_at: 2026-04-18T01:43:09Z
updated_at: 2026-04-18T01:43:09Z
parent: ps-0enb
---

## Context

PR #465 Phase 5 (commit `ba1e6674`) added `InMemoryValkeyCacheClient` to `apps/api/src/lib/valkey-cache.ts` so single-instance deployments and E2E suites work without a real Valkey/Redis. The fallback activates in `services/i18n-deps.ts` when `getSharedValkeyClient()` returns null.

Class-level JSDoc documents the multi-instance caveat, but a production operator won't find it by grep. Spec reviewer flagged this as worth a follow-up.

## Goal

Surface the in-memory-fallback behavior in operational docs and add a startup warning when it activates without an explicit opt-in.

## Todo

- [ ] Add an entry to the deployment docs (wherever `VALKEY_URL` is documented) noting that omitting the var causes the API to fall back to per-process in-memory caches — fine for single-instance / dev, undefined behavior for multi-replica
- [ ] Emit a `logger.warn(...)` at service startup when the in-memory fallback is actually constructed (not on every request), so operators have a log signal
- [ ] Consider whether a `NODE_ENV === "production"` check should escalate to an error or require an explicit `ALLOW_IN_MEMORY_CACHE=1` opt-in
- [ ] Decide whether to add an ADR note pointing to the trade-off
- [ ] Update the related i18n OTA ADR (035) if needed

## Notes

Non-urgent. The fallback is safe; this bean is about operator visibility.
