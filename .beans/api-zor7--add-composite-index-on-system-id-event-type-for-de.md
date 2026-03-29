---
# api-zor7
title: Add composite index on (system_id, event_type) for deliveries
status: todo
type: task
priority: low
created_at: 2026-03-29T07:13:17Z
updated_at: 2026-03-29T07:13:17Z
parent: api-kjyg
---

webhook-delivery.service.ts:115 filters by eventType + systemId with no composite index. High-volume systems would scan all deliveries for that system.
