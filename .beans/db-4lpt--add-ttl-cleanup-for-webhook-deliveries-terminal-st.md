---
# db-4lpt
title: Add TTL cleanup for webhook_deliveries terminal states
status: todo
type: task
priority: normal
created_at: 2026-03-11T04:47:32Z
updated_at: 2026-03-11T04:47:32Z
parent: db-2je4
---

No purge mechanism for succeeded/failed deliveries. Table will grow unboundedly. Add cleanup job or retention policy. Ref: audit M25
