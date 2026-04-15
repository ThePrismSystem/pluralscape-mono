---
# ps-f5mh
title: "Zero-knowledge violation: migrate server-side master key operations to client"
status: todo
type: bug
priority: critical
created_at: 2026-04-15T07:34:35Z
updated_at: 2026-04-15T07:34:35Z
---

The server generates and handles plaintext master key material in 4 code paths (registration, password change, recovery key regeneration, password reset). This violates the stated zero-knowledge architecture. All key generation and derivation must move to the client, with the server only storing opaque encrypted blobs.
