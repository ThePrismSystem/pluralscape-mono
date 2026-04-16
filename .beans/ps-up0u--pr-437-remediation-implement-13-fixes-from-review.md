---
# ps-up0u
title: "PR #437 remediation: implement 13 fixes from review"
status: completed
type: epic
priority: normal
created_at: 2026-04-14T20:31:10Z
updated_at: 2026-04-16T07:29:55Z
parent: ps-h2gl
---

Execute implementation plan for 13 fixes identified during PR review. See docs/superpowers/plans/2026-04-14-pr437-remediation.md

## Summary of Changes

13 commits implementing 12 of 13 review findings:

**Critical:** StoredJobDataSchema completed with all 17 fields
**Important:** EntityChangeEventSchema boardMessage split, computeNextCheckInAt accepts nowMs + time validation, ZodError guards in BullMQ, plaintext zeroing in try/finally, computeNextCheckInAt unit tests, RotationSodium made required
**Suggestions:** crypto docs updated, member/group blob validation tests, redundant isWithinWakingHours removed

**Reverted:** encryptedMasterKey ciphertext zeroing (blob needed for re-auth cycles)
**Deferred:** Task 11 (Zod rejection integration tests) — requires running Valkey/Redis infrastructure

All 7546 unit tests passing across 559 test files.
