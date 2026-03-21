---
# ps-m0tm
title: Evaluate encrypted-roundtrip.test.ts overlap with typed-encrypted-roundtrip.test.ts
status: completed
type: task
priority: normal
created_at: 2026-03-21T02:57:09Z
updated_at: 2026-03-21T07:54:25Z
parent: ps-i3xl
---

Consider removing simpler version

## Summary of Changes\n\nInvestigated: encrypted-roundtrip.test.ts (345 lines) tests generic schemas + error paths (SignatureVerificationError, tampered ciphertext). typed-encrypted-roundtrip.test.ts (480 lines) tests real document types (SystemCore, Fronting, Chat). Not redundant — keep both.
