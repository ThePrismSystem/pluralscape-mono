---
# ps-jrsj
title: E2E test coverage expansion
status: todo
type: task
priority: low
created_at: 2026-04-16T06:58:55Z
updated_at: 2026-04-16T06:58:55Z
parent: ps-0enb
---

Low-severity E2E test coverage findings from comprehensive audit.

## Findings

- [ ] [E2E-L1] Webhook config CRUD only exercised as cleanup helpers
- [ ] [E2E-L2] Rate-limit tests use test.skip with env guard
- [ ] [E2E-L3] sync-ws.spec.ts uses setInterval polling — potential flaky pattern
- [ ] [E2E-L4] No IDOR test coverage verified for all entity types
- [ ] [E2E-L5] No test for presigned URL write-once bypass
