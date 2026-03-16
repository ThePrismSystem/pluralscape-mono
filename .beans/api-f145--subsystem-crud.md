---
# api-f145
title: Subsystem CRUD
status: todo
type: task
priority: normal
created_at: 2026-03-16T11:57:08Z
updated_at: 2026-03-16T11:58:17Z
parent: api-puib
blocked_by:
  - api-o89k
  - api-wq3i
---

POST /systems/:systemId/subsystems (name, parentSubsystemId, architectureType discriminated union, hasCore, discoveryStatus in encryptedData). GET list. GET by ID. PUT with OCC. Recursive nesting with cycle detection. Archive/restore.
