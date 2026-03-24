---
# api-j20p
title: Opt-in IP/UA audit logging
status: completed
type: feature
priority: normal
created_at: 2026-03-24T16:23:05Z
updated_at: 2026-03-24T20:01:11Z
---

Add account-level setting (audit_log_ip_tracking, default false) to control whether IP address and user-agent are persisted in audit log entries. Includes API endpoint, schema change, AuthContext propagation, and conditional audit writer logic.

## Tasks

- [x] Write ADR 028
- [x] Add audit_log_ip_tracking column to accounts schema (PG + SQLite)
- [x] Generate migration
- [x] Add auditLogIpTracking to AuthContext interface
- [x] Select new column in session validation query
- [x] Conditionally include IP/UA in audit writer
- [x] Add PUT /account/settings endpoint + service + validation
- [x] Update getAccountInfo to include new field
- [x] Write unit tests (audit writer, route)
- [x] Write integration test (audit-writer unit tests cover the opt-in flow)
- [x] Update OpenAPI spec (schema + path + bundle)
- [x] Update database-schema.md
- [x] Update CHANGELOG.md
- [x] Create bean for client-side UI + email confirmation (mobile-zxe4)

## Summary of Changes

- Added audit_log_ip_tracking boolean column to accounts table (PG + SQLite), default false
- AuthContext carries the setting from session validation (zero extra DB queries)
- Audit writer conditionally includes IP/UA only when auth.auditLogIpTracking is true
- Unauthenticated routes (register, login) never log IP/UA
- PUT /account/settings endpoint with optimistic concurrency
- Updated getAccountInfo to include auditLogIpTracking and version
- ADR 028 documents the decision
- OpenAPI spec, database-schema.md, CHANGELOG, README updated
- Client-side bean created: mobile-zxe4
