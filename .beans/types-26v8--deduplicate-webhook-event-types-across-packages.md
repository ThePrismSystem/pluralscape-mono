---
# types-26v8
title: Deduplicate webhook event types across packages
status: completed
type: task
priority: normal
created_at: 2026-03-24T09:25:31Z
updated_at: 2026-04-14T14:53:23Z
parent: ps-4ioj
---

WEBHOOK_EVENT_TYPE_VALUES defined in validation/constants without type-safety check against types package. Import from types or add satisfies check.

## Summary of Changes\n\nAdded satisfies check linking WEBHOOK_EVENT_TYPE_VALUES to WebhookEventType union in validation.constants.ts.
