---
# sync-ldoi
title: Bind authorPublicKey to encryption key in sync envelopes
status: todo
type: bug
priority: high
created_at: 2026-04-20T09:22:12Z
updated_at: 2026-04-20T09:22:12Z
parent: sync-me6c
---

Finding [H2] from audit 2026-04-20. packages/sync/src/encrypted-sync.ts:35,73. Signature over ciphertext using signing key; no cryptographic binding between signing keypair and encryption key. verifyKeyOwnership checks registration but not that same key was used for encryption. Fix: bind via KDF or include encryption key's public representation in signed AD.
