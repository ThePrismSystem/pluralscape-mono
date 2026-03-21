---
# crypto-ktqy
title: "Fix PR #217 review findings for hex utility consolidation"
status: completed
type: task
priority: normal
created_at: 2026-03-21T02:06:56Z
updated_at: 2026-03-21T02:07:03Z
---

Address 6 review findings from PR #217: use HEX_CHARS_PER_BYTE constant in canonical hex.ts, replace inline hex parsing in email-hash.ts with fromHex(), fix sub-path reference and JSDoc in API hex.ts, alphabetize and add HEX_RADIX export in crypto index.ts, update test expected error message.

## Summary of Changes

- `packages/crypto/src/hex.ts`: Import and use `HEX_CHARS_PER_BYTE` constant instead of 5 hardcoded `2` literals
- `packages/crypto/src/index.ts`: Move `HEX_CHARS_PER_BYTE` to alphabetical position, add missing `HEX_RADIX` export
- `apps/api/src/lib/email-hash.ts`: Replace inline hex parsing loop with `fromHex()` call, remove local constants
- `apps/api/src/lib/hex.ts`: Fix `@pluralscape/crypto/hex` → `@pluralscape/crypto` sub-path reference, standardize JSDoc
- `apps/api/src/__tests__/lib/email-hash.test.ts`: Update expected error message to match `fromHex()` output
