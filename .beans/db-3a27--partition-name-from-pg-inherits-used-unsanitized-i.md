---
# db-3a27
title: partition_name from pg_inherits used unsanitized in sql.raw()
status: completed
type: bug
priority: critical
created_at: 2026-04-20T09:21:02Z
updated_at: 2026-04-20T21:25:48Z
parent: db-bry7
---

Finding [C2] from audit 2026-04-20. packages/db/src/queries/partition-maintenance.ts:120-122. Raw partition_name from pg_inherits passed directly to DETACH PARTITION/DROP TABLE. Fix: reconstruct name from parsed year/month via formatPartitionName(options.table, parsed.year, parsed.month).

## Summary of Changes

packages/db/src/queries/partition-maintenance.ts now reconstructs partition names via parsePartitionDate + formatPartitionName instead of feeding pg_inherits output directly to sql.raw. Closes a SQL-injection vector that could be triggered via a compromised catalog or malformed partition name. Added integration test queries-pg-partition-maintenance.integration.test.ts that verifies DETACH + DROP succeed on the reconstructed identifier and that invalid patterns are rejected.
