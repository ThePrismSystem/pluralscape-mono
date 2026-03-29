---
# api-249r
title: Add decryption round-trip test for encryptWebhookPayload
status: completed
type: task
priority: high
created_at: 2026-03-29T07:11:28Z
updated_at: 2026-03-29T08:23:22Z
parent: api-kjyg
blocked_by:
  - api-l1sn
---

webhook-payload-encryption.test.ts only verifies output differs from input. No decryption counterpart verifies correctness. Add structural assertion verifying output length = nonce(12) + ciphertext + authTag(16). Depends on H1 — if encryption is removed, this bean is moot.

## Summary of Changes

Added comprehensive round-trip tests (normal, empty, large, unicode), structural length assertion, and failure tests (wrong key, tampered ciphertext, truncated input) for the XChaCha20-Poly1305 webhook payload encryption.
