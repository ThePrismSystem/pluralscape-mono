# ADR 020: Denormalize system_id onto Join-Based RLS Tables

## Status

Accepted

## Context

Row Level Security (RLS) policies restrict access to rows by comparing `system_id` on each row against the current session GUC (`app.current_system_id`). This is O(1) per row when the table has a direct `system_id` column.

Six tables were initially designed as join tables without a direct `system_id` column:

- `bucket_content_tags` — tagged via `bucket_id → buckets.system_id`
- `key_grants` — owned via `bucket_id → buckets.system_id`
- `friend_bucket_assignments` — owned via `friend_connection_id → friend_connections.system_id`
- `field_bucket_visibility` — owned via `bucket_id → buckets.system_id`
- `bucket_key_rotations` — owned via `bucket_id → buckets.system_id`
- `bucket_rotation_items` — owned via `rotation_id → bucket_key_rotations → buckets.system_id`

Without a direct column, RLS policies for these tables required a subquery JOIN (or a chained subquery for `bucket_rotation_items`) on every row access. At scale, with thousands of rows per system, this creates unnecessary query plan complexity and per-row JOIN overhead.

## Decision

Add a direct `system_id` column to all six tables, populated from the parent table at insert time and kept in sync via the application layer.

- `system_id` is `NOT NULL` with a `REFERENCES systems(id) ON DELETE CASCADE` constraint.
- An index on `system_id` is added to each table to support RLS policy evaluation and system-scoped queries.
- RLS policies for these tables are updated to use `"system"` scope (direct column comparison) instead of `"join-system"` or `"join-system-chained"` scope.
- The `joinSystemRlsPolicy` and `chainedJoinSystemRlsPolicy` functions and the `"join-system"` / `"join-system-chained"` scope types are removed from `packages/db/src/rls/policies.ts`.

This is a pre-release change. Backfill of existing rows via the migration is safe because there is no production data.

## Consequences

**Easier:**

- RLS policy evaluation is O(1) per row — no JOIN subqueries.
- System-scoped queries on these tables can use the `system_id` index directly.
- RLS policy code is simpler: all six tables use the same `"system"` scope type.

**More difficult:**

- Application code that inserts into these tables must always supply `system_id` (already enforced by `NOT NULL`).
- `system_id` is redundant with the parent table's `system_id`; updates to system ownership (not supported in this schema) would require updating both.
- The SQLite migration uses the table-recreate pattern (six tables) due to SQLite's lack of `ALTER TABLE ADD COLUMN ... REFERENCES` support.
