---
# ps-v159
title: "F-009: Verify boardMessage field names against SP API"
status: completed
type: task
priority: normal
created_at: 2026-04-10T21:05:42Z
updated_at: 2026-04-11T21:31:50Z
parent: ps-n0tq
---

SPBoardMessage uses writer/readBy but SP API may use writtenBy/writtenFor/read. Internal types are self-consistent but may mismatch real API. Verify against SP source.

## Summary of Changes

Verified `SPBoardMessage` field names against upstream SP AJV schema in `src/api/v1/board.ts`. Real SP uses `writtenBy`, `writtenFor`, `writtenAt`, `read`, `supportMarkdown` — not `writer` or `readBy`. Updated:

- `SPBoardMessage` interface: `writer` to `writtenBy`, removed `readBy`, added `writtenFor?`, `read?`, `supportMarkdown?`.
- `SPBoardMessageSchema`: matches new shape.
- `board-message.mapper.ts`: resolves `sp.writtenBy`, emits separate drop warnings for `writtenFor` and `read`, updates `targetField` to `writtenBy`.
- `board-message.mapper.test.ts` and `sp-payload.test.ts`: updated fixtures, added "rejects legacy writer field" assertion.
