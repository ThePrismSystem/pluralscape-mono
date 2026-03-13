# SQLite Message Archival Strategy for Self-Hosted Deployments

## Background

This document addresses finding S2 from schema audit 004: the `messages` table in the PostgreSQL schema uses `PARTITION BY RANGE (timestamp)` to keep active message data performant as volume grows over time. SQLite does not support table partitioning. Self-hosted deployments using SQLite need an alternative strategy that achieves the same goal — bounding the size of the hot `messages` table — without requiring PostgreSQL-specific features.

The `messages` table stores encrypted blobs. The server cannot read the content, only the metadata (`id`, `channel_id`, `system_id`, `timestamp`, `edited_at`, `archived`, `archived_at`, `version`). Any archival strategy operates entirely on that metadata.

---

## Problem

In the hosted PostgreSQL deployment, the `messages` table is partitioned by `timestamp`. Older partition files can be detached and moved to cold storage without touching the live table. Query performance on recent messages is unaffected by the total history size because the query planner prunes irrelevant partitions automatically.

In SQLite, there is one flat `messages` table. As a self-hosted system accumulates months or years of messages, that table grows without bound. A single-user deployment sending 50 messages per day reaches ~180K rows per year. That is still fast in SQLite, but at several years of use it becomes meaningful, and index scans on `channel_id + timestamp` degrade linearly with table size.

The SQLite schema as it stands (`id TEXT PRIMARY KEY`) has no composite primary key on `(id, timestamp)` unlike the PG schema — this is already a deliberate divergence. The archival strategy must work within SQLite's capabilities.

---

## Options Analysis

### Option 1: Time-based DELETE with export before pruning

Rows older than a configured retention window are exported to a sidecar file (newline-delimited JSON or a detached SQLite database) and then deleted from the live table. After deletion, `VACUUM` reclaims the freed pages.

**Pros:**

- The live table stays small; all queries remain fast.
- The export file is a portable, human-readable backup.
- Simple to implement — one `SELECT` to export, one `DELETE` to prune, one `VACUUM`.

**Cons:**

- Deleted rows are gone from the live DB. Accessing archived messages requires reading from the sidecar file, which is a separate read path.
- `VACUUM` on a large database can be slow and locks the DB during that time. `VACUUM INTO` (SQLite 3.27+) can write to a new file instead, reducing lock contention.
- If the export step fails before the delete, no data is lost. If the delete succeeds before the export is flushed to disk, data is lost. This requires careful sequencing (write export, fsync, then delete).

### Option 2: Separate `messages_archive` table within the same DB

Old rows are moved (`INSERT INTO messages_archive ... SELECT ... DELETE FROM messages`) rather than exported to a sidecar. The archive table lives in the same `.db` file.

**Pros:**

- Both active and archived messages are accessible via SQL. The application can query the archive table directly for history display.
- No secondary file to manage.
- Transactional: the move is a single transaction, so no partial-move failure mode.

**Cons:**

- The total database file size still grows — the archive table accumulates all historical rows. This only improves query performance on the active table, it does not reduce disk usage.
- The archive table needs the same schema and indexes as the live table, which doubles the schema surface for messages.
- For a self-hosted deployment where disk is a real concern (e.g., Raspberry Pi), this does not help.

### Option 3: WAL-based approach

Rely on SQLite's WAL (Write-Ahead Logging) mode and periodic checkpointing to manage file growth indirectly, without explicit archival.

This is not a viable archival strategy. WAL manages write concurrency and durability, not historical data volume. A WAL file growing without checkpointing is a misconfiguration, not an archival approach. This option is rejected.

### Option 4: Automatic rotation to a new DB file per time period

Each month (or year), the application opens a new SQLite file (`pluralscape-2026-01.db`, `pluralscape-2026-02.db`). The current period's file is the live DB; older files are read-only archives.

**Pros:**

- The live file never accumulates old data.
- Older files can be compressed, moved off-device, or deleted independently.

**Cons:**

- Cross-period queries (e.g., loading a channel's full history across a month boundary) require opening multiple files and merging results. This complicates every query that touches messages.
- Drizzle ORM has no concept of dynamic database selection at the query level — the connection is established at startup. Supporting multiple active DB files would require a custom connection manager.
- The Automerge CRDT sync layer expects a single consistent state store. Splitting state across files would require significant sync architecture changes.
- Migration runs would need to target all period files, not just the current one.

This option is impractical for the current architecture.

---

## Recommended Strategy: Time-based DELETE with sidecar export

**Option 1 is recommended.** Specifically: export-then-delete with a detached SQLite sidecar file (not JSON), combined with an in-app read path for accessing archived messages.

### Rationale

- It keeps the live table bounded, which is the actual performance goal.
- The sidecar export as a SQLite file (not JSON) means archived messages can be queried with the same Drizzle schema — no separate read path needed if the app attaches the archive file via `ATTACH DATABASE`.
- It is compatible with the existing single-file deployment model.
- It does not complicate the sync architecture — the CRDT layer only needs to know about the live table.
- The failure mode (export before delete, with fsync) is safe by construction.

### How it works

1. A background job (configurable schedule, default: nightly at 3 AM) runs when the SQLite deployment is active.
2. The job queries `messages` where `timestamp < (NOW() - retention_period)`.
3. Those rows are written into a sidecar archive file (e.g., `pluralscape-archive.db`) using the same `messages` table schema.
4. The archive file is flushed and sync'd to disk (`fsync`).
5. The rows are deleted from the live `messages` table in a transaction.
6. `PRAGMA wal_checkpoint(FULL)` is run to fold the WAL into the main file.
7. `VACUUM` is deferred unless the live DB has grown above a configurable size threshold, to avoid locking. `VACUUM INTO` (SQLite 3.27+) should be preferred when available.

The archive file accumulates all historical rows. It uses the same schema, so Drizzle queries work against it directly when `ATTACH`ed. The app can attach the archive database on demand when a user scrolls back to load old messages, then detach when done.

---

## Retention Configuration

Self-hosters configure retention through environment variables or a config file section. Sensible defaults:

```
SQLITE_MESSAGE_RETENTION_DAYS=365
SQLITE_ARCHIVAL_SCHEDULE="0 3 * * *"   # cron expression, default: 3 AM daily
SQLITE_ARCHIVAL_FILE="pluralscape-archive.db"
SQLITE_VACUUM_THRESHOLD_MB=500         # only VACUUM if live DB exceeds this size
SQLITE_ARCHIVAL_ENABLED=true           # set to false to disable entirely
```

A retention value of `0` or the string `forever` disables deletion entirely — archival is skipped and the live table grows without bound. This is acceptable for users who want no automatic maintenance.

The retention applies to the `messages` table only. Other tables (`channels`, `notes`, `polls`, `board_messages`) are not subject to time-based archival — they are small and user-controlled.

---

## Impact on Sync

The Automerge CRDT sync layer tracks document state and vector clocks. Archiving messages has two sync implications:

**Outbound sync (device to server or peer):** Once a message is archived out of the live table, it will no longer be included in sync operations that scan the live `messages` table. This is acceptable — archived messages are already confirmed synced (they were present in the live table long enough to be included in prior sync cycles). The retention period should be significantly longer than the expected maximum sync gap (the default 365 days covers any reasonable offline period).

**Inbound sync (server pushing to device):** If a device reconnects after being offline for longer than the retention period, the server may attempt to sync messages that no longer exist in the live table. The sync layer needs to handle this gracefully — missing messages on the receiving end should be a recoverable condition, not an error. The device can query the archive file directly for those messages. This is a sync edge case that should be documented as a known limitation of long offline periods in self-hosted deployments.

The recommended minimum retention period for users who might go offline for extended periods is 90 days. The default of 365 days is conservative and should cover nearly all real-world cases.

---

## Impact on Message History

Archived messages remain accessible through the sidecar file. The application UI impact depends on whether the archive is attached at query time:

- **Attached archive (default):** The app attaches `pluralscape-archive.db` when loading channel history that extends beyond the live table's oldest message. This is transparent to the user — they scroll back and history loads normally, slightly slower for the oldest messages. The app should log a debug event when the archive is consulted but should not surface this to the user.
- **Missing archive file:** If the archive file is missing (deleted, moved, or never written), history ends at the oldest message in the live table. The UI should indicate that older history is unavailable rather than showing an empty channel. This should be a graceful degradation, not an error.
- **Reply threading:** `reply_to_id` is a soft reference (no FK constraint, as documented in the SQLite schema). Replies to archived messages remain intact in the live table — the referenced message is simply in the archive. The UI should fall back gracefully when a reply target is not found in the live table.

---

## Implementation Notes

**Archive file schema:** The archive DB should be initialized with the same `messages` schema as the live DB, including all indexes. `ATTACH DATABASE 'pluralscape-archive.db' AS archive` makes it queryable as `archive.messages`. On first run, the archival job should create and migrate the archive file before writing any rows.

**Idempotency:** The archival job should be idempotent. If it runs twice (e.g., crash recovery), re-exporting already-archived rows to the archive file should use `INSERT OR IGNORE` so duplicates are silently skipped.

**Encryption:** Messages store `encrypted_data` blobs — the archival job copies these blobs verbatim. No decryption occurs during archival. The archive file is as sensitive as the live DB and should have the same filesystem permissions.

**Atomic export:** Write all rows for the current archival run into the archive DB within a single transaction before deleting from the live DB. If the archive write transaction fails to commit, abort and do not delete. Never delete from the live DB without a confirmed archive commit.

**Testing:** The archival job is a background task with side effects on two files. Integration tests should use temporary directories, seed the live DB with messages spanning the retention boundary, run the job, and assert:

- Rows older than retention are absent from the live table.
- Those exact rows are present in the archive table.
- Rows within retention are untouched in the live table.
- Running the job a second time produces no errors and no duplicate rows in the archive.

**Bean reference:** db-ec71
