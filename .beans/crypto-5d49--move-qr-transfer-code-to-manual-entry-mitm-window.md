---
# crypto-5d49
title: Move QR transfer code to manual entry (MITM window)
status: completed
type: bug
priority: high
created_at: 2026-04-20T09:22:50Z
updated_at: 2026-04-20T11:49:47Z
parent: crypto-cpir
---

Finding [H1] from audit 2026-04-20. packages/crypto/src/device-transfer.ts:238-244. 10-digit code (~33.2 bits) and Argon2id salt both serialized into QR payload. Anyone photographing/capturing the QR derives the transfer key without additional secret. Fix: move code to manual entry; put only requestId+salt in QR.

## Summary of Changes

QR transfer payload no longer embeds the 10-digit code; it now carries only requestId + salt. The code is entered manually, closing the MITM window from QR photography.

- `packages/crypto/src/device-transfer.ts`: updated `encodeQRPayload` / `decodeQRPayload` / `DecodedQRPayload` shape; security-model JSDoc reflects two-factor split.
- `packages/crypto/src/__tests__/device-transfer.test.ts`: assert no `code` field in encoded payload and legacy-client tolerance.
- `apps/mobile/src/hooks/use-device-transfer.ts`: module-level JSDoc documents UX contract (manual code entry paired with scanned salt).
- `docs/security/threat-model.md`: L6 marked implemented.
