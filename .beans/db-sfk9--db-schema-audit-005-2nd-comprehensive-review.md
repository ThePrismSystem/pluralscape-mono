---
# db-sfk9
title: "DB schema audit 005: 2nd comprehensive review"
status: completed
type: task
priority: normal
created_at: 2026-03-13T04:07:16Z
updated_at: 2026-04-16T07:29:38Z
parent: db-hcgk
---

Second comprehensive audit covering simplicity, security, performance, best practices, types/features divergence, scaling at 500k users, encryption adherence, and PG/SQLite parity.

## Audit Findings Summary

Report saved to `docs/local-audits/005-db-schema-audit-2nd-comprehensive.md`

### Critical (3)

- C1: `frontingReports` plaintext JSONB contradicts encryption design (no `encryptedData` column)
- C2: `messages`/`audit_log` composite PK divergence between PG and SQLite
- C3: `subscription`/`event` EntityTypes have no DB tables

### High (7)

- H1: `sessions.deviceInfo` plaintext (pending migration acknowledged)
- H2: `frontingSessions` ~2.5B rows with no partitioning plan
- H3: SQLite `jobs` PK type mismatch (integer vs branded string)
- H4: `syncQueue` missing cleanup index for global sweep
- H5: `audit_log` row-level cleanup insufficient at scale
- H6: `innerworld_canvas` missing from EntityType
- H7: `friend_bucket_assignments` no type export

### Medium (12) / Low (10)

See full report for details.

## Positive Findings

- Enum parity between DB and types: 100% match across all arrays
- RLS coverage: complete for all tables
- Composite FK pattern for cross-system isolation: well-applied
- Archivable/version CHECK constraints: consistent
- Partial indexes for active records: excellent
