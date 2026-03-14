---
# ps-dok1
title: Comprehensive documentation update
status: completed
type: task
priority: normal
created_at: 2026-03-14T05:03:35Z
updated_at: 2026-03-14T05:06:27Z
---

Update README, CHANGELOG, database-schema, and milestones docs to reflect current project state: 2889 tests, 22 ADRs, entity archival, launch features, coverage numbers, and consistency fixes.

## Summary of Changes

### README.md

- Test count: 2,338 → 2,889 (across 132 → 144 files)
- Coverage: statements 95.01→96.46%, branches 83.77→86.29%, functions 98.48→99.03%, lines 94.97→96.43%
- ADR count: 18 → 22
- Added 5 completed epics to status section (launch features, entity archival, RLS, SQLCipher, schema docs)

### CHANGELOG.md

- ADR count: 18 → 22, added ADRs 019-022 to list
- Added 8 new entries under Added (RLS, SQLCipher, launch features, entity archival, archival FK audit, future feature specs, blob/notification/webhook tests)
- Added Fixed section (flatted DoS, audit 005/008 findings, composite FK fixes)

### database-schema.md

- Removed `boolean archived` from 9 individual table diagrams (members, groups, channels, messages, notes, custom_fronts, field_definitions, journal_entries, wiki_pages) — now covered by convention note since archival is universal

### milestones.md

- ADR count: 20 → 22
- Added ADRs 019 (fronting sessions partitioning) and 020 (RLS denormalization) to list
- Marked 5 epics as completed: launch features L2-L10, entity archival, RLS bootstrapping, SQLCipher, schema docs
- Removed 'ER diagram pending' note
