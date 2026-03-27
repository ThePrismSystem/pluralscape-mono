---
# api-pdwk
title: Switch alert delivery integration
status: completed
type: feature
priority: normal
created_at: 2026-03-26T16:04:49Z
updated_at: 2026-03-27T07:46:20Z
parent: api-nie2
blocked_by:
  - api-1qcz
---

Fronting service emits notification-send job only. Worker handles ALL friend querying and fan-out asynchronously. Worker checks: connection accepted + not archived + allowFrontingNotifications + system notification config enabled + active device tokens + member/front visible in friend's buckets. Files: apps/api/src/services/switch-alert.service.ts (new), modify fronting-session.service.ts. Tests: unit (mock friend queries, verify enqueue) + integration (full flow with all gating conditions).

## Summary of Changes

Implemented switch-alert-dispatcher.ts with dispatchSwitchAlertForSession that checks all 5 eligibility conditions (connection accepted, preference enabled, config enabled, bucket visibility, active tokens) and enqueues one notification-send job per device token with idempotency keys. Fail-closed: per-friend errors logged and skipped. Integration tests cover all gating conditions.
