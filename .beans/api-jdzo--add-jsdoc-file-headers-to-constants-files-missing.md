---
# api-jdzo
title: Add JSDoc file headers to constants files missing them
status: todo
type: task
priority: low
created_at: 2026-03-18T15:58:21Z
updated_at: 2026-03-19T11:39:43Z
parent: api-765x
---

L2: Add descriptive JSDoc headers to constants files that are missing them.

## Acceptance Criteria

- All `*.constants.ts` files have a JSDoc file-level header describing their scope
- Each exported constant has a JSDoc comment explaining its purpose
- Follows existing exemplars: `packages/crypto/src/crypto.constants.ts`, `packages/queue/src/queue.constants.ts`
