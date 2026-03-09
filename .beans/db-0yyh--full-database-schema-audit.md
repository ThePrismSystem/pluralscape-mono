---
# db-0yyh
title: Full database schema audit
status: completed
type: task
priority: high
created_at: 2026-03-08T20:08:12Z
updated_at: 2026-03-09T23:03:32Z
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

- [x] All 27 active db-\* table beans audited
- [x] Each table validated against its ADR and features.md references
- [x] Encryption tier annotations verified
- [x] PG/SQLite dialect consistency checked
- [x] Missing tables or columns identified
- [x] Naming convention consistency verified
- [x] Audit report written to docs/audits/
- [x] Follow-up beans created for any issues found (issues resolved inline via bean updates)

## References

- All db-\* beans under db-2je4
- ADRs 004, 006, 009, 010, 013
- docs/audits/ (audit report destination)

## Summary of Changes

Comprehensive audit of all db-\* bean schemas against the canonical types package (packages/types/src/). Produced audit report at docs/audits/003-database-schema-audit.md documenting 7 critical, 21 major, and 6 minor findings. All 18 affected beans updated with corrections: renamed fields (completeness_level→saturation_level, metadata→detail, api_key_id→crypto_key_id), added missing tables (fronting_comments, device_transfer_requests, 3 cross-link tables, friend_notification_preferences), expanded enum values, added system_id for tenant isolation where missing, and aligned encrypted_data field lists with canonical types. Updated 3 dependent beans (views, RLS policies, search index). No beans scrapped. 7 intentional divergences documented.
