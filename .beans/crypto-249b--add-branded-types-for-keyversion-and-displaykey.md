---
# crypto-249b
title: Add branded types for keyVersion and displayKey
status: draft
type: task
priority: normal
created_at: 2026-03-14T08:08:32Z
updated_at: 2026-03-14T08:08:32Z
---

Cross-cutting change: keyVersion: number → BucketKeyVersion, displayKey: string → RecoveryKeyDisplay. Affects packages/types and packages/crypto (T2EncryptedBlob, BucketKeyRotation, all crypto functions). Should be a separate PR.
