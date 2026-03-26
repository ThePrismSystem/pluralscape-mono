---
# api-9e56
title: Custom field bucket visibility
status: todo
type: feature
created_at: 2026-03-26T16:03:31Z
updated_at: 2026-03-26T16:03:31Z
parent: api-e3hk
blocked_by:
  - api-stvy
---

Implement setFieldBucketVisibility, removeFieldBucketVisibility, listFieldBucketVisibility. Uses existing fieldBucketVisibility table in packages/db/src/schema/pg/custom-fields.ts. Files: apps/api/src/services/field-bucket-visibility.service.ts (new); routes under routes/fields/bucket-visibility/. Tests: unit + integration; set/remove/list, cascade behavior.
