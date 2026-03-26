---
# api-pdwk
title: Switch alert delivery integration
status: todo
type: feature
created_at: 2026-03-26T16:04:49Z
updated_at: 2026-03-26T16:04:49Z
parent: api-nie2
blocked_by:
  - api-1qcz
---

Fronting service emits notification-send job only. Worker handles ALL friend querying and fan-out asynchronously. Worker checks: connection accepted + not archived + allowFrontingNotifications + system notification config enabled + active device tokens + member/front visible in friend's buckets. Files: apps/api/src/services/switch-alert.service.ts (new), modify fronting-session.service.ts. Tests: unit (mock friend queries, verify enqueue) + integration (full flow with all gating conditions).
