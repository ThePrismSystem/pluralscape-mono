---
# ps-zjq0
title: "F-007: Truncate large error ref lists in group mapper"
status: completed
type: task
priority: normal
created_at: 2026-04-10T21:05:42Z
updated_at: 2026-04-11T21:31:50Z
parent: ps-n0tq
---

group.mapper.ts:47 joins all missing member refs into one error string. 500 unresolved refs = very long message. Truncate to first N with 'and M more' suffix.

## Summary of Changes

Added `summarizeMissingRefs(refs)` helper in `mappers/helpers.ts` that renders up to 5 source IDs inline with an "and N more" suffix for the remainder. Integrated into `group.mapper.ts` so huge missing-ref lists stay readable in error logs while the full list remains on the structured `missingRefs` field. Added unit tests covering the under-limit, at-limit, and over-limit cases.
