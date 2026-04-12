---
# ps-efh6
title: "F-006: Audit buildPersistableEntity cast safety"
status: completed
type: task
priority: normal
created_at: 2026-04-10T21:05:42Z
updated_at: 2026-04-11T21:31:35Z
parent: ps-n0tq
---

buildPersistableEntity in import-engine.ts:89-99 casts as PersistableEntity from untyped payload, bypassing discriminated union narrowing. Low risk (mapper types checked at dispatch boundary). Consider debug assertion.

## Summary of Changes

Added a runtime guard in `buildPersistableEntity` (import-engine.ts) that rejects null and primitive payloads with a descriptive error, so a misrouted dispatch table surfaces as a visible failure rather than a silent cast. Preserves the controlled single cast pattern for valid object payloads.
