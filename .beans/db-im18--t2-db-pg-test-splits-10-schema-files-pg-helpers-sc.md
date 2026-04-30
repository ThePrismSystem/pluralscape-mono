---
# db-im18
title: "T2 db pg test splits: 10 schema files + pg-helpers + schema-type-parity"
status: completed
type: task
priority: normal
created_at: 2026-04-30T05:02:07Z
updated_at: 2026-04-30T17:57:18Z
parent: ps-36rg
blocked_by:
  - sync-96hx
  - db-5bu5
  - ps-ga25
---

Twelve files in packages/db (pg scope) ≥750 LOC. See spec PR 6.

## Files

- [x] helpers/pg-helpers.ts (963 -> 222 + ddl 289 + schema 333 + all-tables 198)
- [x] schema-pg-structure.integration.test.ts (1,668 -> 5 files: relationships 356, types-entities 471, links 432, member-links 245, associations 294)
- [x] schema-pg-communication.integration.test.ts (1,573 -> 5 files: channels-messages 461, board-notes 399, polls 300, poll-votes 289, acknowledgements 269)
- [x] schema-pg-custom-fields.integration.test.ts (1,250 -> 3 files: definitions-scopes 459, values-bucket-visibility 462, polymorphism 392)
- [x] schema-pg-fronting.integration.test.ts (1,163 -> 4 files: sessions-core 464, sessions-archived 219, custom-fronts 182, comments 406)
- [x] schema-pg-privacy.integration.test.ts (1,162 -> 3 files: buckets-tags-grants 466, friend-connections 288, friend-codes-assignments 456)
- [x] schema-pg-auth.integration.test.ts (1,016 -> 3 files: accounts-keys 277, sessions-recovery 349, device-transfer 410)
- [x] schema-pg-import-export.integration.test.ts (1,014 -> 3 files: import-jobs 381, import-checkpoint-refs 261, export-purge 434)
- [x] schema-pg-notifications.integration.test.ts (809 -> 2 files: tokens-configs 458, friend-preferences 375)
- [x] schema-pg-timers.integration.test.ts (761 -> 2 files: configs 302, records 498)
- [x] schema-pg-views.integration.test.ts (752 -> 2 files: fronting-acks 317, membership-structure 421)
- [x] schema-type-parity.test.ts (909 -> 3 files: columns 241, types 189, structural 63)

## Acceptance

- pnpm vitest run --project db-integration passes
- Coverage unchanged or higher

## Out of scope

- Schema or migration changes
- sqlite-side files

## Summary of Changes

Split 12 oversized PG schema integration test files (and one helpers barrel) into 39 focused test files plus 13 fixture helpers. All files are now <=500 LOC (largest: timers-records at 498). Every test was preserved; final db-integration suite is 122 files / 1592 tests (all green).

### Helpers extracted (13 fixture modules)

- helpers/pg-helpers.ts -> 222 LOC slim re-export barrel
- helpers/pg-helpers-ddl.ts -> 289 LOC PG_DDL bulk object
- helpers/pg-helpers-schema.ts -> 333 LOC per-domain createPg\*Tables
- helpers/pg-helpers-all-tables.ts -> 198 LOC catch-all + RLS helper
- helpers/structure-fixtures.ts -> setupStructureFixture, branded-id factories, base inserts
- helpers/communication-fixtures.ts -> communicationSchema fixture set
- helpers/custom-fields-fixtures.ts -> customFieldsSchema + bucket/field-def inserters
- helpers/fronting-fixtures.ts -> frontingSchema, custom-front and session inserters
- helpers/privacy-fixtures.ts -> privacySchema + friend-connection inserter
- helpers/auth-fixtures.ts -> authSchema, account/session inserters, time/code constants
- helpers/import-export-fixtures.ts -> importExportSchema fixture set
- helpers/notifications-fixtures.ts -> notificationsSchema (tokens, configs, friend prefs)
- helpers/timers-fixtures.ts -> timersSchema (timer configs, check-in records)
- helpers/views-fixtures.ts -> setupViewsFixture, clearViewsTables, seedViewsBaseEntities
- helpers/schema-parity-fixtures.ts -> TABLE_PAIRS, column/index/FK divergence tables, structural pairs

### Verification

- pnpm vitest run --project db-integration: 122 files, 1592 tests, all passing
- pnpm typecheck: clean
- pnpm lint: clean (zero warnings)
- pnpm format: clean

### Out of scope

- sqlite-side files (separate bean)
- schema or migration changes (none)
- Pre-existing PG files outside the 12 in the spec (schema-pg-search, schema-pg-webhooks, schema-pg-sync, schema-pg-members, schema-pg-blob-metadata, schema-pg-journal -- these will be addressed in their own beans if needed)
