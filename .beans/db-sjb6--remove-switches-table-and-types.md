---
# db-sjb6
title: Remove switches table and types
status: completed
type: task
priority: normal
created_at: 2026-03-21T22:49:13Z
updated_at: 2026-03-21T23:05:02Z
parent: api-0zl4
---

## Tasks\n\n- [x] Remove switches from DB schema (PG + SQLite)\n- [x] Remove Switch/SwitchId/ArchivedSwitch from types\n- [x] Remove PKSwitchMapping (kept PKImportSwitch as external format)\n- [x] Remove switch.recorded webhook event\n- [x] Remove switch from enums, RLS, partition maintenance\n- [x] Remove CrdtSwitch from sync package\n- [x] Update all tests\n- [x] Regenerate DB migrations from scratch\n- [x] Scrap orphaned switches beans\n- [x] Typecheck and test

## Summary of Changes

Removed the switches table and all related types from the codebase:

- Deleted switches table from PG and SQLite schemas
- Removed SwitchId, Switch, ArchivedSwitch domain types
- Removed PKSwitchMapping from PK bridge types
- Removed switch.recorded webhook event type
- Removed switch from EntityType, ENTITY_TYPES, ID_PREFIXES, IdPrefixBrandMap
- Removed CrdtSwitch and FrontingDocument.switches from sync package
- Removed switch from RLS policies and partition maintenance
- Updated all test files across types, db, and sync packages
- Regenerated DB migrations from scratch (no switches table)
- Scrapped orphaned beans db-6lhh and db-19ae

Kept: PKImportSwitch, PKImportPayload.switches, ImportEntityType "switch" (external PK format), notification events switch-reminder/friend-switch-alert (conceptual), i18n Switch nomenclature term.
