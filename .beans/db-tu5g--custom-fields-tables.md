---
# db-tu5g
title: Custom fields tables
status: todo
type: task
priority: normal
created_at: 2026-03-08T13:32:53Z
updated_at: 2026-03-08T19:32:26Z
parent: db-2je4
blocked_by:
  - db-9f6f
  - db-i2gl
---

Custom field definition, value, and bucket visibility tables.

## Scope

### Tables

- **`field_definitions`**: id (UUID PK), system_id (FK → systems, NOT NULL), version (integer, T3, NOT NULL, default 1), archived (boolean, T3, NOT NULL, default false), archived_at (T3, nullable), created_at (T3, NOT NULL, default NOW()), updated_at (T3), encrypted_data (T1, NOT NULL — name, type, options for select fields)
- **`field_values`**: id (UUID PK), field_definition_id (FK → field_definitions, NOT NULL), member_id (FK → members, NOT NULL), system_id (FK → systems, NOT NULL — for RLS), version (integer, T3, NOT NULL, default 1), created_at (T3, NOT NULL, default NOW()), updated_at (T3), encrypted_data (T1, NOT NULL — value)
- **`field_bucket_visibility`**: field_definition_id (FK → field_definitions, NOT NULL), bucket_id (FK → buckets, NOT NULL) — composite PK: (field_definition_id, bucket_id)
- PostgreSQL: options stored as JSONB inside encrypted blob after decryption; SQLite: TEXT with JSON

### Indexes

- field_definitions (system_id)
- field_values (field_definition_id)
- field_values (member_id)
- field_values (system_id) — for RLS

### Cascade rules

- System deletion → CASCADE: field_definitions, field_values, field_bucket_visibility
- Field definition deletion → CASCADE: field_values, field_bucket_visibility

## Acceptance Criteria

- [ ] field_definitions with version, archived/archived_at
- [ ] field_values with system_id for RLS and version
- [ ] CASCADE on system and field_definition deletion
- [ ] field_definitions table with created_at/updated_at
- [ ] field_values table with timestamps and FK indexes
- [ ] field_bucket_visibility with composite PK (field_definition_id, bucket_id)
- [ ] Indexes on field_values (field_definition_id, member_id)
- [ ] Migrations for both dialects
- [ ] Integration test: create definition + values + visibility

## References

- features.md section 1 (Custom fields)
