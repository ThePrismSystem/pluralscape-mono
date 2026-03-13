---
# api-1clw
title: Throttle sessions.lastActive updates to reduce write amplification
status: todo
type: task
priority: normal
created_at: 2026-03-13T19:09:33Z
updated_at: 2026-03-13T19:09:33Z
---

sessions.lastActive is written on every authenticated request. At scale this creates significant write amplification. Throttle updates to only write when lastActive is more than 60 seconds stale.
