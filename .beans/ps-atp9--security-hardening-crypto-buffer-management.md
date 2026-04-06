---
# ps-atp9
title: "Security hardening: crypto buffer management"
status: todo
type: task
priority: low
created_at: 2026-04-06T00:53:10Z
updated_at: 2026-04-06T00:53:10Z
parent: ps-y621
---

Three minor crypto buffer management improvements:

1. packages/crypto/src/key-grants.ts:137-139 — parseEnvelope returns subarray view instead of copying key bytes. Full plaintext buffer remains addressable. Fix: copy the 32-byte key slice.

2. packages/crypto/src/bucket-keys.ts:111-115 — rotateBucketKey does not zero intermediate plaintext from decrypt inside reEncrypt. Plaintext copies accumulate during long runs. Fix: zero after re-encryption.

3. apps/mobile/src/hooks/use-members.ts:46-49 (and all similar hooks) — select callback throws generic Error('masterKey is null'). Consider typed KeysLockedError for diagnostics.

Audit ref: Pass 2 LOW
