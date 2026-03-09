---
# types-ywkj
title: Enforce encrypted/decrypted type boundary at compile time
status: todo
type: task
priority: high
created_at: 2026-03-09T12:13:33Z
updated_at: 2026-03-09T12:13:33Z
parent: ps-rdqo
---

When implementing API routes, ensure compile-time enforcement that routes returning ServerMember (with EncryptedBlob fields) cannot accidentally return ClientMember (with decrypted fields). The Encrypted<T>/BucketEncrypted<T>/Plaintext<T> wrappers and Server/Client variants exist in encryption.ts but nothing consumes them yet. Design the middleware/helper that enforces this at the API layer.

Source: Architecture Audit 004, Metric 2
