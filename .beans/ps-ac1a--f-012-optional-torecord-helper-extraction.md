---
# ps-ac1a
title: "F-012: Optional toRecord helper extraction"
status: completed
type: task
priority: low
created_at: 2026-04-10T21:05:42Z
updated_at: 2026-04-11T21:32:04Z
parent: ps-n0tq
---

file-source.ts:255 uses same as Record cast pattern as mapper-dispatch.ts. Cosmetic — optionally extract shared toRecord helper.

## Summary of Changes

Extracted the duplicated `toRecord` helper from `engine/mapper-dispatch.ts` and the inline cast in `sources/file-source.ts` into a new shared utility `packages/import-sp/src/shared/to-record.ts`. Both call sites now import from the shared module, eliminating the duplication noted in the audit. Includes a JSDoc explaining the invariant that callers must have already verified `typeof v === "object" && v !== null` before calling.
