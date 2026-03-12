---
# db-vn6b
title: Adopt branded ID types in search module interfaces
status: todo
type: task
created_at: 2026-03-12T11:54:24Z
updated_at: 2026-03-12T11:54:24Z
---

The schema layer (packages/db/src/schema/) consistently uses plain string for IDs. Adopting branded types (SystemId, etc.) in the search interfaces (both PG and SQLite) would require changes across both dialects and all callers. This is a cross-cutting change best tracked separately.
