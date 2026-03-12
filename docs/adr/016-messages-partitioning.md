# ADR 016: Messages Table Partitioning

## Status

Accepted

## Context

CR9 scaling analysis projects the `messages` table reaching 9.1 billion rows under
sustained usage. At that scale, PostgreSQL vacuum operations, table bloat, and
sequential scans become unmanageable without partitioning.

Messages are naturally time-series data: they are written with a monotonically
increasing timestamp, and queries almost always filter by time range (e.g.,
loading recent channel history). This makes range partitioning by timestamp an
obvious fit.

## Decision

### PostgreSQL

1. **Monthly range partitioning** on the `timestamp` column using
   `PARTITION BY RANGE ("timestamp")`.

2. **Composite primary key** `(id, timestamp)` — PostgreSQL requires the
   partition key to be part of the primary key. This is a logical-only change
   in the Drizzle schema; the physical `PARTITION BY` clause is applied in a
   hand-edited migration since Drizzle does not support partitioning syntax.

3. **Drop the `reply_to_id` self-referencing foreign key.** PostgreSQL cannot
   enforce a foreign key that references the same partitioned table (the FK
   target must be a non-partitioned table or a unique index that includes the
   partition key). `reply_to_id` is enforced at the application level instead.

4. **Unique constraint updated** from `(id, system_id)` to
   `(id, system_id, timestamp)` to satisfy PostgreSQL's requirement that unique
   constraints on partitioned tables include all partition key columns.

5. **Initial partitions**: `messages_2026_01` through `messages_2026_06` plus a
   `messages_default` catch-all partition. New monthly partitions should be
   created by a scheduled job before the month begins.

### SQLite

No changes. SQLite does not support partitioning, and the self-hosted
single-user deployment does not face the same scaling concern. The SQLite schema
retains its original `(id)` primary key and `reply_to_id` self-FK.

### Drizzle ORM

The Drizzle schema reflects the logical structure (composite PK, no self-FK).
The `PARTITION BY` clause exists only in the hand-edited migration SQL and is
invisible to Drizzle at runtime. The Drizzle snapshot JSON is not modified.

## Consequences

- Queries on `messages` that do not filter by `timestamp` will scan all
  partitions (partition pruning requires a `timestamp` predicate). The existing
  `messages_channel_id_timestamp_idx` index already encourages this pattern.
- The `reply_to_id` column is retained for application use but has no database
  constraint. Invalid references are possible if the application does not
  validate; this is acceptable because reply threading is a non-critical
  display feature.
- This pattern (range partitioning + composite PK + dropped self-FK) can be
  reused for `audit_log` when it reaches similar scale (see db-ahn1).
- PGlite (used in integration tests) does not support `PARTITION BY`. Test DDL
  uses a regular table with the same column definitions and constraints, which
  validates the logical schema without testing physical partitioning.
