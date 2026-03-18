---
# client-cdhw
title: Implement client-side rotation worker
status: in-progress
type: task
priority: normal
created_at: 2026-03-09T12:42:40Z
updated_at: 2026-03-18T00:14:44Z
parent: ps-rdqo
blocked_by:
  - crypto-gkaa
  - api-g954
---

Client logic for lazy key rotation (ADR 014): claim chunks from rotation API, decrypt with old bucket key, re-encrypt with new bucket key, upload with updated keyVersion. Support concurrent device participation, dual-key read window (check EncryptedBlob.keyVersion), graceful offline/resume, 3x retry per item. Integrate with CRDT sync layer.
