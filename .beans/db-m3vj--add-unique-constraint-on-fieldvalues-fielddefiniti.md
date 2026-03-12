---
# db-m3vj
title: Add unique constraint on fieldValues (fieldDefinitionId, systemId)
status: completed
type: task
priority: normal
created_at: 2026-03-11T04:47:31Z
updated_at: 2026-03-12T00:49:57Z
parent: db-gt84
---

Nothing prevents duplicate fieldValues rows for same (fieldDefinitionId, systemId) pair. Ref: audit M6

## Summary of Changes

Added two partial unique indexes to fieldValues: `field_values_definition_member_uniq` (WHERE member_id IS NOT NULL) and `field_values_definition_system_uniq` (WHERE member_id IS NULL). Prevents duplicate field values per member and per system.
