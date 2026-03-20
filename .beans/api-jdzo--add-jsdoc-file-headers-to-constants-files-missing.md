---
# api-jdzo
title: Add JSDoc file headers to constants files missing them
status: completed
type: task
priority: low
created_at: 2026-03-18T15:58:21Z
updated_at: 2026-03-20T10:27:05Z
parent: api-765x
---

L2: Add descriptive JSDoc headers to constants files that are missing them.

## Acceptance Criteria

- All `*.constants.ts` files have a JSDoc file-level header describing their scope
- Each exported constant has a JSDoc comment explaining its purpose
- Follows existing exemplars: `packages/crypto/src/crypto.constants.ts`, `packages/queue/src/queue.constants.ts`

## Summary of Changes

Verified all \*.constants.ts files in apps/api/src already have JSDoc file
headers. No changes needed.
