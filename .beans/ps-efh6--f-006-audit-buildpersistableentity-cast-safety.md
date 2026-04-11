---
# ps-efh6
title: "F-006: Audit buildPersistableEntity cast safety"
status: todo
type: task
priority: normal
created_at: 2026-04-10T21:05:42Z
updated_at: 2026-04-10T21:05:42Z
parent: ps-n0tq
---

buildPersistableEntity in import-engine.ts:89-99 casts as PersistableEntity from untyped payload, bypassing discriminated union narrowing. Low risk (mapper types checked at dispatch boundary). Consider debug assertion.
