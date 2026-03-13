---
# db-sgzm
title: Rename pk_bridge_state table to pk_bridge_configs for naming consistency
status: completed
type: task
priority: normal
created_at: 2026-03-13T05:00:20Z
updated_at: 2026-03-13T06:25:22Z
parent: db-hcgk
---

## Summary of Changes\n\nRenamed table `pk_bridge_state` → `pk_bridge_configs` (PG + SQLite), updated all index/constraint names, row types (`PkBridgeStateRow` → `PkBridgeConfigRow`), barrel exports, RLS policies, and test DDL/references.
