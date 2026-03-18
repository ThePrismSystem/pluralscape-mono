---
# api-cm2p
title: Design lifecycle event type-specific validation
status: completed
type: task
priority: low
created_at: 2026-03-18T12:50:12Z
updated_at: 2026-03-18T14:46:27Z
---

B-1 from audit 012: Lifecycle event creation currently accepts any event type without validating that the event data matches the type schema. Needs a design decision on whether to enforce type-specific validation at the API layer, DB layer, or both. Deferred from M2 remediation.
