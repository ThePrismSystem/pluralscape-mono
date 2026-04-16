---
# api-nb7s
title: Fix PR review issues for recovery key endpoints
status: completed
type: task
priority: normal
created_at: 2026-03-17T08:12:33Z
updated_at: 2026-04-16T07:29:43Z
parent: ps-rdqo
---

Fix all issues from PR #152 review: 3 critical bugs (race condition, JSON parse, ZodError catch), 5 important issues (schema literal, crypto zeroing, constants, discriminated union, tests), and 2 suggestions (HTTP 201, pre-push hook). Create follow-up beans for deferred S3/S4.

## Summary of Changes

- **Schema (I1):** `z.boolean()` → `z.literal(true)` for confirmed field, pushes rejection to schema boundary
- **Constants (I3):** Extracted `INCORRECT_PASSWORD_ERROR` to shared `services/auth.constants.ts`
- **Discriminated union (I4):** `RecoveryKeyStatus` is now a discriminated union on `hasActiveKey`
- **Dead code removal (I1):** Removed redundant `if (!parsed.confirmed)` guard from service
- **Race condition fix (C1):** Added `isNull(recoveryKeys.revokedAt)` to UPDATE WHERE clause in transaction
- **Crypto zeroing (I2):** Hoisted `serializedBackup` and `newRecoveryKeyResult` for zeroing in finally block (5 buffers total)
- **JSON parse guard (C2):** Added try/catch around `c.req.json()` for malformed JSON
- **ZodError catch (C3):** Added ZodError handler in route catch block
- **HTTP 201 (S1):** Regenerate endpoint now returns 201 Created
- **Pre-push hook (S2):** Added `set -e`/`set +e` around migration freshness check
- **Tests (I5):** Added tests for null encrypted master key, invalid KDF salt, TOCTOU race, malformed JSON, ZodError route handling; updated memzero call counts to 5
- **Follow-up beans:** types-ok7n (as UnixMillis helper), crypto-r1go (branded RecoveryKeyDisplay type)
