---
# types-26v8
title: Deduplicate webhook event types across packages
status: todo
type: task
priority: normal
created_at: 2026-03-24T09:25:31Z
updated_at: 2026-03-24T09:25:31Z
parent: ps-4ioj
---

WEBHOOK_EVENT_TYPE_VALUES defined in validation/constants without type-safety check against types package. Import from types or add satisfies check.
