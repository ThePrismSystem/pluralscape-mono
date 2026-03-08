---
# db-tu5g
title: Custom fields tables
status: todo
type: task
priority: normal
created_at: 2026-03-08T13:32:53Z
updated_at: 2026-03-08T14:21:08Z
parent: db-2je4
blocked_by:
  - db-9f6f
  - db-i2gl
---

Custom field definition, value, and bucket visibility tables

## Scope

- `field_definitions`: id, system_id, encrypted_data (T1 — name, type, options for select fields)
- `field_values`: id, field_definition_id (FK), member_id (FK), encrypted_data (T1 — value)
- `field_bucket_visibility`: field_definition_id (FK), bucket_id (FK) — which buckets can see this field
- PostgreSQL: options stored as JSONB inside encrypted blob after decryption; SQLite: TEXT with JSON

## Acceptance Criteria

- [ ] field_definitions table
- [ ] field_values table with FK to definition and member
- [ ] field_bucket_visibility join table
- [ ] Migrations for both dialects
- [ ] Integration test: create definition + values + visibility

## References

- features.md section 1 (Custom fields)

## Audit Findings (002)

- Missing `created_at`, `updated_at` on field_definitions
- Missing `created_at`, `updated_at` on field_values
- Missing indexes on field_values (field_definition_id, member_id)
- Missing unique constraint on field_bucket_visibility (field_definition_id, bucket_id)
