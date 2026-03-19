---
# db-vvq9
title: Enhanced schema parity testing (Phase A)
status: completed
type: task
priority: normal
created_at: 2026-03-19T04:52:14Z
updated_at: 2026-03-19T05:18:22Z
parent: api-765x
---

Extend schema-type-parity.test.ts to verify index name parity, FK count parity, and CHECK constraint SQL parity

## Summary of Changes\n\n- Added index name parity tests (section 7) comparing PG and SQLite index names with known exception list\n- Added FK count parity tests (section 8) with known divergence registry\n- Added CHECK constraint count parity tests (section 9)\n- Documented 3 known PG-only indexes, 1 SQLite-only index, and 1 FK count divergence
