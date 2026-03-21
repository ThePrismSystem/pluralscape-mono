---
# crypto-249b
title: Add branded types for keyVersion and displayKey
status: completed
type: task
priority: normal
created_at: 2026-03-14T08:08:32Z
updated_at: 2026-03-21T12:26:00Z
parent: api-0zl4
---

Cross-cutting change: keyVersion: number → BucketKeyVersion, displayKey: string → RecoveryKeyDisplay. Affects packages/types and packages/crypto (T2EncryptedBlob, BucketKeyRotation, all crypto functions). Should be a separate PR.

## Progress

- **keyVersion branded type**: DONE — `KeyVersion` exists as `NumericBrand<"KeyVersion">` in `packages/crypto/src/types.ts`
- **displayKey branded type**: NOT DONE — still plain `string` in `password-reset.ts` and elsewhere

## Summary of Changes\n\nMerged with crypto-r1go. KeyVersion was already branded. RecoveryKeyDisplay branding implemented in crypto-r1go.
