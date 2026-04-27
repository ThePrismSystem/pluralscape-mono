---
# ps-znp0
title: Inline or relocate decode-blob asserts after friend-dashboard migrates
status: todo
type: task
created_at: 2026-04-27T19:00:19Z
updated_at: 2026-04-27T19:00:19Z
parent: ps-cd6x
---

Consolidate the remaining `assertObjectBlob` and `assertStringField` helpers in `packages/data/src/transforms/decode-blob.ts` once `friend-dashboard.ts` (their sole remaining consumer) migrates to its own validation pattern.

## Background

After `types-emid` (PR #579):

- `assertArrayField` was removed (zero callers).
- `assertObjectBlob` retained — only consumer is `packages/data/src/transforms/friend-dashboard.ts` (T2 path with cross-account-bucket decryption, out of scope for types-emid).
- `assertStringField` retained — same single consumer in `friend-dashboard.ts`.

Single-consumer helpers in `decode-blob.ts` are a code smell; either inline them into `friend-dashboard.ts` or move them to a sibling `friend-dashboard-asserts.ts`. Cleanest approach is to migrate `friend-dashboard.ts` to a Zod schema (matching the rest of the fleet), at which point both helpers can be deleted.

## Acceptance

- Either: `friend-dashboard.ts` migrates to a Zod schema for its decrypted-blob shapes, eliminating both helpers; OR the helpers are inlined into `friend-dashboard.ts` as private functions.
- `packages/data/src/transforms/decode-blob.ts` no longer exports `assertObjectBlob` / `assertStringField`.
- Existing `friend-dashboard` tests still pass.

## Related

- types-emid (PR #579 — established the Zod-at-decrypt pattern)
- ps-cd6x (Milestone 9a)
