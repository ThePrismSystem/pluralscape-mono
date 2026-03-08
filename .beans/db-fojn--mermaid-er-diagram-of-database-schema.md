---
# db-fojn
title: Mermaid ER diagram of database schema
status: todo
type: task
priority: normal
created_at: 2026-03-08T20:08:18Z
updated_at: 2026-03-08T20:08:22Z
parent: db-9nf0
blocked_by:
  - db-0yyh
---

Generate a comprehensive Mermaid ER diagram documenting all database tables, relationships, and key constraints.

## Scope

- Mermaid erDiagram covering all tables from db-\* beans
- Entity grouping by domain: core, auth, fronting, communication, privacy, structure, sync, media, jobs
- Relationship cardinality (one-to-one, one-to-many, many-to-many via junction tables)
- Primary keys, foreign keys, and notable indexes annotated
- Encryption tier markers (T1/T2/T3) on columns where applicable
- Separate diagrams if full schema is too large for a single readable chart
- Output as docs/database-schema.md with embedded Mermaid blocks
- Keep in sync with db-\* beans (document regeneration process)

## Acceptance Criteria

- [ ] All tables from active db-\* beans represented
- [ ] Relationships and cardinality shown
- [ ] Foreign key references accurate
- [ ] Encryption tiers annotated
- [ ] Renders correctly in GitHub markdown preview
- [ ] Domain grouping for readability
- [ ] Regeneration process documented

## References

- All db-\* beans under db-2je4
- ADR 004 (Database)
- ADR 006 (Encryption — tier annotations)
