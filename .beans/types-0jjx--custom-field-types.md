---
# types-0jjx
title: Custom field types
status: todo
type: task
priority: normal
created_at: 2026-03-08T13:32:29Z
updated_at: 2026-03-08T13:36:10Z
parent: types-im7i
blocked_by:
  - types-av6x
  - types-fid9
---

Custom field definition and value types.

## Scope

- `FieldDefinition`: id (FieldDefinitionId), systemId, name, fieldType (FieldType), options (for select/multi-select), sortOrder (number), description (string | null — help text), required (boolean, default false), createdAt, updatedAt
- `FieldType`: 'text' | 'number' | 'date' | 'boolean' | 'color' | 'select' | 'multi-select' | 'url'
- `FieldValue`: id (FieldValueId), fieldDefinitionId, memberId, value (typed union based on fieldType), createdAt, updatedAt
- `FieldBucketVisibility`: fieldDefinitionId, bucketId — per-bucket visibility, applied globally (not per-member)
- `FieldValueUnion`: discriminated union matching FieldType to value type
- No limit on number of custom fields per system

## Acceptance Criteria

- [ ] FieldDefinition with sortOrder, description/helpText, required flag
- [ ] FieldDefinition with timestamps
- [ ] FieldValue with timestamps
- [ ] FieldValue correctly unions value type based on FieldType
- [ ] Select/multi-select fields carry options array
- [ ] Per-bucket visibility (not per-member)
- [ ] Unit tests for field value type narrowing

## References

- features.md section 1 (Custom fields)
