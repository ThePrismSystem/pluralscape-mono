---
# crypto-w0fu
title: Zero key material after use in rotation-worker
status: completed
type: bug
priority: normal
created_at: 2026-04-14T09:29:43Z
updated_at: 2026-04-16T07:29:54Z
parent: ps-h2gl
---

AUDIT [ROTWORKER-S-M1] Plaintext key material (oldKey, newKey) not zeroed after start() resolves. Config object holds references throughout lifetime. Plaintext not zeroed after re-encryption in chunk-processor.ts:58-68.

## Summary of Changes\n\nAdded memzero calls in rotation-worker start() finally block for oldKey/newKey. Added plaintext zeroing in chunk-processor after re-encryption via getSodium().memzero().
