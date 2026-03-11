---
# db-ahn1
title: Add partitioning and retention for audit_log
status: todo
type: task
priority: high
created_at: 2026-03-11T04:47:31Z
updated_at: 2026-03-11T19:40:19Z
parent: db-2nr7
---

Unbounded time-series table, ~1B+ rows/year at scale. No TTL, no archival, no partitioning. detail text column adds unpredictable heap size. Needs range partitioning on timestamp and defined retention window (e.g. 90 days hot, archive cold). Ref: audit H11
