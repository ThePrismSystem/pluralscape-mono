# ADR 017: Audit Log Partitioning

## Status

Accepted

## Context

The `audit_log` table records security-relevant events (logins, exports, key
rotations, sharing changes). Over time this table grows monotonically and is
never updated — only appended. At scale, vacuum overhead and sequential scans
on a single large table become problematic, exactly as with the `messages` table
(see ADR 016).

Unlike messages, audit logs have a natural retention boundary: entries older than
90 days can be archived or dropped for most compliance regimes. Partitioning
enables efficient retention by dropping entire partitions rather than running
expensive `DELETE` queries.

## Decision

### PostgreSQL

1. **Monthly range partitioning** on the `timestamp` column using
   `PARTITION BY RANGE ("timestamp")`.

2. **Composite primary key** `(id, timestamp)` — PostgreSQL requires the
   partition key to be part of the primary key.

3. **Retained foreign keys** to `accounts` and `systems`. Unlike the `messages`
   table (which had a self-referencing FK), `audit_log` only references
   non-partitioned tables. PostgreSQL 12+ supports foreign keys FROM a
   partitioned table TO a non-partitioned table, so these FKs are preserved.

4. **Initial partitions**: `audit_log_2026_01` through `audit_log_2026_06` plus
   an `audit_log_default` catch-all partition.

5. **90-day hot retention**: old partitions can be dropped via `DROP TABLE
audit_log_YYYY_MM` to enforce retention. This is more efficient than row-
   level deletion and avoids vacuum overhead on dropped partitions.

6. **Partition management**: new monthly partitions should be created by a
   scheduled background job before each month begins (deferred to background
   job infrastructure — see ADR 010).

### SQLite

No changes. SQLite is single-user (self-hosted) and does not face the same
scaling concern. The SQLite audit log retains its original `(id)` primary key.

### Drizzle ORM

The Drizzle schema reflects the logical structure (composite PK, retained FKs).
The `PARTITION BY` clause exists only in the hand-edited migration SQL and is
invisible to Drizzle at runtime.

### PGlite (Tests)

PGlite does not support `PARTITION BY`. Test DDL uses a regular table with the
same column definitions and composite PK, validating the logical schema without
testing physical partitioning (same pattern as `messages` — see ADR 016).

## Consequences

- Queries on `audit_log` that do not filter by `timestamp` will scan all
  partitions. The existing `audit_log_timestamp_idx` and composite indexes
  on `(account_id, timestamp)` / `(system_id, timestamp)` encourage timestamp-
  filtered queries.
- Retention is now a `DROP TABLE` operation on old partitions, which is
  instantaneous compared to row-level deletion.
- Foreign keys to `accounts` and `systems` are preserved, maintaining
  referential integrity without the complications that forced `messages` to
  drop its self-FK.
- This is the second table to use this partitioning pattern (after `messages`),
  establishing it as a reusable approach for time-series append-only tables.
