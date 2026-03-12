---
# db-ahn1
title: Add partitioning and retention for audit_log
status: completed
type: task
priority: high
created_at: 2026-03-11T04:47:31Z
updated_at: 2026-03-12T11:24:25Z
parent: db-2nr7
---

Unbounded time-series table, ~1B+ rows/year at scale. No TTL, no archival, no partitioning. detail text column adds unpredictable heap size. Needs range partitioning on timestamp and defined retention window (e.g. 90 days hot, archive cold). Ref: audit H11

## Summary of Changes

- Changed audit_log schema from single-column PK to composite PK (id, timestamp)
- Created hand-edited migration with PARTITION BY RANGE on timestamp
- Added 6 monthly partitions (2026-01 through 2026-06) + default partition
- Updated PGlite test DDL with composite PK
- Added integration test for composite PK behavior (same id, different timestamps)
- Created ADR 017 documenting the partitioning decision
