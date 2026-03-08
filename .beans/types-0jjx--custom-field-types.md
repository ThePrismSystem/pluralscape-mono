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

FieldDefinition, FieldType, FieldValue discriminated union, per-bucket visibility

Custom field definition and value types.

## Scope

- `FieldDefinition`: id (FieldDefinitionId), systemId, name, fieldType (FieldType), options (for select/multi-select fields)
- `FieldType`: 'text' | 'number' | 'date' | 'boolean' | 'color' | 'select' | 'multi-select' | 'url'
- `FieldValue`: id (FieldValueId), fieldDefinitionId, memberId, value (typed union based on fieldType)
- `FieldBucketVisibility`: fieldDefinitionId, bucketId — per-bucket visibility, applied globally (not per-member)
- No limit on number of custom fields per system
- `FieldValueUnion`: discriminated union matching FieldType to value type

## Acceptance Criteria

- [ ] FieldDefinition supports 8 field types
- [ ] FieldValue correctly unions value type based on FieldType
- [ ] Select/multi-select fields carry options array
- [ ] Per-bucket visibility (not per-member)
- [ ] No arbitrary field count limit
- [ ] Unit tests for field value type narrowing

## References

- features.md section 1 (Custom fields)
