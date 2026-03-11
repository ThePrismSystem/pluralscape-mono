---
# db-kveq
title: Document or fix nonce storage for encryptedData blobs
status: todo
type: bug
priority: high
created_at: 2026-03-11T04:47:31Z
updated_at: 2026-03-11T19:39:42Z
parent: db-bbzk
---

Crypto layer returns {ciphertext, nonce}. Schema stores only encryptedData as binary. No nonce column anywhere. Either nonces are prepended to ciphertext (acceptable but undocumented) or being dropped (catastrophic). Also applies to keyGrants.encryptedKey. Ref: audit H6
