---
# api-e127
title: Add deployment-mode guard to search_index write path
status: todo
type: task
priority: normal
created_at: 2026-03-12T20:22:55Z
updated_at: 2026-03-12T20:22:55Z
---

API layer must gate writes to search_index based on deployment mode. ADR 018 already states this; the schema audit flagged the missing implementation. Enforce at the API layer, not the DB.
