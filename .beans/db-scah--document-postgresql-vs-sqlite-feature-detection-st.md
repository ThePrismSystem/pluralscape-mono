---
# db-scah
title: Document PostgreSQL vs SQLite feature detection strategy
status: completed
type: task
priority: normal
created_at: 2026-03-09T12:13:41Z
updated_at: 2026-03-10T10:10:11Z
parent: db-2je4
---

Define which PostgreSQL features degrade or are absent on SQLite (RLS, JSONB operators, pgcrypto) and document the feature-detection strategy so API code doesn't become littered with dialect checks. Create a shared helper or capability object that each database adapter exposes.

Source: Architecture Audit 004, Metric 4

## Summary of Changes

Expanded `packages/db/docs/dialect-capabilities.md` with:

- Updated capability matrix including FTS5, job queue, and views
- When-to-use-which guide for detection helpers
- RLS scope type reference table
- Custom column type mapping details
- Full views/query helpers catalog with filter logic
- SQLite-only features documentation (FTS5, job queue)

Created `packages/db/docs/dialect-api-guide.md` with:

- Decision tree for choosing the right approach
- 5 patterns: service injection, JSON queries, timestamps, enums, binary data
- Anti-patterns to avoid (scattered dialect checks, raw SQL, misusing capabilities)
- Steps for adding new dialect-specific features
