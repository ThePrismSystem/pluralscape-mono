---
# db-lafv
title: Fix T3 metadata columns PR review issues
status: completed
type: task
priority: normal
created_at: 2026-03-11T10:05:42Z
updated_at: 2026-04-16T07:29:38Z
parent: ps-vtws
---

Address PR review feedback: enumCheck NULL handling, $type<>() annotations, missing enum exports, extract insertPoll helper, null-default test, CHECK matchers

## Summary of Changes

- Fixed `enumCheck()` NULL handling: `IS NULL OR col IN (...)` for nullable T3 columns
- Added `$type<>()` annotations to 3 JSONB columns (linkedStructure, architectureType, voter) across PG and SQLite schemas
- Fixed test values to match typed JSONB column shapes (EntityReference, ArchitectureType)
- Exported DISCOVERY_STATUSES, FIELD_TYPES, LIFECYCLE_EVENT_TYPES from helpers/index.ts and index.ts
- Extracted pgInsertPoll/sqliteInsertPoll helpers into shared test helpers
- Added null-default test for acknowledgements.createdByMemberId
- Added CHECK constraint regex matchers to 6 new T3 PG tests
