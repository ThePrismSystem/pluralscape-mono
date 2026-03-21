---
# types-vnhp
title: Define concrete payload types for all 15 JobPayloadMap entries
status: todo
type: task
priority: normal
created_at: 2026-03-15T20:44:28Z
updated_at: 2026-03-21T10:22:26Z
parent: api-0zl4
---

All 15 entries in packages/types/src/jobs.ts JobPayloadMap are currently Record<string, unknown>. Replace with specific payload types as handlers are implemented.
