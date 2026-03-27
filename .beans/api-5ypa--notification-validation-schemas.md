---
# api-5ypa
title: Notification validation schemas
status: completed
type: feature
priority: normal
created_at: 2026-03-26T16:04:32Z
updated_at: 2026-03-27T07:17:32Z
parent: api-nie2
---

Create Zod schemas: RegisterDeviceTokenBodySchema (token: non-empty string max 4096 chars, platform: enum "ios" | "android" | "web"), UpdateNotificationConfigBodySchema (event type toggles: object with boolean enabled/pushEnabled per event type key), UpdateFriendNotificationPreferenceBodySchema (friendConnectionId: required UUID, event type toggles same shape as global config). Files: packages/validation/src/notification.ts (new), re-export from index.ts. Tests: unit tests for each schema covering valid input, boundary cases (empty token, token at exactly 4096 chars, oversized token at 4097 chars, unknown platform value, invalid event type key, missing friendConnectionId), and invalid input (missing required fields, non-UUID connectionId, non-boolean toggle values).

## Summary of Changes

Created notification.ts with three Zod schemas: RegisterDeviceTokenBodySchema (platform enum + token with max 512 chars), UpdateNotificationConfigBodySchema (partial enabled/pushEnabled with at-least-one refine), UpdateFriendNotificationPreferenceBodySchema (enabledEventTypes array of friend event types). Added constants to validation.constants.ts and re-exported from index.ts.
