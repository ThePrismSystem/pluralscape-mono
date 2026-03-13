# ADR 019: Fronting Sessions Table Partitioning

## Status

Accepted

## Context

Fronting sessions are the highest-volume user-generated data in Pluralscape.
At 500K users with an average of 3 switches per day, the `fronting_sessions`
table projects to ~1.5M rows/day and ~547M rows/year. At this scale, vacuum
operations, index bloat, and time-range queries become problematic without
partitioning.

Unlike `messages` (ADR 016) and `audit_log` (ADR 017), fronting sessions are
**mutable**: `end_time` is NULL when a session starts and gets updated when the
session ends. However, `start_time` is immutable and monotonically increasing,
making it a valid partition key. Updates to `end_time` always target the same
partition as the original insert (since `start_time` determines partition
placement and never changes).

### Key constraints

1. PostgreSQL requires the partition key to be part of the primary key.
2. All UNIQUE constraints must include the partition key columns.
3. Foreign keys referencing a partitioned table must include the partition key.
4. `fronting_comments` has a composite FK on `(fronting_session_id, system_id)`.
5. SQLite does not support partitioning — no changes to the SQLite schema.

## Decision

### PostgreSQL

1. **Monthly range partitioning** on the `start_time` column using
   `PARTITION BY RANGE ("start_time")`.

2. **Composite primary key** `(id, start_time)` — PostgreSQL requires the
   partition key to be part of the primary key. This is a logical-only change
   in the Drizzle schema; the physical `PARTITION BY` clause is applied in a
   hand-edited migration since Drizzle does not support partitioning syntax.

3. **Unique constraint updated** from `(id, system_id)` to
   `(id, system_id, start_time)` to satisfy PostgreSQL's requirement that
   unique constraints on partitioned tables include all partition key columns.

4. **Foreign key from `fronting_comments`** updated to reference
   `(fronting_session_id, system_id, start_time)` — this requires adding a
   `start_time` column to `fronting_comments` that mirrors the parent session's
   start time. This is denormalization, but it is necessary for FK enforcement
   on a partitioned table and is immutable after creation (set once when the
   comment is created, never updated).

5. **`journal_entries.fronting_session_id` FK**: Journal entries reference
   fronting sessions by ID only. Since the partition key (`start_time`) is not
   present in `journal_entries`, this FK cannot be enforced at the database
   level on a partitioned table. It is enforced at the application layer
   instead. This matches the precedent set by `messages.reply_to_id` in
   ADR 016.

6. **Initial partitions**: `fronting_sessions_2026_01` through
   `fronting_sessions_2026_06` plus a `fronting_sessions_default` catch-all
   partition. New monthly partitions are created by a scheduled job before the
   month begins (same operational pattern as messages and audit_log).

7. **Existing indexes** are inherited by partitions automatically. The
   `fronting_sessions_active_idx` partial index (WHERE `end_time IS NULL`) is
   particularly valuable on the current partition where active sessions live.

### SQLite

No changes. SQLite does not support partitioning, and the self-hosted
single-user deployment does not face the same scaling concern. The SQLite
schema retains its original `(id)` primary key.

### Drizzle ORM

The Drizzle schema reflects the logical structure (composite PK, updated unique
constraints). The `PARTITION BY` clause exists only in the hand-edited migration
SQL and is invisible to Drizzle at runtime.

### Mutability analysis

Fronting sessions are mutable — `end_time` is updated when a session closes.
However, `start_time` (the partition key) is immutable. PostgreSQL handles
updates to non-partition-key columns within a partition without cross-partition
moves, so this is safe. The `end_time` update always targets the same partition
because the row's partition placement is determined solely by `start_time`.

## Consequences

- Queries on `fronting_sessions` that do not filter by `start_time` will scan
  all partitions. The existing `fronting_sessions_system_start_idx` index
  already encourages filtering by time range.
- The `fronting_sessions_active_idx` partial index (WHERE `end_time IS NULL`)
  naturally concentrates on the most recent partition, making active-session
  lookups fast.
- Adding `start_time` to `fronting_comments` is denormalization. The value is
  immutable and set from the parent session at creation time, so consistency
  risk is minimal.
- The `journal_entries` FK to `fronting_sessions` becomes application-enforced
  only. Invalid references are possible if the application does not validate;
  this is acceptable because the journal-fronting link is a non-critical
  contextual feature.
- PGlite (used in integration tests) does not support `PARTITION BY`. Test DDL
  uses a regular table with the same column definitions and constraints, which
  validates the logical schema without testing physical partitioning.
- This completes the partitioning strategy for all three high-volume tables:
  `messages` (ADR 016), `audit_log` (ADR 017), and `fronting_sessions`.
