---
# api-kf21
title: Extract rotation state constants
status: completed
type: task
priority: low
created_at: 2026-03-18T07:12:34Z
updated_at: 2026-03-18T07:42:50Z
parent: api-i2pw
---

Rotation state names (initiated, migrating, sealing, failed, completed) are string literals in key-rotation.service.ts. Extract to constants file. Ref: audit P-18.

## Summary of Changes\n\nAdded ROTATION_STATES and ROTATION_ITEM_STATUSES constants to packages/types/src/api-constants.ts, exported from index.ts. Replaced ~17 rotation state and item status string literals in key-rotation.service.ts. SQL template literals kept as-is (raw SQL). Test file left with string values (37 occurrences) since they match the constant values.
