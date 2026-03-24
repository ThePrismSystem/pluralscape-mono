---
# db-ab1h
title: Add partial index for check-in-generate query pattern
status: todo
type: task
priority: normal
created_at: 2026-03-24T09:25:31Z
updated_at: 2026-03-24T09:25:31Z
parent: ps-4ioj
---

Missing index on (enabled, archived) for the global check-in-generate batch query. Add partial index: timer_configs_enabled_active_idx.
