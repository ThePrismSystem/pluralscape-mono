---
# sync-orkv
title: Type applyLocalChange with document-specific generic
status: todo
type: task
priority: high
created_at: 2026-04-20T09:22:12Z
updated_at: 2026-04-20T09:22:12Z
parent: sync-me6c
---

Finding [T-2] from audit 2026-04-20. packages/sync/src/engine/sync-engine.ts:251. changeFn typed (doc: unknown)=>void; callers can mutate wrong document type without type error. Fix: <T>(docId, changeFn: (doc: T) => void) paired with T-1.
