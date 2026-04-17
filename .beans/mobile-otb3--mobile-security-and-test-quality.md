---
# mobile-otb3
title: Mobile security and test quality
status: completed
type: task
priority: low
created_at: 2026-04-16T06:58:07Z
updated_at: 2026-04-17T09:19:12Z
parent: ps-0enb
---

Low-severity mobile findings from comprehensive audit.

## Findings

- [x] [MOBILE-S-L1] expo-secure-store session token without WHEN_UNLOCKED_THIS_DEVICE_ONLY
- [x] [MOBILE-S-L2] SSE error handler embeds up to 200 chars of raw payload
- [x] [MOBILE-TC-L1] 236 toBeDefined() assertions — mostly redundant
- [x] [MOBILE-TC-L2] \_layout.test.tsx only tests loading state
- [x] [MOBILE-TC-L3] BootstrapGate.test.tsx uses toBeDefined() on getByText()

## Summary of Changes

- **MOBILE-S-L1**: `expo-secure-store` session token writes now pass
  `{ keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY }`. Failed reads
  on boot fail-closed (treated as logged-out).
- **MOBILE-S-L2**: SSE error handler no longer embeds any payload excerpt.
  Added 3-case redaction test asserting the content stays redacted for
  short, long, and mixed payloads.
- **MOBILE-TC-L1**: Full triage of 243 `toBeDefined()` assertions across
  46 files. 227 replaced with meaningful assertions (bulk pattern:
  `isSuccess === true` for React Query hooks; concrete shape/enum/length
  assertions elsewhere). 16 deleted as redundant. Added regression guard
  at `apps/mobile/src/__tests__/assertion-quality.test.ts`.
- **MOBILE-TC-L2**: `_layout.test.tsx` extended from 2 loading-only tests
  to 7 covering loading, loaded, and error states with real assertions.
- **MOBILE-TC-L3**: `BootstrapGate.test.tsx` rewritten with `textContent`
  regex + role-based queries; zero `toBeDefined()` remaining.

Follow-up candidate noted: `apps/mobile/src/features/import-sp/sp-token-storage.ts`
has the same accessibility pattern as the session token store but was not
hardened in this PR.
