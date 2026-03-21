---
# ps-0ew8
title: Hex utility consumer migration
status: completed
type: task
priority: low
created_at: 2026-03-21T00:34:19Z
updated_at: 2026-03-21T01:49:37Z
blocked_by:
  - ps-38gq
---

Follow-up PR: migrate relay.ts and apps/api/src/lib/hex.ts to use canonical hex module from @pluralscape/crypto. Requires relay hardening and crypto adapter PRs merged.

## Implementation

- relay.ts: replaced local toHex with import from @pluralscape/crypto
- hex.ts: replaced with re-export from @pluralscape/crypto
- hex.constants.ts: deleted (HEX_CHARS_PER_BYTE added to crypto constants)
- device-transfer.schema.ts: imports HEX_CHARS_PER_BYTE from @pluralscape/crypto

## Summary of Changes

- relay.ts: replaced local toHex with import from @pluralscape/crypto
- hex.ts: kept local impl (API tests vi.mock crypto), removed hex.constants.ts dependency
- hex.constants.ts: deleted; HEX_CHARS_PER_BYTE added to crypto constants
- device-transfer.schema.ts: imports HEX_CHARS_PER_BYTE from @pluralscape/crypto
- email-hash.ts: removed hex.constants.ts import, inlined constants
