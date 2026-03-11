---
# db-kveq
title: Document or fix nonce storage for encryptedData blobs
status: completed
type: bug
priority: high
created_at: 2026-03-11T04:47:31Z
updated_at: 2026-03-11T22:31:48Z
parent: db-bbzk
---

Crypto layer returns {ciphertext, nonce}. Schema stores only encryptedData as binary. No nonce column anywhere. Either nonces are prepended to ciphertext (acceptable but undocumented) or being dropped (catastrophic). Also applies to keyGrants.encryptedKey. Ref: audit H6

## Summary of Changes

Already solved by blob-codec wire format — nonces are embedded per-blob in the [header][24B nonce][ciphertext] layout. Added JSDoc documentation to blob-codec.ts and column helpers. Added "distinct nonces survive round-trip" test.
