---
# sync-ldoi
title: Bind authorPublicKey to encryption key in sync envelopes
status: completed
type: bug
priority: high
created_at: 2026-04-20T09:22:12Z
updated_at: 2026-04-21T00:31:10Z
parent: sync-me6c
---

Finding [H2] from audit 2026-04-20. packages/sync/src/encrypted-sync.ts:35,73. Signature over ciphertext using signing key; no cryptographic binding between signing keypair and encryption key. verifyKeyOwnership checks registration but not that same key was used for encryption. Fix: bind via KDF or include encryption key's public representation in signed AD.

## Summary of Changes

authorPublicKey is now cryptographically bound to the encryption key via
AEAD additional-data inclusion. Any forged envelope whose signing key
does not match the encryption key used to produce its ciphertext is
rejected by decryptChange/decryptSnapshot with KeyBindingMismatchError.

AD byte layout (change):
[0..7] domain-sep 'PLS-CHG1'
[8..39] authorPublicKey (32 bytes)
[40..] utf8(documentId)

AD byte layout (snapshot):
[0..7] domain-sep 'PLS-SNP1'
[8..39] authorPublicKey (32 bytes)
[40..47] big-endian uint64 snapshotVersion
[48..] utf8(documentId)

Added verifyKeyBinding() for callers that want to assert binding without
recovering plaintext. Exported KeyBindingMismatchError from the package.
Added four negative tests covering both change and snapshot paths.
