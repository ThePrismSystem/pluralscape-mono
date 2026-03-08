---
# db-0yyh
title: Full database schema audit
status: todo
type: task
priority: high
created_at: 2026-03-08T20:08:12Z
updated_at: 2026-03-08T20:08:12Z
parent: db-9nf0
---

Comprehensive audit of all db-\* bean schemas against ADRs, features.md, and cross-domain consistency.

## Scope

- Validate every db-\* table bean against its referenced ADR and features.md section
- Check column types, constraints, indexes, and foreign keys for correctness
- Verify encryption tier annotations match ADR 006/013 requirements
- Confirm PG/SQLite dialect handling is consistent across all table beans
- Check for missing tables, redundant columns, and naming inconsistencies
- Validate that all entity types from types-av6x have corresponding tables
- Cross-reference blocking/blocked_by chains for completeness
- Document findings in docs/audits/ as a numbered audit report

## Acceptance Criteria

- [ ] All 27 active db-\* table beans audited
- [ ] Each table validated against its ADR and features.md references
- [ ] Encryption tier annotations verified
- [ ] PG/SQLite dialect consistency checked
- [ ] Missing tables or columns identified
- [ ] Naming convention consistency verified
- [ ] Audit report written to docs/audits/
- [ ] Follow-up beans created for any issues found

## References

- All db-\* beans under db-2je4
- ADRs 004, 006, 009, 010, 013
- docs/audits/ (audit report destination)
