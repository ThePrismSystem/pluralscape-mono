---
# crypto-r1go
title: Add branded RecoveryKeyDisplay type
status: completed
type: task
priority: normal
created_at: 2026-03-17T08:17:57Z
updated_at: 2026-03-21T12:26:00Z
parent: api-0zl4
---

Cross-package change: introduce a branded RecoveryKeyDisplay type to prevent accidental logging/persistence of recovery key display strings. Deferred from PR #152 review (S4).

## Summary of Changes\n\nAdded `RecoveryKeyDisplay` branded type to `packages/types/src/ids.ts`. Updated `RecoveryKeyResult.displayKey` in `packages/crypto/src/recovery.ts` to use the branded type. Cast applied at the generation site in `generateRecoveryKey()`.
