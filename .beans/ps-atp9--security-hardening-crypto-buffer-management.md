---
# ps-atp9
title: "Security hardening: crypto buffer management"
status: completed
type: task
priority: low
created_at: 2026-04-06T00:53:10Z
updated_at: 2026-04-06T09:45:38Z
parent: ps-y621
---

Three minor crypto buffer management improvements:

1. packages/crypto/src/key-grants.ts:137-139 — parseEnvelope returns subarray view instead of copying key bytes. Full plaintext buffer remains addressable. Fix: copy the 32-byte key slice.

2. packages/crypto/src/bucket-keys.ts:111-115 — rotateBucketKey does not zero intermediate plaintext from decrypt inside reEncrypt. Plaintext copies accumulate during long runs. Fix: zero after re-encryption.

3. ~~apps/mobile/src/hooks/use-members.ts:46-49 — select callback throws generic Error('masterKey is null')~~ **FIXED** — masterKey pattern removed by M8 hook refactoring.

Audit ref: Pass 2 LOW

## Summary of Changes

1. key-grants.ts: Changed plaintext.subarray(offset) to plaintext.slice(offset) for independent buffer copy.
2. bucket-keys.ts: Added plaintext.fill(0) after re-encryption in rotateBucketKey.
   Item 3 was already fixed by M8 hook refactoring.
