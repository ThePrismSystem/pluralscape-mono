---
# api-kxth
title: Split apps/api-e2e/src/fixtures/endpoint-registry.ts (509 to <=400)
status: completed
type: task
priority: normal
created_at: 2026-04-30T21:22:12Z
updated_at: 2026-04-30T21:31:39Z
parent: ps-r5p7
---

## Summary of Changes

Split endpoint-registry.ts (509 LOC) into apps/api-e2e/src/fixtures/endpoint-registry/{helpers,account,system,mutations,import}.ts barrel pattern.
Original path remains as barrel composing the registry.
